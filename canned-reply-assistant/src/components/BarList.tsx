import type { CountDatum, TrendDatum } from '../types'

interface BarListProps {
  title: string
  items: CountDatum[] | TrendDatum[]
  emptyMessage: string
  compact?: boolean
}

export function BarList({
  title,
  items,
  emptyMessage,
  compact = false,
}: BarListProps) {
  const maxValue = Math.max(...items.map((item) => item.value), 0)

  return (
    <section className="panel">
      <div className="panel__header">
        <h3>{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="panel__empty">{emptyMessage}</p>
      ) : (
        <div className={`bar-list ${compact ? 'bar-list--compact' : ''}`}>
          {items.map((item) => (
            <div className="bar-list__row" key={item.label}>
              <div className="bar-list__meta">
                <span title={item.label}>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
              <div className="bar-list__track">
                <div
                  className="bar-list__fill"
                  style={{
                    width: `${maxValue === 0 ? 0 : (item.value / maxValue) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
