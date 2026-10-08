import { useEffect, useRef, useState } from 'react'
import { WEEKDAYS } from '../lib/dates'
import { formatMoney } from '../lib/format'
import type { Scope, Tab } from '../types'

const MONTH_ABBRS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

interface Props {
  scope: Scope
  tab: Tab
  anchor: Date
  onScopeChange: (scope: Scope) => void
  onTabChange: (tab: Tab) => void
  onAnchorChange: (anchor: Date) => void
  selectedNet: number
  currency: string
  locale: string
}

export function RangeNav({
  scope,
  tab,
  anchor,
  onScopeChange,
  onTabChange,
  onAnchorChange,
  selectedNet,
  currency,
  locale,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const monthsRef = useRef<HTMLDivElement>(null)
  const chipRef = useRef<HTMLButtonElement>(null)

  const now = new Date()
  const isCurrentMonth =
    anchor.getFullYear() === now.getFullYear() &&
    anchor.getMonth() === now.getMonth()

  // Collapse extra tabs when switching away from the recent-day tabs
  useEffect(() => {
    if (tab !== 'hoy' && tab !== 'ayer' && tab !== 'anteayer') {
      setExpanded(false)
    }
  }, [tab])

  // Reset scroll to left when month picker opens so the selected month on the left is always visible
  useEffect(() => {
    if (showMonthPicker) {
      if (scrollerRef.current) scrollerRef.current.scrollLeft = 0
      if (monthsRef.current) monthsRef.current.scrollLeft = 0
    }
  }, [showMonthPicker])

  // Close month picker on outside click or Esc
  useEffect(() => {
    if (!showMonthPicker) return

    const onPointerDown = (e: PointerEvent) => {
      if (!scrollerRef.current?.contains(e.target as Node)) {
        setShowMonthPicker(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMonthPicker(false)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [showMonthPicker])

  const periodSelected = tab === 'periodo'

  const handleMainTabClick = () => {
    if (!periodSelected) {
      onTabChange('periodo')
    } else {
      setShowMonthPicker((v) => !v)
    }
  }

  const pickScope = (next: Scope) => {
    onScopeChange(next)
    setShowMonthPicker(false)
    chipRef.current?.focus()
  }

  const handleHoyClick = () => {
    if (tab !== 'hoy') {
      onTabChange('hoy')
    } else if (!expanded) {
      setExpanded(true)
    } else {
      setExpanded(false)
    }
  }

  const mainTabLabel =
    scope === 'semana' ? 'sem' : isCurrentMonth ? 'mes' : MONTH_ABBRS[anchor.getMonth()]

  // Re-order months so the selected month is ALWAYS first on the left
  const selectedMonthIndex = anchor.getMonth()
  const orderedMonthIndices = Array.from({ length: 12 }, (_, i) => (selectedMonthIndex + i) % 12)

  return (
    <nav className="nav" aria-label="Periodo">
      <div className={`nav__scroller${scope === 'semana' ? ' nav__scroller--week' : ''}`} role="tablist" aria-label="Rango de movimientos" ref={scrollerRef}>
        {/* Main single month/scope button (collapses when 12-month strip opens) */}
        <div className={`nav__main-tab${showMonthPicker ? ' nav__main-tab--collapsed' : ''}`}>
          <div className="menu-anchor">
            <button
              ref={chipRef}
              type="button"
              role="tab"
              className={`tab${!isCurrentMonth ? ' tab--custom-month' : ''}`}
              aria-selected={periodSelected}
              aria-expanded={showMonthPicker}
              onClick={handleMainTabClick}
            >
              {mainTabLabel}
            </button>

          </div>
        </div>

        {/* 12-month picker strip: ordered so the selected month is ALWAYS on the far left */}
        <div
          ref={monthsRef}
          className={`nav__months${showMonthPicker ? ' nav__months--open' : ''}`}
          aria-hidden={!showMonthPicker}
        >
          {/* Scope switch lives at the head of the strip so it is always discoverable */}
          <button
            type="button"
            tabIndex={showMonthPicker ? 0 : -1}
            className="tab tab--scope"
            onClick={() => pickScope(scope === 'mes' ? 'semana' : 'mes')}
          >
            {scope === 'mes' ? 'semana' : 'mes'}
          </button>
          {orderedMonthIndices.map((monthIndex) => {
            const m = MONTH_ABBRS[monthIndex]
            const isSelected = anchor.getMonth() === monthIndex
            const isTodayMonth = now.getMonth() === monthIndex && anchor.getFullYear() === now.getFullYear()
            return (
              <button
                key={m}
                type="button"
                role="tab"
                tabIndex={showMonthPicker ? 0 : -1}
                className={`tab${isSelected ? ' tab--selected-month' : ''}${isTodayMonth ? ' tab--today-month' : ''}`}
                aria-selected={isSelected}
                onClick={() => {
                  if (scope === 'semana') onScopeChange('mes')
                  onAnchorChange(new Date(anchor.getFullYear(), monthIndex, 1))
                  onTabChange('periodo')
                  setShowMonthPicker(false)
                }}
              >
                {m}
              </button>
            )
          })}
        </div>

        {/* Regular tabs: hoy / anteayer / week days (hidden when 12-month picker is expanded) */}
        {!showMonthPicker && (
          <>
            {scope === 'mes' ? (
              <>
                <div className={`nav__extra${expanded ? ' nav__extra--open' : ''}`} aria-hidden={!expanded}>
                  <button
                    type="button"
                    role="tab"
                    className="tab"
                    tabIndex={expanded ? 0 : -1}
                    aria-selected={tab === 'anteayer'}
                    onClick={() => onTabChange('anteayer')}
                  >
                    anteayer
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className="tab"
                    tabIndex={expanded ? 0 : -1}
                    aria-selected={tab === 'ayer'}
                    onClick={() => onTabChange('ayer')}
                  >
                    ayer
                  </button>
                </div>
                <button
                  type="button"
                  role="tab"
                  className="tab"
                  aria-selected={tab === 'hoy'}
                  onClick={handleHoyClick}
                >
                  hoy
                </button>
              </>
            ) : (
              WEEKDAYS.map((day, index) => (
                <button
                  key={day}
                  type="button"
                  role="tab"
                  className="tab"
                  aria-selected={tab === index}
                  onClick={() => onTabChange(index)}
                >
                  {day}
                </button>
              ))
            )}
          </>
        )}
      </div>

      <div className="nav__value">
        <span className={`nav__stat-value${selectedNet > 0 ? ' nav__stat-value--pos' : ''}`}>
          {formatMoney(selectedNet, currency, locale)}
        </span>
      </div>
    </nav>
  )
}
