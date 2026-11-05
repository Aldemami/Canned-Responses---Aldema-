import type { DashboardData, MatchResult, TicketRecord } from '../types'

function toDateOnly(isoDate: string) {
  return isoDate.slice(0, 10)
}

function median(values: number[]) {
  if (values.length === 0) {
    return null
  }

  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }

  return sorted[middle]
}

function countBy<T extends string>(values: T[]) {
  const counter = new Map<T, number>()

  for (const value of values) {
    if (!value) {
      continue
    }

    counter.set(value, (counter.get(value) ?? 0) + 1)
  }

  return [...counter.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([label, value]) => ({ label, value }))
}

function topN<T>(items: T[], size = 6) {
  return items.slice(0, size)
}

export function buildDashboardData(
  tickets: TicketRecord[],
  matchesByTicketId: Map<string, MatchResult[]>,
): DashboardData {
  const openStatuses = tickets
    .filter((ticket) => !['Resolved', 'Closed'].includes(ticket.status))
    .map((ticket) => ticket.status)

  const resolutionHours = tickets
    .filter((ticket) => ticket.resolutionDate)
    .map((ticket) => {
      const created = new Date(ticket.creationDate).getTime()
      const resolved = new Date(ticket.resolutionDate!).getTime()
      return Math.max(0, (resolved - created) / (1000 * 60 * 60))
    })

  const volumeMap = new Map<string, number>()
  for (const ticket of tickets) {
    const key = toDateOnly(ticket.creationDate)
    volumeMap.set(key, (volumeMap.get(key) ?? 0) + 1)
  }

  const gapMap = new Map<string, number>()
  const coverage = {
    high: 0,
    medium: 0,
    low: 0,
    none: 0,
  }

  for (const ticket of tickets) {
    const bestMatch = matchesByTicketId.get(ticket.id)?.[0]
    const confidence = bestMatch?.confidence ?? 'none'
    coverage[confidence] += 1

    if (confidence === 'low' || confidence === 'none') {
      const label = ticket.subject || ticket.name
      gapMap.set(label, (gapMap.get(label) ?? 0) + 1)
    }
  }

  return {
    totalTickets: tickets.length,
    openTickets: openStatuses.length,
    resolvedTickets: tickets.filter((ticket) => ['Resolved', 'Closed'].includes(ticket.status)).length,
    medianResolutionHours: median(resolutionHours),
    volumeByDay: [...volumeMap.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([label, value]) => ({ label: label.slice(5), value })),
    openByStatus: countBy(openStatuses),
    topSubjects: topN(countBy(tickets.map((ticket) => ticket.subject || ticket.name))),
    topAssignmentGroups: topN(
      countBy(tickets.map((ticket) => ticket.assignmentGroup || 'Unassigned')),
    ),
    coverage,
    gapTopics: topN(
      [...gapMap.entries()]
        .sort((left, right) => right[1] - left[1])
        .map(([label, value]) => ({ label, value })),
    ),
  }
}
