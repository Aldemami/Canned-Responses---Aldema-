export function formatPercent(value: number, total: number) {
  if (!total) {
    return '0%'
  }

  return `${Math.round((value / total) * 100)}%`
}

export function formatHours(hours: number | null) {
  if (hours === null) {
    return '—'
  }

  if (hours < 24) {
    return `${hours.toFixed(1)}h`
  }

  return `${(hours / 24).toFixed(1)}d`
}

export function formatDateLabel(isoDate: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(isoDate))
}
