import { useEffect, useMemo, useRef, useState } from 'react'
import { debtBalances, isSettled, type DebtBalance } from '../lib/debts'
import { fromISODate, MONTHS } from '../lib/dates'
import { formatMoney, formatSigned } from '../lib/format'
import { useDragToClose } from '../lib/useDragToClose'
import type { Movement } from '../types'
import { CloseIcon } from './icons'

interface Props {
  movements: Movement[]
  currency: string
  locale: string
  onSettle: (balance: DebtBalance) => void
  onClose: () => void
}

const shortDate = (iso: string) => {
  const d = fromISODate(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
}

/** Who owes whom, per person, with a one-tap "Saldar". */
export function DebtsSheet({ movements, currency, locale, onSettle, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const gripRef = useRef<HTMLDivElement>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [showSettled, setShowSettled] = useState(false)

  useDragToClose(sheetRef, onClose, 'down', scrimRef, gripRef)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    sheetRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const balances = useMemo(() => debtBalances(movements), [movements])
  const open = balances.filter((b) => !isSettled(b))
  const settled = balances.filter(isSettled)
  const owedToMe = open.reduce((s, b) => s + Math.max(0, b.net), 0)
  const iOwe = open.reduce((s, b) => s + Math.max(0, -b.net), 0)

  const money = (v: number) => formatMoney(v, currency, locale)

  const row = (b: DebtBalance) => {
    const isOpen = openKey === b.key
    const done = isSettled(b)
    return (
      <li key={b.key} className="debt">
        <button
          type="button"
          className="debt__main"
          aria-expanded={isOpen}
          onClick={() => setOpenKey(isOpen ? null : b.key)}
        >
          <span className="debt__text">
            <span className="debt__name">{b.name}</span>
            <span className="debt__meta">
              {done ? 'Saldado' : b.net > 0 ? 'Te debe' : 'Le debés'} · {shortDate(b.lastDate)}
            </span>
          </span>
          {!done && (
            <span className={`debt__amount${b.net > 0 ? ' debt__amount--in' : ''}`}>
              {money(Math.abs(b.net))}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="debt__detail">
            <ul className="debt__items">
              {[...b.items].reverse().map((m) => (
                <li key={m.id} className="debt__item">
                  <span>{shortDate(m.date)}</span>
                  <span className="debt__item-desc">{m.description}</span>
                  <span className="tnum">{formatSigned(m.amount, m.kind, currency, locale)}</span>
                </li>
              ))}
            </ul>
            {!done && (
              <button type="button" className="debt__settle" onClick={() => onSettle(b)}>
                {b.net > 0 ? `Me devolvió ${money(b.net)}` : `Le devolví ${money(-b.net)}`} · Saldar
              </button>
            )}
          </div>
        )}
      </li>
    )
  }

  return (
    <>
      <div className="scrim" ref={scrimRef} onClick={onClose} aria-hidden="true" />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="debts-title"
        tabIndex={-1}
        ref={sheetRef}
      >
        <div className="sheet__header" ref={gripRef}>
          <div className="sheet__grip" aria-hidden="true" />
          <div className="sheet__head">
            <h2 className="sheet__title" id="debts-title">
              Préstamos
            </h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar préstamos">
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="sheet__body">
          <div className="hist__totals">
            <div className="hist__total-item">
              <span className="hist__total-label">Te deben</span>
              <span className="hist__total-value hist__total-value--in">{money(owedToMe)}</span>
            </div>
            <div className="hist__total-divider" />
            <div className="hist__total-item">
              <span className="hist__total-label">Debés</span>
              <span className="hist__total-value">{money(iOwe)}</span>
            </div>
          </div>

          {balances.length === 0 ? (
            <div className="debts__empty">
              <p>Todavía no anotaste préstamos.</p>
              <p className="debts__hint">
                Escribilo como cualquier gasto: <code>le presté 20k a Juan</code>,{' '}
                <code>Juan me devolvió 5k</code> o <code>Pedro me prestó 10k</code>.
              </p>
            </div>
          ) : (
            <>
              {open.length > 0 ? (
                <ul className="debts">{open.map(row)}</ul>
              ) : (
                <p className="debts__empty">Nadie te debe y no le debés a nadie.</p>
              )}

              {settled.length > 0 && (
                <>
                  <button
                    type="button"
                    className="debts__toggle"
                    aria-expanded={showSettled}
                    onClick={() => setShowSettled((v) => !v)}
                  >
                    {showSettled ? 'Ocultar' : 'Ver'} saldados ({settled.length})
                  </button>
                  {showSettled && <ul className="debts debts--settled">{settled.map(row)}</ul>}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
