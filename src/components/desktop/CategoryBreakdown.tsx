import { useMemo } from 'react'
import { formatMoney } from '../../lib/format'
import type { Movement } from '../../types'

interface Props {
  movements: Movement[]
  active: string | null
  onSelect: (category: string | null) => void
  currency: string
  locale: string
}

/** Spend per category for the month; each row toggles a ledger filter. */
export function CategoryBreakdown({ movements, active, onSelect, currency, locale }: Props) {
  const { rows, total } = useMemo(() => {
    const map = new Map<string, number>()
    let total = 0
    for (const m of movements) {
      if (m.kind !== 'gasto') continue
      map.set(m.category, (map.get(m.category) ?? 0) + m.amount)
      total += m.amount
    }
    const rows = [...map.entries()].sort((a, b) => b[1] - a[1])
    return { rows, total }
  }, [movements])

  if (rows.length === 0) return <p className="dk-panel__empty">Sin gastos en este período.</p>

  return (
    <ul className="dk-cats">
      {rows.map(([cat, amt]) => {
        const pct = total ? amt / total : 0
        return (
          <li key={cat}>
            <button
              type="button"
              className={`dk-cats__row${active === cat ? ' dk-cats__row--on' : ''}`}
              aria-pressed={active === cat}
              onClick={() => onSelect(active === cat ? null : cat)}
            >
              <span className="dk-cats__name">{cat}</span>
              <span className="dk-cats__pct">{Math.round(pct * 100)}%</span>
              <span className="dk-cats__amt">{formatMoney(amt, currency, locale)}</span>
              <span className="dk-cats__bar" style={{ inlineSize: `${pct * 100}%` }} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
