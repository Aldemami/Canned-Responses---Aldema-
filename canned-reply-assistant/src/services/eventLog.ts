import { appConfig } from '../config/appConfig'
import type { LocalEventLogEntry } from '../types'

const storageKey = `${appConfig.slug}:event-log`

function readRawLog() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    return (JSON.parse(window.localStorage.getItem(storageKey) ?? '[]') ??
      []) as LocalEventLogEntry[]
  } catch {
    return []
  }
}

function writeRawLog(entries: LocalEventLogEntry[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify(entries))
}

export function readEventLog() {
  return readRawLog()
}

export function appendEvent(
  type: LocalEventLogEntry['type'],
  metadata: LocalEventLogEntry['metadata'],
) {
  const entry: LocalEventLogEntry = {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    createdAt: new Date().toISOString(),
    metadata,
  }

  const nextEntries = [...readRawLog(), entry].slice(-500)
  writeRawLog(nextEntries)
  return entry
}

export function clearEventLog() {
  writeRawLog([])
}
