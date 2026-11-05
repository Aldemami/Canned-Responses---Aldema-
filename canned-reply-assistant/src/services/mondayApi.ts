import { appConfig } from '../config/appConfig'
import { buildSeedLibrary } from '../lib/library'
import type { AppDataBundle, CannedGroup, CannedReply, TicketRecord } from '../types'
import { buildMockTickets } from '../data/mockTickets'

interface MondayGraphQLError {
  message: string
}

interface MondayResponse<TData> {
  data?: TData
  errors?: MondayGraphQLError[]
}

interface ColumnValuePayload {
  id: string
  text?: string
  value?: string | null
  label?: string
  date?: string
}

interface TicketItemPayload {
  id: string
  name: string
  url: string
  created_at: string
  updated_at: string
  column_values: ColumnValuePayload[]
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function asJson<T>(value: string | null | undefined): T | null {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function isRateLimited(status: number, errors: MondayGraphQLError[] | undefined) {
  if (status === 429) {
    return true
  }

  return (errors ?? []).some((error) =>
    /rate|limit|Complexity/i.test(error.message),
  )
}

async function fetchMondayGraphQL<TData>(
  token: string,
  query: string,
  variables: Record<string, unknown> = {},
) {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < appConfig.liveData.maxRetries; attempt += 1) {
    const response = await fetch(appConfig.liveData.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify({ query, variables }),
    })

    const payload = (await response.json()) as MondayResponse<TData>

    if (!response.ok || payload.errors?.length) {
      if (isRateLimited(response.status, payload.errors)) {
        const backoff = appConfig.liveData.retryBaseDelayMs * 2 ** attempt
        await delay(backoff)
        continue
      }

      lastError = new Error(
        payload.errors?.map((error) => error.message).join('; ') ||
          `Request failed with status ${response.status}`,
      )
      break
    }

    if (!payload.data) {
      lastError = new Error('monday API returned no data.')
      break
    }

    return payload.data
  }

  throw lastError ?? new Error('monday API request failed after retries.')
}

function pickValue(values: ColumnValuePayload[], id: string) {
  return values.find((value) => value.id === id)
}

function dateOnlyToIso(date: string) {
  return date ? `${date}T00:00:00.000Z` : ''
}

function mapTicketItem(item: TicketItemPayload): TicketRecord {
  const subject = pickValue(item.column_values, 'dropdown_mkxm9cyn')?.text?.trim() ?? ''
  const description = pickValue(item.column_values, 'long_text7')?.text?.trim() ?? ''
  const status = pickValue(item.column_values, 'status95')?.label?.trim() ?? ''
  const assignmentGroup =
    pickValue(item.column_values, 'color_mkwj5get')?.label?.trim() ?? ''
  const department = pickValue(item.column_values, 'status_10')?.label?.trim() ?? ''
  const primarySystem =
    pickValue(item.column_values, 'color_mkvj19ae')?.label?.trim() ?? ''
  const assignee = pickValue(item.column_values, 'people0')?.text?.trim() ?? ''
  const creationDateColumn = pickValue(item.column_values, 'date')?.date ?? ''
  const resolutionDateColumn = pickValue(item.column_values, 'date6')?.date ?? ''

  return {
    id: item.id,
    name: item.name,
    subject,
    description,
    status,
    assignmentGroup,
    department,
    primarySystem,
    assignee,
    creationDate: dateOnlyToIso(creationDateColumn) || item.created_at,
    resolutionDate: dateOnlyToIso(resolutionDateColumn) || undefined,
    url: item.url,
  }
}

type CannedPageData = {
  boards: Array<{
    items_page: {
      cursor: string | null
      items: Array<{
        id: string
        name: string
        url: string
        group: { title: CannedGroup | null } | null
        updates: Array<{
          text_body: string | null
          created_at: string
        }>
      }>
    }
  }>
}

async function loadLiveCannedReplies(token: string): Promise<CannedReply[]> {
  const replies: CannedReply[] = []
  let cursor: string | null = null

  do {
    const query: string = `
      query CannedReplies($cursor: String) {
        boards(ids: [${appConfig.boardIds.cannedResponses}]) {
          items_page(limit: 100, cursor: $cursor) {
            cursor
            items {
              id
              name
              url
              group {
                title
              }
              updates(limit: 5) {
                text_body
                created_at
              }
            }
          }
        }
      }
    `

    const data: CannedPageData = await fetchMondayGraphQL<CannedPageData>(token, query, { cursor })
    const page: CannedPageData['boards'][number]['items_page'] | undefined =
      data.boards[0]?.items_page

    for (const item of page?.items ?? []) {
      const update = [...item.updates]
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .find((candidate) => candidate.text_body?.trim())

      if (!update?.text_body?.trim() || !item.group?.title) {
        continue
      }

      replies.push({
        id: item.id,
        name: item.name.trim(),
        group: item.group.title,
        text: update.text_body.trim(),
        url: item.url,
        source: 'live',
      })
    }

    cursor = page?.cursor ?? null
  } while (cursor)

  return replies
}

type TicketPageData = {
  boards: Array<{
    items_page: {
      cursor: string | null
      items: TicketItemPayload[]
    }
  }>
}

function ticketFields() {
  return `
    id
    name
    url
    created_at
    updated_at
    column_values(ids: ["status95", "color_mkwj5get", "status_10", "color_mkvj19ae", "dropdown_mkxm9cyn", "long_text7", "date", "date6", "people0"]) {
      id
      text
      value
      ... on StatusValue {
        label
      }
      ... on DateValue {
        date
      }
    }
  `
}

async function loadLiveRecentTickets(token: string): Promise<TicketRecord[]> {
  const today = new Date()
  const fromDate = new Date(today)
  fromDate.setDate(today.getDate() - appConfig.liveData.ticketLookbackDays)

  const from = fromDate.toISOString().slice(0, 10)
  const to = today.toISOString().slice(0, 10)

  const tickets: TicketRecord[] = []
  let cursor: string | null = null

  do {
    const query: string = cursor
      ? `
        query RecentTicketsNext($cursor: String) {
          boards(ids: [${appConfig.boardIds.businessLoungeTickets}]) {
            items_page(limit: ${appConfig.liveData.pageSize}, cursor: $cursor) {
              cursor
              items {
                ${ticketFields()}
              }
            }
          }
        }
      `
      : `
        query RecentTickets {
          boards(ids: [${appConfig.boardIds.businessLoungeTickets}]) {
            items_page(
              limit: ${appConfig.liveData.pageSize}
              query_params: {
                rules: [
                  {
                    column_id: "date"
                    compare_value: ["${from}", "${to}"]
                    operator: between
                  }
                ]
              }
            ) {
              cursor
              items {
                ${ticketFields()}
              }
            }
          }
        }
      `

    const data: TicketPageData = await fetchMondayGraphQL<TicketPageData>(token, query, { cursor })
    const page: TicketPageData['boards'][number]['items_page'] | undefined =
      data.boards[0]?.items_page

    for (const item of page?.items ?? []) {
      tickets.push(mapTicketItem(item))
    }

    cursor = page?.cursor ?? null
  } while (cursor)

  return tickets
}

export async function loadAppData(token: string): Promise<AppDataBundle> {
  if (!token.trim()) {
    return buildDemoBundle()
  }

  try {
    const [cannedReplies, tickets] = await Promise.all([
      loadLiveCannedReplies(token),
      loadLiveRecentTickets(token),
    ])

    return {
      cannedReplies: cannedReplies.length ? cannedReplies : buildSeedLibrary(),
      tickets: tickets.length ? tickets : buildMockTickets(),
      dataSource: 'live',
    }
  } catch (error) {
    console.error(error)
    return buildDemoBundle()
  }
}

export function buildDemoBundle(): AppDataBundle {
  return {
    cannedReplies: buildSeedLibrary(),
    tickets: buildMockTickets(),
    dataSource: 'seed',
  }
}

interface CreateCannedReplyInput {
  token: string
  name: string
  groupId: string
  replyBody: string
}

interface CreateItemResponse {
  create_item: {
    id: string
  }
}

interface CreateUpdateResponse {
  create_update: {
    id: string
  }
}

export async function createCannedReply(input: CreateCannedReplyInput) {
  if (!appConfig.featureFlags.enableMondayWrites) {
    throw new Error('monday writes are disabled by feature flag.')
  }

  const createItemMutation = `
    mutation CreateCannedItem($itemName: String!, $groupId: String!) {
      create_item(
        board_id: ${appConfig.boardIds.cannedResponses}
        group_id: $groupId
        item_name: $itemName
      ) {
        id
      }
    }
  `

  const item = await fetchMondayGraphQL<CreateItemResponse>(
    input.token,
    createItemMutation,
    {
      itemName: input.name,
      groupId: input.groupId,
    },
  )

  const createUpdateMutation = `
    mutation CreateCannedUpdate($itemId: ID!, $body: String!) {
      create_update(item_id: $itemId, body: $body) {
        id
      }
    }
  `

  const update = await fetchMondayGraphQL<CreateUpdateResponse>(
    input.token,
    createUpdateMutation,
    {
      itemId: item.create_item.id,
      body: input.replyBody,
    },
  )

  return {
    itemId: item.create_item.id,
    updateId: update.create_update.id,
  }
}

export function readPersonIds(value: string | null | undefined) {
  const parsed = asJson<{ personsAndTeams?: Array<{ id: number }> }>(value)
  return parsed?.personsAndTeams?.map((entry) => entry.id) ?? []
}
