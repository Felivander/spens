import { useMemo } from 'react'
import type { Movement } from '../../types'
import { formatMoney } from '../../lib/format'
import { toISODate, todayISO, weekdayIndex } from '../../lib/dates'

const WEEKDAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export interface MonthCalendarProps {
  anchor: Date
  movements: Movement[]
  selectedDay: string | null
  onSelectDay: (dayISO: string | null) => void
  currency: string
  locale: string
}

export function MonthCalendar({
  anchor,
  movements,
  selectedDay,
  onSelectDay,
  currency,
  locale,
}: MonthCalendarProps) {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()

  // Map daily totals
  const dailyTotals = useMemo(() => {
    const map: Record<string, { net: number; count: number; gasto: number; ingreso: number }> = {}
    for (const m of movements) {
      if (!map[m.date]) map[m.date] = { net: 0, count: 0, gasto: 0, ingreso: 0 }
      if (m.kind === 'ingreso') {
        map[m.date].net += m.amount
        map[m.date].ingreso += m.amount
      } else {
        map[m.date].net -= m.amount
        map[m.date].gasto += m.amount
      }
      map[m.date].count += 1
    }
    return map
  }, [movements])

  // Generate 7-day grid days (Monday-first)
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    const startDay = weekdayIndex(firstDayOfMonth) // 0 = Lun ... 6 = Dom

    const cells: { date: Date; isCurrentMonth: boolean; iso: string }[] = []

    // Previous month padding
    for (let i = startDay; i > 0; i--) {
      const d = new Date(year, month, 1 - i)
      cells.push({ date: d, isCurrentMonth: false, iso: toISODate(d) })
    }

    // Current month days
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(year, month, i)
      cells.push({ date: d, isCurrentMonth: true, iso: toISODate(d) })
    }

    // Next month padding to fill complete weeks
    const remaining = (7 - (cells.length % 7)) % 7
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i)
      cells.push({ date: d, isCurrentMonth: false, iso: toISODate(d) })
    }

    return cells
  }, [year, month])

  const today = todayISO()

  return (
    <div className="desk-calendar">
      <div className="desk-calendar__header">
        <span className="desk-calendar__title">Calendario</span>
        {selectedDay && (
          <button
            type="button"
            className="desk-calendar__reset-btn"
            onClick={() => onSelectDay(null)}
          >
            Ver mes completo
          </button>
        )}
      </div>

      <div className="desk-calendar__weekdays">
        {WEEKDAY_NAMES.map((w) => (
          <div key={w} className="desk-calendar__weekday">
            {w}
          </div>
        ))}
      </div>

      <div className="desk-calendar__grid">
        {calendarCells.map((cell) => {
          const isSelected = selectedDay === cell.iso
          const isToday = cell.iso === today
          const data = dailyTotals[cell.iso]

          return (
            <button
              key={cell.iso}
              type="button"
              className={`desk-calendar__cell${
                !cell.isCurrentMonth ? ' desk-calendar__cell--outside' : ''
              }${isSelected ? ' desk-calendar__cell--selected' : ''}${
                isToday ? ' desk-calendar__cell--today' : ''
              }`}
              onClick={() => {
                if (cell.isCurrentMonth) {
                  onSelectDay(isSelected ? null : cell.iso)
                }
              }}
              disabled={!cell.isCurrentMonth}
            >
              <span className="desk-calendar__cell-num">
                {cell.date.getDate()}
              </span>

              {data && data.count > 0 && (
                <span
                  className={`desk-calendar__cell-badge${
                    data.net > 0 ? ' desk-calendar__cell-badge--pos' : ''
                  }`}
                >
                  {data.net > 0 ? '+' : '−'}
                  {formatMoney(Math.abs(data.net), currency, locale)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
