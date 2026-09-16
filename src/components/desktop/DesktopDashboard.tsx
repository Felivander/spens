import { useState, useMemo, useEffect } from 'react'
import type { Movement } from '../../types'
import { MetricCards } from './MetricCards'
import { MonthCalendar } from './MonthCalendar'
import { SpreadsheetTable } from './SpreadsheetTable'
import { isSameMonth, monthLabel } from '../../lib/dates'

export interface DesktopDashboardProps {
  movements: Movement[]
  anchor: Date
  currency: string
  locale: string
  onUpdateCategory: (id: string, category: string) => void
  onUpdateMovement: (id: string, patch: Partial<Omit<Movement, 'id' | 'createdAt'>>) => void
  onDeleteMovement: (id: string) => void
  onAddMovement: (movement: Omit<Movement, 'id' | 'createdAt'>) => void
}

export function DesktopDashboard({
  movements,
  anchor,
  currency,
  locale,
  onUpdateCategory,
  onUpdateMovement,
  onDeleteMovement,
  onAddMovement,
}: DesktopDashboardProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [quickAddDay, setQuickAddDay] = useState<string | null>(null)

  // Reset day selection when the user switches months via RangeNav
  useEffect(() => {
    setSelectedDay(null)
    setQuickAddDay(null)
  }, [anchor])

  // Movements belonging to the currently viewed month
  const monthMovements = useMemo(() => {
    return movements.filter((m) => isSameMonth(m.date, anchor))
  }, [movements, anchor])

  const handleQuickAdd = (dayISO: string) => {
    setSelectedDay(dayISO)
    setQuickAddDay(dayISO)
  }

  return (
    <div className="desk-dash">
      <header className="desk-dash__header">
        <div>
          <h1 className="desk-dash__title">{monthLabel(anchor)}</h1>
          <span className="desk-dash__subtitle">Resumen y métricas de escritorio</span>
        </div>
      </header>

      <MetricCards
        movements={monthMovements}
        currency={currency}
        locale={locale}
      />

      <div className="desk-dash__body">
        <div className="desk-dash__calendar-col">
          <MonthCalendar
            anchor={anchor}
            movements={monthMovements}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onQuickAdd={handleQuickAdd}
            currency={currency}
            locale={locale}
          />
        </div>

        <div className="desk-dash__table-col">
          <SpreadsheetTable
            movements={monthMovements}
            selectedDay={selectedDay}
            onClearDayFilter={() => {
              setSelectedDay(null)
              setQuickAddDay(null)
            }}
            currency={currency}
            locale={locale}
            onUpdateCategory={onUpdateCategory}
            onUpdateMovement={onUpdateMovement}
            onDeleteMovement={onDeleteMovement}
            onAddMovement={onAddMovement}
            quickAddDay={quickAddDay}
            onSetQuickAddDay={setQuickAddDay}
          />
        </div>
      </div>
    </div>
  )
}
