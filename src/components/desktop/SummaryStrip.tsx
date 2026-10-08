import { useMemo } from 'react'
import { fromISODate, MONTHS } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import type { Movement } from '../../types'

interface Props {
  movements: Movement[]
  anchor: Date
  currency: string
  locale: string
}

/**
 * One dense row of figures for the viewed month. The comparison against the
 * previous month is cut at the same day-of-month while the month is still
 * running, so day 7 is never judged against a full 30-day month.
 */
export function SummaryStrip({ movements, anchor, currency, locale }: Props) {
  const s = useMemo(() => {
    const now = new Date()
    const y = anchor.getFullYear()
    const mo = anchor.getMonth()
    const isCurrent = y === now.getFullYear() && mo === now.getMonth()
    const isFuture = new Date(y, mo, 1) > now
    const cutDay = isCurrent ? now.getDate() : 31
    const prev = new Date(y, mo - 1, 1)

    let balance = 0
    let gastos = 0
    let ingresos = 0
    let prevGastos = 0
    let count = 0

    for (const m of movements) {
      balance += m.kind === 'ingreso' ? m.amount : -m.amount
      const d = fromISODate(m.date)
      if (d.getFullYear() === y && d.getMonth() === mo) {
        count += 1
        if (m.kind === 'gasto') gastos += m.amount
        else ingresos += m.amount
      } else if (
        m.kind === 'gasto' &&
        d.getFullYear() === prev.getFullYear() &&
        d.getMonth() === prev.getMonth() &&
        d.getDate() <= cutDay
      ) {
        prevGastos += m.amount
      }
    }

    const daysInMonth = new Date(y, mo + 1, 0).getDate()
    const elapsed = isFuture ? 0 : isCurrent ? now.getDate() : daysInMonth

    return {
      balance,
      gastos,
      ingresos,
      net: ingresos - gastos,
      count,
      perDay: elapsed ? gastos / elapsed : null,
      projected: isCurrent && elapsed ? (gastos / elapsed) * daysInMonth : null,
      delta: prevGastos > 0 ? (gastos - prevGastos) / prevGastos : null,
      prevLabel: MONTHS[prev.getMonth()].slice(0, 3),
      isCurrent,
    }
  }, [movements, anchor])

  const money = (v: number) => formatMoney(v, currency, locale)

  return (
    <dl className="dk-summary">
      <div className="dk-stat">
        <dt>Saldo actual</dt>
        <dd className={s.balance >= 0 ? '' : 'dk-neg'}>{money(s.balance)}</dd>
      </div>
      <div className="dk-stat">
        <dt>Gastos</dt>
        <dd>
          {money(s.gastos)}
          {s.delta !== null && (
            <small className="dk-stat__sub" title={`vs. ${s.prevLabel}${s.isCurrent ? ' al mismo día' : ''}`}>
              {s.delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(s.delta * 100))}% vs {s.prevLabel}
            </small>
          )}
        </dd>
      </div>
      <div className="dk-stat">
        <dt>Ingresos</dt>
        <dd className="dk-pos">{money(s.ingresos)}</dd>
      </div>
      <div className="dk-stat">
        <dt>Neto</dt>
        <dd className={s.net > 0 ? 'dk-pos' : s.net < 0 ? 'dk-neg' : ''}>{money(s.net)}</dd>
      </div>
      <div className="dk-stat">
        <dt>Gasto / día</dt>
        <dd>{s.perDay === null ? '—' : money(Math.round(s.perDay))}</dd>
      </div>
      {s.projected !== null && (
        <div className="dk-stat">
          <dt>Proyección mes</dt>
          <dd>{money(Math.round(s.projected))}</dd>
        </div>
      )}
      <div className="dk-stat">
        <dt>Movimientos</dt>
        <dd>{s.count}</dd>
      </div>
    </dl>
  )
}
