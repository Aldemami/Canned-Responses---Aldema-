import seedPayload from '../data/cannedLibrary.seed.json'
import { appConfig } from '../config/appConfig'
import type { CannedGroup, CannedReply } from '../types'

interface SeedItem {
  id: string
  name: string
  group: string
  text: string
  url: string
  usable: boolean
}

interface SeedPayload {
  board_id: string
  count: number
  usable: number
  items: SeedItem[]
}

function asGroup(group: string): CannedGroup {
  if (appConfig.cannedGroups.includes(group as CannedGroup)) {
    return group as CannedGroup
  }

  return 'General'
}

export function buildSeedLibrary() {
  const payload = seedPayload as SeedPayload

  return payload.items
    .filter((item) => item.usable && item.text.trim())
    .map<CannedReply>((item) => ({
      id: item.id,
      name: item.name.trim(),
      group: asGroup(item.group),
      text: item.text.trim(),
      url: item.url,
      source: 'seed',
    }))
}
