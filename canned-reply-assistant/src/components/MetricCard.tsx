interface MetricCardProps {
  label: string
  value: string
  helper?: string
}

export function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <article className="metric-card">
      <span className="metric-card__label">{label}</span>
      <strong className="metric-card__value">{value}</strong>
      {helper ? <span className="metric-card__helper">{helper}</span> : null}
    </article>
  )
}
