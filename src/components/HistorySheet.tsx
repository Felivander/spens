import { useMemo, useRef, useState } from 'react'
import { useDragToClose } from '../lib/useDragToClose'
import { formatSigned, formatMoney } from '../lib/format'
import { fromISODate, isSameMonth, monthLabel, MONTHS, todayISO, WEEKDAYS, weekdayIndex } from '../lib/dates'
import { CATEGORIES } from '../lib/categories'
import { ChevronLeft, ChevronRight } from './icons'
import type { Movement } from '../types'

interface Props {
  movements: Movement[]
  currency: string
  locale: string
  onClose: () => void
}

type HistTab = 'todo' | 'resumen'

function dayHeading(iso: string): string {
  if (iso === todayISO()) return 'hoy'
  const d = fromISODate(iso)
  return `${WEEKDAYS[weekdayIndex(d)]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
}

/* ------------------------------------------------------------------ Log -- */

function TodoTab({ movements, currency, locale }: Omit<Props, 'onClose'>) {
  if (movements.length === 0) {
    return (
      <div className="hist__empty">
        <p>Sin movimientos en este período.</p>
      </div>
    )
  }

  const sorted = [...movements].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
  )

  const groups: { date: string; items: Movement[] }[] = []
  for (const m of sorted) {
    const last = groups.at(-1)
    if (last && last.date === m.date) last.items.push(m)
    else groups.push({ date: m.date, items: [m] })
  }

  return (
    <div className="hist__list">
      {groups.map((group) => (
        <section key={group.date}>
          <h3 className="hist__daylabel">{dayHeading(group.date)}</h3>
          {group.items.map((m) => (
            <div key={m.id} className="hist__row">
              <span className="hist__row-text">
                <span className="hist__row-desc">{m.description}</span>
                <span className="hist__row-meta">{m.category}</span>
              </span>
              <span className={`hist__row-amount${m.kind === 'ingreso' ? ' hist__row-amount--in' : ''}`}>
                {formatSigned(m.amount, m.kind, currency, locale)}
              </span>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

/* --------------------------------------------------------------- Resumen -- */

/** "Proyección $X · 12% más que sep a esta altura" — only what the data supports. */
function insight(all: Movement[], anchor: Date, gastos: number) {
  const now = new Date()
  const y = anchor.getFullYear()
  const mo = anchor.getMonth()
  const isCurrent = y === now.getFullYear() && mo === now.getMonth()
  const cutDay = isCurrent ? now.getDate() : 31
  const prev = new Date(y, mo - 1, 1)

  let prevGastos = 0
  for (const m of all) {
    if (m.kind !== 'gasto') continue
    const d = fromISODate(m.date)
    if (d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth() && d.getDate() <= cutDay) {
      prevGastos += m.amount
    }
  }

  const daysInMonth = new Date(y, mo + 1, 0).getDate()
  const projected = isCurrent ? (gastos / now.getDate()) * daysInMonth : null
  const delta = prevGastos > 0 ? (gastos - prevGastos) / prevGastos : null
  return { projected, delta, prevLabel: MONTHS[prev.getMonth()].slice(0, 3), isCurrent }
}

function ResumenTab({
  movements,
  allMovements,
  anchor,
  currency,
  locale,
}: Omit<Props, 'onClose'> & { allMovements: Movement[]; anchor: Date }) {
  const stats = useMemo(() => {
    const byCategory: Record<string, { gastos: number; ingresos: number }> = {}

    for (const m of movements) {
      if (!byCategory[m.category]) byCategory[m.category] = { gastos: 0, ingresos: 0 }
      if (m.kind === 'gasto') byCategory[m.category].gastos += m.amount
      else byCategory[m.category].ingresos += m.amount
    }

    const rows = CATEGORIES
      .filter((cat) => byCategory[cat])
      .map((cat) => ({ cat, ...byCategory[cat] }))
      .sort((a, b) => (b.gastos + b.ingresos) - (a.gastos + a.ingresos))

    const totalGastos = movements.filter(m => m.kind === 'gasto').reduce((s, m) => s + m.amount, 0)
    const totalIngresos = movements.filter(m => m.kind === 'ingreso').reduce((s, m) => s + m.amount, 0)
    const maxAmount = Math.max(...rows.map(r => r.gastos + r.ingresos), 1)

    return { rows, totalGastos, totalIngresos, maxAmount }
  }, [movements])

  const info = useMemo(
    () => insight(allMovements, anchor, stats.totalGastos),
    [allMovements, anchor, stats.totalGastos],
  )

  if (stats.rows.length === 0) {
    return (
      <div className="hist__empty">
        <p>Sin movimientos en este período.</p>
      </div>
    )
  }

  return (
    <div className="hist__list">
      {/* Totals header */}
      <div className="hist__totals">
        <div className="hist__total-item">
          <span className="hist__total-label">Gastos</span>
          <span className="hist__total-value hist__total-value--out">
            {formatMoney(-stats.totalGastos, currency, locale)}
          </span>
        </div>
        <div className="hist__total-divider" />
        <div className="hist__total-item">
          <span className="hist__total-label">Ingresos</span>
          <span className="hist__total-value hist__total-value--in">
            +{formatMoney(stats.totalIngresos, currency, locale)}
          </span>
        </div>
      </div>

      {(info.projected !== null || info.delta !== null) && (
        <p className="hist__insight">
          {info.projected !== null && (
            <>
              Proyección del mes <strong>{formatMoney(Math.round(info.projected), currency, locale)}</strong>
            </>
          )}
          {info.projected !== null && info.delta !== null && ' · '}
          {info.delta !== null && (
            <>
              {Math.abs(Math.round(info.delta * 100))}% {info.delta >= 0 ? 'más' : 'menos'} que {info.prevLabel}
              {info.isCurrent ? ' a esta altura' : ''}
            </>
          )}
        </p>
      )}

      {/* Per-category rows */}
      {stats.rows.map(({ cat, gastos, ingresos }) => {
        const total = gastos + ingresos
        const pct = Math.round((total / stats.maxAmount) * 100)
        const hasGastos = gastos > 0
        const hasIngresos = ingresos > 0

        return (
          <div key={cat} className="hist__cat-row">
            <div className="hist__cat-head">
              <span className="hist__cat-name">{cat}</span>
              <span className="hist__cat-amounts">
                {hasGastos && (
                  <span className="hist__cat-out">
                    −{formatMoney(gastos, currency, locale)}
                  </span>
                )}
                {hasGastos && hasIngresos && <span className="hist__cat-sep"> · </span>}
                {hasIngresos && (
                  <span className="hist__cat-in">
                    +{formatMoney(ingresos, currency, locale)}
                  </span>
                )}
              </span>
            </div>
            <div className="hist__bar-track">
              <div
                className="hist__bar-fill"
                style={{ width: `${pct}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ Page -- */

export function HistoryPage({ movements, currency, locale, onClose }: Props) {
  const pageRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<HistTab>('todo')
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => new Date())

  useDragToClose(pageRef, onClose, 'right')

  const monthMovements = useMemo(() => {
    return movements.filter((m) => isSameMonth(m.date, monthAnchor))
  }, [movements, monthAnchor])

  const canStepForward = useMemo(() => {
    const now = new Date()
    return (
      monthAnchor.getFullYear() < now.getFullYear() ||
      (monthAnchor.getFullYear() === now.getFullYear() &&
        monthAnchor.getMonth() < now.getMonth())
    )
  }, [monthAnchor])

  const handleStepMonth = (delta: -1 | 1) => {
    setMonthAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  return (
    <div className="hist-page" role="region" aria-label="Historial de movimientos" ref={pageRef}>
      {/* Header — back button + title */}
      <header className="hist-page__header">
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          aria-label="Volver"
        >
          <ChevronLeft />
        </button>
        <span className="hist-page__title">Historial</span>
      </header>

      {/* Tab bar — todo / resumen */}
      <nav className="hist-page__nav" aria-label="Vista de historial">
        <div className="nav__scroller" role="tablist">
          <button
            type="button"
            role="tab"
            className="tab"
            aria-selected={tab === 'todo'}
            onClick={() => setTab('todo')}
          >
            todo
          </button>
          <button
            type="button"
            role="tab"
            className="tab"
            aria-selected={tab === 'resumen'}
            onClick={() => setTab('resumen')}
          >
            resumen
          </button>
        </div>
      </nav>

      {/* Content */}
      <main className="hist-page__body">
        {tab === 'todo'
          ? <TodoTab movements={monthMovements} currency={currency} locale={locale} />
          : <ResumenTab movements={monthMovements} allMovements={movements} anchor={monthAnchor} currency={currency} locale={locale} />
        }
      </main>

      {/* Month picker — floats at the foot over the scrolling content, same
          frosted panel as the chat bar on the main screen. Last in the DOM so
          it follows the content in reading and tab order. */}
      <div className="hist-page__month-bar">
        <button
          type="button"
          className="hist-page__step-btn"
          onClick={() => handleStepMonth(-1)}
          aria-label="Mes anterior"
        >
          <ChevronLeft />
        </button>
        <span className="hist-page__month-label" aria-live="polite">
          {monthLabel(monthAnchor)}
        </span>
        <button
          type="button"
          className="hist-page__step-btn"
          onClick={() => handleStepMonth(1)}
          disabled={!canStepForward}
          aria-label="Mes siguiente"
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  )
}
