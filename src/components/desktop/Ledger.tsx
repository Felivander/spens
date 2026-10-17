import { forwardRef, Fragment, useMemo, useRef, useState } from 'react'
import { CATEGORIES } from '../../lib/categories'
import { fromISODate, MONTHS, timeLabel, todayISO, toISODate, addDays, WEEKDAYS, weekdayIndex } from '../../lib/dates'
import { formatMoney, formatSigned, parseAmountInput } from '../../lib/format'
import type { Kind, Movement } from '../../types'
import { CloseIcon, TrashIcon } from '../icons'
import { isDebt, personKey } from '../../lib/debts'

export type KindFilter = 'todos' | Kind | 'prestamos'
type SortKey = 'date' | 'description' | 'category' | 'amount'
type Patch = Partial<Omit<Movement, 'id' | 'createdAt'>>

interface Props {
  /** Movements of the anchored month. Filters are applied here. */
  movements: Movement[]
  selectedDay: string | null
  category: string | null
  /** personKey of the person to show, or null. */
  person: string | null
  onClearPerson: () => void
  kind: KindFilter
  search: string
  onSearch: (q: string) => void
  onKind: (k: KindFilter) => void
  onClearDay: () => void
  onClearCategory: () => void
  freshIds: Set<string>
  currency: string
  locale: string
  monthName: string
  onUpdate: (id: string, patch: Patch) => void
  onDelete: (m: Movement) => void
}

function dayHeading(iso: string): string {
  const today = todayISO()
  if (iso === today) return 'Hoy'
  if (iso === toISODate(addDays(new Date(), -1))) return 'Ayer'
  const d = fromISODate(iso)
  return `${WEEKDAYS[weekdayIndex(d)]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
}

function shortDay(iso: string): string {
  const d = fromISODate(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function downloadCSV(rows: Movement[], name: string) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const lines = [
    'fecha;tipo;descripcion;categoria;persona;monto',
    ...rows.map((m) =>
      [m.date, m.kind, esc(m.description), esc(m.category), esc(m.person ?? ''), (m.kind === 'gasto' ? -m.amount : m.amount).toString().replace('.', ',')].join(';'),
    ),
  ]
  // BOM so Excel opens accents correctly.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `spens-${name}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export const Ledger = forwardRef<HTMLInputElement, Props>(function Ledger(
  {
    movements,
    selectedDay,
    category,
    person,
    onClearPerson,
    kind,
    search,
    onSearch,
    onKind,
    onClearDay,
    onClearCategory,
    freshIds,
    currency,
    locale,
    monthName,
    onUpdate,
    onDelete,
  },
  searchRef,
) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'date', dir: -1 })
  const [editing, setEditing] = useState<{ id: string; field: 'description' | 'amount' | 'date' | 'person' } | null>(null)
  const [draft, setDraft] = useState('')
  /** Escape unmounts the input; a blur fired on removal must not save. */
  const cancelled = useRef(false)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = movements.filter(
      (m) =>
        (!selectedDay || m.date === selectedDay) &&
        (!category || m.category === category) &&
        (!person || (m.person !== undefined && personKey(m.person) === person)) &&
        (kind === 'todos' ||
          (kind === 'prestamos' ? isDebt(m) : m.kind === kind && !isDebt(m))) &&
        (!q ||
          m.description.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q) ||
          (m.person ?? '').toLowerCase().includes(q)),
    )
    const { key, dir } = sort
    return list.sort((a, b) => {
      let c = 0
      if (key === 'amount') c = a.amount - b.amount
      else if (key === 'description') c = a.description.localeCompare(b.description, 'es')
      else if (key === 'category') c = a.category.localeCompare(b.category, 'es')
      if (c === 0) c = a.date.localeCompare(b.date) || a.createdAt - b.createdAt
      return c * dir
    })
  }, [movements, selectedDay, category, person, kind, search, sort])

  const totals = useMemo(() => {
    let out = 0
    let inc = 0
    for (const m of rows) {
      if (isDebt(m)) continue
      if (m.kind === 'gasto') out += m.amount
      else inc += m.amount
    }
    return { out, inc, net: inc - out }
  }, [rows])

  // Day subtotals only make sense when rows are in date order.
  const grouped = sort.key === 'date'
  const dayNets = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of rows) {
      if (isDebt(m)) continue
      map[m.date] = (map[m.date] ?? 0) + (m.kind === 'ingreso' ? m.amount : -m.amount)
    }
    return map
  }, [rows])

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'date' || key === 'amount' ? -1 : 1 }))

  const startEdit = (m: Movement, field: 'description' | 'amount' | 'date' | 'person') => {
    cancelled.current = false
    setEditing({ id: m.id, field })
    setDraft(
      field === 'amount'
        ? String(m.amount).replace('.', ',')
        : field === 'date'
          ? m.date
          : field === 'person'
            ? (m.person ?? '')
            : m.description,
    )
  }

  const commit = () => {
    if (!editing || cancelled.current) return
    const { id, field } = editing
    if (field === 'description' && draft.trim()) onUpdate(id, { description: draft.trim() })
    if (field === 'person' && draft.trim()) onUpdate(id, { person: draft.trim() })
    if (field === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(draft)) onUpdate(id, { date: draft })
    if (field === 'amount') {
      const n = parseAmountInput(draft)
      if (n > 0) onUpdate(id, { amount: n })
    }
    setEditing(null)
  }

  const editKeys = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') {
      cancelled.current = true
      setEditing(null)
    }
  }

  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : '')
  const hasFilters = Boolean(selectedDay || category || person || kind !== 'todos' || search)
  const personName = person
    ? movements.find((m) => m.person && personKey(m.person) === person)?.person ?? person
    : null

  let lastDay = ''

  return (
    <section className="dk-ledger" aria-label="Movimientos">
      <div className="dk-ledger__bar">
        <input
          ref={searchRef}
          type="search"
          className="dk-input dk-ledger__search"
          placeholder="Buscar  (F)"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onSearch('')
              e.currentTarget.blur()
            }
          }}
        />
        <div className="dk-seg" role="group" aria-label="Tipo">
          {(['todos', 'gasto', 'ingreso', 'prestamos'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => onKind(k)}>
              {k === 'todos' ? 'Todos' : k === 'gasto' ? 'Gastos' : k === 'ingreso' ? 'Ingresos' : 'Préstamos'}
            </button>
          ))}
        </div>
        {selectedDay && (
          <span className="dk-chip">
            {dayHeading(selectedDay)}
            <button type="button" onClick={onClearDay} aria-label="Quitar filtro de día">
              <CloseIcon size={12} strokeWidth={2} />
            </button>
          </span>
        )}
        {personName && (
          <span className="dk-chip">
            {personName}
            <button type="button" onClick={onClearPerson} aria-label="Quitar filtro de persona">
              <CloseIcon size={12} strokeWidth={2} />
            </button>
          </span>
        )}
        {category && (
          <span className="dk-chip">
            {category}
            <button type="button" onClick={onClearCategory} aria-label="Quitar filtro de categoría">
              <CloseIcon size={12} strokeWidth={2} />
            </button>
          </span>
        )}
        <span className="dk-ledger__totals tnum">
          {rows.length} mov · <span>−{formatMoney(totals.out, currency, locale)}</span>
          {totals.inc > 0 && <span className="dk-pos"> +{formatMoney(totals.inc, currency, locale)}</span>}
        </span>
        <button
          type="button"
          className="dk-btn"
          disabled={rows.length === 0}
          onClick={() => downloadCSV(rows, monthName.replace(/\s+/g, '-'))}
          title="Descargar las filas visibles como CSV"
        >
          CSV
        </button>
      </div>

      <div className="dk-ledger__scroll">
        <table className="dk-table">
          <colgroup>
            <col style={{ inlineSize: '7rem' }} />
            <col />
            <col style={{ inlineSize: '9.5rem' }} />
            <col style={{ inlineSize: '2.75rem' }} />
            <col style={{ inlineSize: '8.5rem' }} />
            <col style={{ inlineSize: '2.5rem' }} />
          </colgroup>
          <thead>
            <tr>
              <th><button type="button" onClick={() => toggleSort('date')}>Fecha{arrow('date')}</button></th>
              <th><button type="button" onClick={() => toggleSort('description')}>Descripción{arrow('description')}</button></th>
              <th><button type="button" onClick={() => toggleSort('category')}>Categoría{arrow('category')}</button></th>
              <th title="Tipo">±</th>
              <th className="dk-num"><button type="button" onClick={() => toggleSort('amount')}>Monto{arrow('amount')}</button></th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="dk-table__empty">
                  {movements.length === 0 ? (
                    <>
                      Sin movimientos en {monthName}. Escribí arriba, por ejemplo <code>café 1.200</code> o{' '}
                      <code>cobré 180k ayer</code>, y apretá Enter.
                    </>
                  ) : hasFilters ? (
                    'Nada coincide con los filtros.'
                  ) : null}
                </td>
              </tr>
            )}

            {rows.map((m) => {
              const isEd = (f: string) => editing?.id === m.id && editing.field === f
              const header = grouped && m.date !== lastDay && !selectedDay
              lastDay = m.date
              return (
                <Fragment key={m.id}>
                  {header && (
                    <tr className="dk-table__day">
                      <td colSpan={4}>{dayHeading(m.date)}</td>
                      <td className="dk-num tnum">{formatMoney(dayNets[m.date], currency, locale)}</td>
                      <td />
                    </tr>
                  )}
                  <tr className={`dk-table__row${freshIds.has(m.id) ? ' dk-table__row--fresh' : ''}`}>
                    <td className="dk-table__date tnum">
                      {isEd('date') ? (
                        <input
                          autoFocus
                          type="date"
                          className="dk-cell-input"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={commit}
                          onKeyDown={editKeys}
                        />
                      ) : (
                        <button type="button" className="dk-cell" onClick={() => startEdit(m, 'date')} title="Cambiar fecha">
                          {shortDay(m.date)} <small>{timeLabel(m.createdAt)}</small>
                        </button>
                      )}
                    </td>
                    <td>
                      {isEd('description') ? (
                        <input
                          autoFocus
                          className="dk-cell-input"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={commit}
                          onKeyDown={editKeys}
                        />
                      ) : (
                        <button type="button" className="dk-cell dk-cell--text" onClick={() => startEdit(m, 'description')} title={m.description}>
                          {m.description}
                        </button>
                      )}
                    </td>
                    <td>
                      {isDebt(m) ? (
                        isEd('person') ? (
                          <input
                            autoFocus
                            className="dk-cell-input"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={commit}
                            onKeyDown={editKeys}
                            aria-label="Persona"
                          />
                        ) : (
                          <button
                            type="button"
                            className="dk-cell dk-cell--person"
                            onClick={() => startEdit(m, 'person')}
                            title={m.kind === 'gasto' ? `Le diste plata a ${m.person}` : `${m.person} te dio plata`}
                          >
                            {m.kind === 'gasto' ? '→' : '←'} {m.person}
                          </button>
                        )
                      ) : (
                      <select
                        className="dk-cell dk-cell--select"
                        value={m.category}
                        onChange={(e) => onUpdate(m.id, { category: e.target.value })}
                        aria-label="Categoría"
                      >
                        {!(CATEGORIES as readonly string[]).includes(m.category) && <option>{m.category}</option>}
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`dk-kind dk-kind--${m.kind}`}
                        onClick={() => onUpdate(m.id, { kind: m.kind === 'gasto' ? 'ingreso' : 'gasto' })}
                        title={m.kind === 'gasto' ? 'Gasto — clic para pasar a ingreso' : 'Ingreso — clic para pasar a gasto'}
                      >
                        {m.kind === 'gasto' ? '−' : '+'}
                      </button>
                    </td>
                    <td className="dk-num">
                      {isEd('amount') ? (
                        <input
                          autoFocus
                          inputMode="decimal"
                          className="dk-cell-input dk-num"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={commit}
                          onKeyDown={editKeys}
                        />
                      ) : (
                        <button
                          type="button"
                          className={`dk-cell dk-num tnum${m.kind === 'ingreso' ? ' dk-pos' : ''}`}
                          onClick={() => startEdit(m, 'amount')}
                        >
                          {formatSigned(m.amount, m.kind, currency, locale)}
                        </button>
                      )}
                    </td>
                    <td>
                      <button type="button" className="dk-del" onClick={() => onDelete(m)} aria-label="Borrar" title="Borrar">
                        <TrashIcon size={15} />
                      </button>
                    </td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
})
