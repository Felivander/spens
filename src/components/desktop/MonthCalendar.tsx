import { useMemo } from 'react'
import { formatCompact } from '../../lib/format'
import { toISODate, todayISO, weekdayIndex } from '../../lib/dates'
import type { Movement } from '../../types'

const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

interface Props {
  anchor: Date
  /** Movements of the anchored month only. */
  movements: Movement[]
  selectedDay: string | null
  onSelectDay: (dayISO: string | null) => void
  locale: string
}

/**
 * Compact month grid. Each day is shaded by how much was spent relative to the
 * month's heaviest day, so the shape of the month reads at a glance; the cell
 * also prints the amount. Clicking a day filters the ledger and points the
 * command bar at it.
 */
export function MonthCalendar({ anchor, movements, selectedDay, onSelectDay, locale }: Props) {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()

  const { days, max } = useMemo(() => {
    const days: Record<string, { gasto: number; ingreso: number }> = {}
    for (const m of movements) {
      const d = (days[m.date] ??= { gasto: 0, ingreso: 0 })
      d[m.kind] += m.amount
    }
    const max = Math.max(0, ...Object.values(days).map((d) => d.gasto))
    return { days, max }
  }, [movements])

  const lead = weekdayIndex(new Date(year, month, 1))
  const count = new Date(year, month + 1, 0).getDate()
  const today = todayISO()

  return (
    <div className="dk-cal" role="grid" aria-label="Calendario del mes">
      {WEEKDAY_INITIALS.map((w, i) => (
        <span key={i} className="dk-cal__wd" aria-hidden="true">
          {w}
        </span>
      ))}
      {Array.from({ length: lead }, (_, i) => (
        <span key={`pad${i}`} aria-hidden="true" />
      ))}
      {Array.from({ length: count }, (_, i) => {
        const iso = toISODate(new Date(year, month, i + 1))
        const d = days[iso]
        const heat = d && max > 0 ? Math.round((d.gasto / max) * 45) : 0
        const cls = [
          'dk-cal__day',
          iso === today && 'dk-cal__day--today',
          iso === selectedDay && 'dk-cal__day--sel',
          iso > today && 'dk-cal__day--future',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <button
            key={iso}
            type="button"
            className={cls}
            style={{ '--heat': `${heat}%` } as React.CSSProperties}
            aria-pressed={iso === selectedDay}
            title={iso}
            onClick={() => onSelectDay(iso === selectedDay ? null : iso)}
          >
            <span className="dk-cal__num">{i + 1}</span>
            <span className="dk-cal__amt">
              {d?.gasto ? formatCompact(d.gasto, locale) : ''}
              {d?.ingreso ? <i className="dk-cal__in" aria-label="con ingreso" /> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
