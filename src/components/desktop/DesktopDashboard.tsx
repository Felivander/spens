import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Movement } from '../../types'
import type { ChatNote } from '../ChatBar'
import { ChevronLeft, ChevronRight, MenuIcon } from '../icons'
import { CommandBar } from './CommandBar'
import { SummaryStrip } from './SummaryStrip'
import { MonthCalendar } from './MonthCalendar'
import { CategoryBreakdown } from './CategoryBreakdown'
import { Ledger, type KindFilter } from './Ledger'
import { fromISODate, isSameMonth, MONTHS, todayISO, WEEKDAYS, weekdayIndex } from '../../lib/dates'
import './desktop.css'
import { debtBalances, isSettled, settleMovement } from '../../lib/debts'
import { formatMoney } from '../../lib/format'

type Patch = Partial<Omit<Movement, 'id' | 'createdAt'>>

export interface DesktopDashboardProps {
  movements: Movement[]
  user: User | null
  currency: string
  locale: string
  onAddFromText: (text: string, targetDate: string) => Promise<{ created: Movement[]; note: ChatNote }>
  onUpdateMovement: (id: string, patch: Patch) => void
  onDeleteMovement: (id: string) => void
  onRestoreMovement: (m: Movement) => void
  onAddMovement: (m: Omit<Movement, 'id' | 'createdAt'>) => void
  onOpenSettings: () => void
  onOpenDebts: () => void
}

/** True when the keystroke belongs to a field, not to the page shortcuts. */
function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
}

export function DesktopDashboard({
  movements,
  user,
  currency,
  locale,
  onAddFromText,
  onUpdateMovement,
  onDeleteMovement,
  onRestoreMovement,
  onAddMovement,
  onOpenSettings,
  onOpenDebts,
}: DesktopDashboardProps) {
  const [anchor, setAnchor] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [person, setPerson] = useState<string | null>(null)
  const [kind, setKind] = useState<KindFilter>('todos')
  const [search, setSearch] = useState('')

  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<ChatNote | null>(null)
  const [undo, setUndo] = useState<Movement | null>(null)
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set())

  const cmdRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // A person filter spans every month — a loan from March is still owed today.
  const monthMovements = useMemo(
    () => movements.filter((m) => isSameMonth(m.date, anchor)),
    [movements, anchor],
  )
  const ledgerMovements = useMemo(
    () => (person ? movements : monthMovements),
    [person, movements, monthMovements],
  )
  const openDebts = useMemo(() => debtBalances(movements).filter((b) => !isSettled(b)), [movements])

  const now = new Date()
  const isCurrentMonth = anchor.getFullYear() === now.getFullYear() && anchor.getMonth() === now.getMonth()
  const monthName = `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`

  const goMonth = useCallback((delta: number | 'today') => {
    setAnchor((a) => (delta === 'today' ? new Date() : new Date(a.getFullYear(), a.getMonth() + delta, 1)))
    setSelectedDay(null)
  }, [])

  const selectDay = (iso: string | null) => {
    setSelectedDay(iso)
    if (iso) cmdRef.current?.focus()
  }

  const submit = async (text: string) => {
    setBusy(true)
    setNote(null)
    setUndo(null)
    const { created, note } = await onAddFromText(text, selectedDay ?? todayISO())
    setNote(note)
    setBusy(false)
    if (created.length === 0) return

    const first = created[0]
    if (!isSameMonth(first.date, anchor)) {
      setAnchor(fromISODate(first.date))
      setSelectedDay(null)
    }
    const ids = new Set(created.map((m) => m.id))
    setFreshIds(ids)
    setTimeout(() => setFreshIds((cur) => (cur === ids ? new Set() : cur)), 1800)
  }

  const remove = (m: Movement) => {
    onDeleteMovement(m.id)
    setUndo(m)
    setNote({ text: `Borrado: ${m.description}.`, tone: 'ok' })
  }

  // Notes fade on their own; an undo offer stays a little longer.
  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => {
      setNote(null)
      setUndo(null)
    }, undo ? 8000 : note.tone === 'error' ? 7000 : 4500)
    return () => clearTimeout(t)
  }, [note, undo])

  // Keyboard: / or Ctrl+K → anotar · F → buscar · [ ] → mes · Esc → limpiar filtros
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        cmdRef.current?.focus()
        return
      }
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === '/') {
        e.preventDefault()
        cmdRef.current?.focus()
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === '[') goMonth(-1)
      else if (e.key === ']') goMonth(1)
      else if (e.key === 'Escape') {
        setSelectedDay(null)
        setCategory(null)
        setPerson(null)
        setKind('todos')
        setSearch('')
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [goMonth])

  const targetLabel = selectedDay && selectedDay !== todayISO()
    ? (() => {
        const d = fromISODate(selectedDay)
        return `${WEEKDAYS[weekdayIndex(d)]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
      })()
    : null

  return (
    <div className="dk">
      <header className="dk-top">
        <span className="dk-top__brand">Spens</span>

        <nav className="dk-month" aria-label="Mes">
          <button type="button" className="dk-icon" onClick={() => goMonth(-1)} aria-label="Mes anterior" title="Mes anterior  ( [ )">
            <ChevronLeft size={16} />
          </button>
          <h1 className="dk-month__label">{monthName}</h1>
          <button type="button" className="dk-icon" onClick={() => goMonth(1)} aria-label="Mes siguiente" title="Mes siguiente  ( ] )">
            <ChevronRight size={16} />
          </button>
          <button type="button" className="dk-btn" disabled={isCurrentMonth} onClick={() => goMonth('today')}>
            Hoy
          </button>
        </nav>

        <CommandBar
          ref={cmdRef}
          busy={busy}
          note={note}
          noteAction={undo ? { label: 'Deshacer', run: () => { onRestoreMovement(undo); setUndo(null); setNote(null) } } : null}
          targetLabel={targetLabel}
          onClearTarget={() => setSelectedDay(null)}
          onSubmit={(t) => void submit(t)}
        />

        <span className={`dk-sync${user ? ' dk-sync--on' : ''}`} title={user ? `Sincronizado como ${user.email ?? ''}` : 'Solo en este dispositivo'}>
          {user ? 'Sincronizado' : 'Local'}
        </span>
        <button type="button" className="dk-icon" onClick={onOpenSettings} aria-label="Ajustes" title="Ajustes">
          <MenuIcon size={16} />
        </button>
      </header>

      <SummaryStrip
        movements={movements}
        anchor={anchor}
        currency={currency}
        locale={locale}
        onOpenDebts={onOpenDebts}
      />

      <div className="dk-body">
        <Ledger
          ref={searchRef}
          movements={ledgerMovements}
          selectedDay={selectedDay}
          category={category}
          person={person}
          onClearPerson={() => setPerson(null)}
          kind={kind}
          search={search}
          onSearch={setSearch}
          onKind={setKind}
          onClearDay={() => setSelectedDay(null)}
          onClearCategory={() => setCategory(null)}
          freshIds={freshIds}
          currency={currency}
          locale={locale}
          monthName={monthName}
          onUpdate={onUpdateMovement}
          onDelete={remove}
        />

        <aside className="dk-side">
          <section className="dk-panel">
            <h2 className="dk-panel__title">
              Días
              {selectedDay && (
                <button type="button" className="dk-link" onClick={() => setSelectedDay(null)}>
                  Ver mes
                </button>
              )}
            </h2>
            <MonthCalendar
              anchor={anchor}
              movements={monthMovements}
              selectedDay={selectedDay}
              onSelectDay={selectDay}
              locale={locale}
            />
          </section>

          {openDebts.length > 0 && (
            <section className="dk-panel">
              <h2 className="dk-panel__title">
                Préstamos
                <button type="button" className="dk-link" onClick={onOpenDebts}>
                  Ver todo
                </button>
              </h2>
              <ul className="dk-cats">
                {openDebts.map((b) => (
                  <li key={b.key} className="dk-debt">
                    <button
                      type="button"
                      className={`dk-cats__row${person === b.key ? ' dk-cats__row--on' : ''}`}
                      aria-pressed={person === b.key}
                      onClick={() => {
                        const next = person === b.key ? null : b.key
                        setPerson(next)
                        // Loans can be months old: show them all, not just this month.
                        if (next) setKind('prestamos')
                      }}
                      title={b.net > 0 ? `${b.name} te debe` : `Le debés a ${b.name}`}
                    >
                      <span className="dk-cats__name">{b.name}</span>
                      <span className="dk-cats__pct">{b.net > 0 ? 'te debe' : 'debés'}</span>
                      <span className={`dk-cats__amt${b.net > 0 ? ' dk-pos' : ''}`}>
                        {formatMoney(Math.abs(b.net), currency, locale)}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="dk-btn dk-debt__settle"
                      onClick={() => {
                        onAddMovement(settleMovement(b, todayISO()))
                        setNote({ text: `Saldado con ${b.name}.`, tone: 'ok' })
                      }}
                      title={`Registrar que se saldó la deuda con ${b.name}`}
                    >
                      Saldar
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="dk-panel">
            <h2 className="dk-panel__title">
              Categorías
              {category && (
                <button type="button" className="dk-link" onClick={() => setCategory(null)}>
                  Todas
                </button>
              )}
            </h2>
            <CategoryBreakdown
              movements={selectedDay ? monthMovements.filter((m) => m.date === selectedDay) : monthMovements}
              active={category}
              onSelect={setCategory}
              currency={currency}
              locale={locale}
            />
          </section>

          <p className="dk-keys">
            <kbd className="dk-kbd">/</kbd> anotar · <kbd className="dk-kbd">F</kbd> buscar ·{' '}
            <kbd className="dk-kbd">[</kbd><kbd className="dk-kbd">]</kbd> mes · <kbd className="dk-kbd">Esc</kbd> limpiar
          </p>
        </aside>
      </div>
    </div>
  )
}
