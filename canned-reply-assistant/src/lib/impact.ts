import type { CoverageBreakdown, LocalEventLogEntry } from '../types'

export interface ImpactEstimate {
  estimatedMinutesSaved: number
  estimatedTicketsHelped: number
  estimatedCoverageShare: number
  estimatedConsistencyShare: number
}

export interface ImpactAssumptions {
  minutesSavedPerReply: number
}

export function buildImpactEstimate(
  coverage: CoverageBreakdown,
  totalTickets: number,
  assumptions: ImpactAssumptions,
): ImpactEstimate {
  const helpedTickets = coverage.high + coverage.medium
  const share = totalTickets === 0 ? 0 : helpedTickets / totalTickets

  return {
    estimatedMinutesSaved: helpedTickets * assumptions.minutesSavedPerReply,
    estimatedTicketsHelped: helpedTickets,
    estimatedCoverageShare: share,
    estimatedConsistencyShare: share,
  }
}

export function summarizeEventLog(events: LocalEventLogEntry[]) {
  return events.reduce(
    (summary, entry) => {
      summary[entry.type] = (summary[entry.type] ?? 0) + 1
      return summary
    },
    {} as Record<LocalEventLogEntry['type'], number>,
  )
}
