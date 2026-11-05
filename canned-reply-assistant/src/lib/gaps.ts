import type { GapCluster, MatchResult, TicketRecord } from '../types'
import { uniqueTokens } from './text'

function clusterLabel(ticket: TicketRecord) {
  return (ticket.subject || ticket.name).trim() || 'Uncategorized gap'
}

function dedupe<T>(items: T[]) {
  return [...new Set(items)]
}

export function buildGapClusters(
  tickets: TicketRecord[],
  matchesByTicketId: Map<string, MatchResult[]>,
) {
  const clusters = new Map<string, TicketRecord[]>()

  for (const ticket of tickets) {
    const confidence = matchesByTicketId.get(ticket.id)?.[0]?.confidence ?? 'none'
    if (!['low', 'none'].includes(confidence)) {
      continue
    }

    const label = clusterLabel(ticket)
    const current = clusters.get(label) ?? []
    current.push(ticket)
    clusters.set(label, current)
  }

  return [...clusters.entries()]
    .map<GapCluster>(([label, gapTickets]) => {
      const sampleTickets = [...gapTickets]
        .sort((left, right) => right.creationDate.localeCompare(left.creationDate))
        .slice(0, 3)

      const resolvedExamples = tickets
        .filter(
          (ticket) =>
            clusterLabel(ticket) === label &&
            ['Resolved', 'Closed'].includes(ticket.status) &&
            ticket.resolutionSummary,
        )
        .sort((left, right) => right.creationDate.localeCompare(left.creationDate))
        .slice(0, 3)

      const keywords = dedupe(
        gapTickets.flatMap((ticket) =>
          uniqueTokens(`${ticket.subject} ${ticket.description}`).slice(0, 6),
        ),
      ).slice(0, 8)

      const hasLowMatch = gapTickets.some(
        (ticket) => matchesByTicketId.get(ticket.id)?.[0]?.confidence === 'low',
      )

      return {
        id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        label,
        ticketCount: gapTickets.length,
        matchConfidence: hasLowMatch ? 'low' : 'none',
        keywords,
        sampleTickets,
        resolvedExamples,
      }
    })
    .sort((left, right) => right.ticketCount - left.ticketCount)
}

export function composeDraftCannedReply(cluster: GapCluster) {
  const title = cluster.label
  const summaries = dedupe(
    cluster.resolvedExamples
      .map((ticket) => ticket.resolutionSummary?.trim())
      .filter(Boolean) as string[],
  )
  const fallbackContext = cluster.sampleTickets
    .map((ticket) => ticket.description.trim())
    .filter(Boolean)
    .slice(0, 2)

  const bodyLines = summaries.length > 0 ? summaries : fallbackContext

  const draftBody = [
    `Thanks for reaching out about ${cluster.label.toLowerCase()}.`,
    '',
    'Suggested guidance:',
    ...bodyLines.map((line) => `- ${line}`),
    '',
    'Please review and tailor any specifics before saving this as a new canned reply.',
  ].join('\n')

  return {
    title,
    body: draftBody,
  }
}
