import type { ConfidenceLabel } from '../types'

interface ConfidenceBadgeProps {
  confidence: ConfidenceLabel
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  return (
    <span className={`confidence-badge confidence-badge--${confidence}`}>
      {confidence === 'none' ? 'No good match' : `${confidence} confidence`}
    </span>
  )
}
