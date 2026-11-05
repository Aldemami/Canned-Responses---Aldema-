import type { CannedGroup } from '../types'

export const appConfig = {
  appName: 'Canned Reply Assistant',
  slug: 'canned-reply-assistant',
  boardIds: {
    cannedResponses: '9844972619',
    businessLoungeTickets: '9576203144',
  },
  cannedResponseGroupIds: {
    'TOF / New Business': 'topics',
    CPQ: 'group_mkqfnt18',
    'Post Sales': 'group_mkqfc8z3',
    Partners: 'group_title',
    General: 'group_mkqggaek',
    'User Management / Tools': 'group_mm6j1j7x',
    Renewals: 'group_mm6j2524',
  } as Record<CannedGroup, string>,
  liveData: {
    apiUrl: 'https://api.monday.com/v2',
    ticketLookbackDays: 30,
    pageSize: 250,
    maxRetries: 4,
    retryBaseDelayMs: 600,
    tokenStorageKey: 'canned-reply-assistant:monday-token',
  },
  featureFlags: {
    enableMondayWrites:
      import.meta.env.VITE_ENABLE_MONDAY_WRITES === 'true',
  },
  matcher: {
    maxSuggestions: 3,
    highThreshold: 0.42,
    mediumThreshold: 0.24,
    lowThreshold: 0.12,
    duplicateThreshold: 0.28,
  },
  cannedGroups: [
    'TOF / New Business',
    'CPQ',
    'Post Sales',
    'Partners',
    'General',
    'User Management / Tools',
    'Renewals',
  ] as CannedGroup[],
} as const

export function readInitialMondayToken() {
  if (typeof window === 'undefined') {
    return import.meta.env.VITE_MONDAY_TOKEN?.trim() ?? ''
  }

  const saved = window.localStorage.getItem(appConfig.liveData.tokenStorageKey)
  return (saved ?? import.meta.env.VITE_MONDAY_TOKEN ?? '').trim()
}

export function persistMondayToken(token: string) {
  if (typeof window === 'undefined') {
    return
  }

  if (token.trim()) {
    window.localStorage.setItem(appConfig.liveData.tokenStorageKey, token.trim())
    return
  }

  window.localStorage.removeItem(appConfig.liveData.tokenStorageKey)
}
