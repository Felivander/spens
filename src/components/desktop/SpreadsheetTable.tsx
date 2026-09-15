import { useState, useMemo } from 'react'
import type { Movement, Kind } from '../../types'
import { formatMoney } from '../../lib/format'
import { CATEGORIES } from '../../lib/categories'
import { timeLabel, fromISODate, MONTHS, WEEKDAYS, weekdayIndex } from '../../lib/dates'
import { TrashIcon } from '../icons'

export interface SpreadsheetTableProps {
  movements: Movement[]
  selectedDay: string | null
  onClearDayFilter: () => void
  currency: string
  locale: string
  onUpdateCategory: (id: string, category: string) => void
  onUpdateMovement: (id: string, patch: Partial<Omit<Movement, 'id' | 'createdAt'>>) => void
  onDeleteMovement: (id: string) => void
}

const CATEGORY_GLYPHS: Record<string, string> = {
  Comida: '🍔',
  Transporte: '🚗',
  Hogar: '🏠',
  Salud: '💊',
  Mascotas: '🐾',
  Ocio: '🎟️',
  Compras: '🛍️',
  Servicios: '💡',
  Trabajo: '💼',
  Otros: '🏷️',
}

export function SpreadsheetTable({
  movements,
  selectedDay,
  onClearDayFilter,
  currency,
  locale,
  onUpdateCategory,
  onUpdateMovement,
  onDeleteMovement,
}: SpreadsheetTableProps) {
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [openCatId, setOpenCatId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<{ id: string; field: 'desc' | 'amt' } | null>(null)
  const [editValue, setEditValue] = useState('')

  // Filter movements
  const filtered = useMemo(() => {
    let list = movements

    if (selectedDay) {
      list = list.filter((m) => m.date === selectedDay)
    }

    if (catFilter !== 'all') {
      list = list.filter((m) => m.category === catFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (m) =>
          m.description.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q),
      )
    }

    // Default sort by date descending, then createdAt descending
    return [...list].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return b.createdAt - a.createdAt
    })
  }, [movements, selectedDay, catFilter, search])

  const handleStartEdit = (id: string, field: 'desc' | 'amt', current: string) => {
    setEditingField({ id, field })
    setEditValue(current)
  }

  const handleSaveEdit = () => {
    if (!editingField) return
    const { id, field } = editingField
    if (field === 'desc') {
      const val = editValue.trim()
      if (val) onUpdateMovement(id, { description: val })
    } else {
      const parsed = parseFloat(editValue.replace(',', '.'))
      if (!isNaN(parsed) && parsed > 0) {
        onUpdateMovement(id, { amount: parsed })
      }
    }
    setEditingField(null)
  }

  const handleToggleKind = (m: Movement) => {
    const nextKind: Kind = m.kind === 'gasto' ? 'ingreso' : 'gasto'
    onUpdateMovement(m.id, { kind: nextKind })
  }

  return (
    <div className="desk-sheet">
      <div className="desk-sheet__toolbar">
        <input
          type="search"
          className="desk-sheet__search"
          placeholder="Buscar gastos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="desk-sheet__cat-select"
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
        >
          <option value="all">Todas las categorías</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_GLYPHS[c] ?? '🏷️'} {c}
            </option>
          ))}
        </select>

        {selectedDay && (
          <div className="desk-sheet__day-pill">
            <span>Día: {selectedDay}</span>
            <button
              type="button"
              className="desk-sheet__clear-btn"
              onClick={onClearDayFilter}
              title="Quitar filtro de día"
            >
              ×
            </button>
          </div>
        )}

        <span className="desk-sheet__count">
          {filtered.length} {filtered.length === 1 ? 'movimiento' : 'movimientos'}
        </span>
      </div>

      <div className="desk-sheet__table-wrap">
        <table className="desk-sheet__table">
          <thead>
            <tr>
              <th style={{ width: '16%' }}>Fecha</th>
              <th style={{ width: '12%' }}>Tipo</th>
              <th style={{ width: '32%' }}>Descripción</th>
              <th style={{ width: '22%' }}>Categoría</th>
              <th style={{ width: '14%', textAlign: 'right' }}>Monto</th>
              <th style={{ width: '4%' }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="desk-sheet__empty">
                  No hay movimientos para los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filtered.map((m) => {
                const d = fromISODate(m.date)
                const dateText = `${WEEKDAYS[weekdayIndex(d)].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
                const timeText = timeLabel(m.createdAt)
                const isEditingDesc = editingField?.id === m.id && editingField?.field === 'desc'
                const isEditingAmt = editingField?.id === m.id && editingField?.field === 'amt'
                const isCatOpen = openCatId === m.id

                return (
                  <tr key={m.id} className="desk-sheet__row">
                    <td className="desk-sheet__cell-date">
                      <span>{dateText}</span>
                      <small className="desk-sheet__cell-time">{timeText}</small>
                    </td>

                    <td>
                      <button
                        type="button"
                        className={`desk-sheet__kind-pill desk-sheet__kind-pill--${m.kind}`}
                        onClick={() => handleToggleKind(m)}
                        title="Clic para cambiar entre Gasto e Ingreso"
                      >
                        {m.kind === 'ingreso' ? '+ Ingreso' : '− Gasto'}
                      </button>
                    </td>

                    <td>
                      {isEditingDesc ? (
                        <input
                          autoFocus
                          type="text"
                          className="desk-sheet__inline-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit()
                            if (e.key === 'Escape') setEditingField(null)
                          }}
                        />
                      ) : (
                        <span
                          className="desk-sheet__editable"
                          onClick={() => handleStartEdit(m.id, 'desc', m.description)}
                          title="Clic para editar descripción"
                        >
                          {m.description}
                        </span>
                      )}
                    </td>

                    <td className="desk-sheet__cell-cat">
                      <button
                        type="button"
                        className="desk-sheet__cat-btn"
                        onClick={() => setOpenCatId(isCatOpen ? null : m.id)}
                      >
                        {CATEGORY_GLYPHS[m.category] ?? '🏷️'} {m.category}
                      </button>

                      {isCatOpen && (
                        <div className="desk-sheet__cat-menu">
                          {CATEGORIES.map((c) => (
                            <button
                              key={c}
                              type="button"
                              className="desk-sheet__cat-option"
                              onClick={() => {
                                onUpdateCategory(m.id, c)
                                setOpenCatId(null)
                              }}
                            >
                              <span>{CATEGORY_GLYPHS[c] ?? '🏷️'}</span> {c}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      {isEditingAmt ? (
                        <input
                          autoFocus
                          type="number"
                          step="any"
                          className="desk-sheet__inline-input desk-sheet__inline-input--amt"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit()
                            if (e.key === 'Escape') setEditingField(null)
                          }}
                        />
                      ) : (
                        <span
                          className={`desk-sheet__amt desk-sheet__editable${
                            m.kind === 'ingreso' ? ' desk-sheet__amt--pos' : ''
                          }`}
                          onClick={() => handleStartEdit(m.id, 'amt', String(m.amount))}
                          title="Clic para editar monto"
                        >
                          {m.kind === 'ingreso' ? '+' : '−'}
                          {formatMoney(m.amount, currency, locale)}
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="desk-sheet__del-btn"
                        onClick={() => onDeleteMovement(m.id)}
                        title="Eliminar movimiento"
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
