export const cannedGroups = [
  'TOF / New Business',
  'CPQ',
  'Post Sales',
  'Partners',
  'General',
  'User Management / Tools',
  'Renewals',
] as const

export type CannedGroup = (typeof cannedGroups)[number]

export type ConfidenceLabel = 'high' | 'medium' | 'low' | 'none'

export interface CannedReply {
  id: string
  name: string
  group: CannedGroup
  text: string
  url: string
  source: 'seed' | 'live'
}

export interface TicketRecord {
  id: string
  name: string
  subject: string
  description: string
  status: string
  assignmentGroup: string
  department: string
  primarySystem: string
  assignee: string
  creationDate: string
  resolutionDate?: string
  resolutionSummary?: string
  url: string
}

export interface MatchResult {
  reply: CannedReply
  score: number
  confidence: ConfidenceLabel
  overlappingTerms: string[]
  reason: string
}

export interface GroupSuggestion {
  group: CannedGroup
  score: number
  confidence: ConfidenceLabel
  rationale: string
}

export interface CoverageBreakdown {
  high: number
  medium: number
  low: number
  none: number
}

export interface CountDatum {
  label: string
  value: number
}

export interface TrendDatum {
  label: string
  value: number
}

export interface DashboardData {
  totalTickets: number
  openTickets: number
  resolvedTickets: number
  medianResolutionHours: number | null
  volumeByDay: TrendDatum[]
  openByStatus: CountDatum[]
  topSubjects: CountDatum[]
  topAssignmentGroups: CountDatum[]
  coverage: CoverageBreakdown
  gapTopics: CountDatum[]
}

export interface GapCluster {
  id: string
  label: string
  ticketCount: number
  matchConfidence: ConfidenceLabel
  keywords: string[]
  sampleTickets: TicketRecord[]
  resolvedExamples: TicketRecord[]
}

export interface LocalEventLogEntry {
  id: string
  type:
    | 'suggestions_shown'
    | 'reply_copied'
    | 'gap_draft_generated'
    | 'candidate_submit_attempted'
    | 'candidate_created'
  createdAt: string
  metadata: Record<string, string | number | boolean | null>
}

export interface AppDataBundle {
  cannedReplies: CannedReply[]
  tickets: TicketRecord[]
  dataSource: 'seed' | 'live'
}
