import React, { useState, useMemo, useRef, useEffect } from 'react'
import type { Movement, Kind } from '../../types'
import { formatMoney } from '../../lib/format'
import { CATEGORIES, guessCategory, type Category } from '../../lib/categories'
import { timeLabel, fromISODate, MONTHS, WEEKDAYS, weekdayIndex, todayISO } from '../../lib/dates'
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
  onAddMovement: (movement: Omit<Movement, 'id' | 'createdAt'>) => void
  quickAddDay: string | null
  onSetQuickAddDay: (day: string | null) => void
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
  onAddMovement,
  quickAddDay,
  onSetQuickAddDay,
}: SpreadsheetTableProps) {
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [openCatId, setOpenCatId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<{ id: string; field: 'desc' | 'amt' } | null>(null)
  const [editValue, setEditValue] = useState('')

  // Quick-add form state
  const [newDesc, setNewDesc] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newKind, setNewKind] = useState<Kind>('gasto')
  const [newCategory, setNewCategory] = useState<Category>('Comida')
  const [userPickedCategory, setUserPickedCategory] = useState(false)
  const descInputRef = useRef<HTMLInputElement>(null)

  // Focus description input when quick add is opened
  useEffect(() => {
    if (quickAddDay) {
      descInputRef.current?.focus()
      setUserPickedCategory(false)
    }
  }, [quickAddDay])

  // Automatically guess category while typing unless manually chosen
  const handleDescChange = (val: string) => {
    setNewDesc(val)
    if (!userPickedCategory && val.trim().length > 1) {
      const guessed = guessCategory(val, newKind)
      setNewCategory(guessed)
    }
  }

  const handleCreateMovement = (e: React.FormEvent) => {
    e.preventDefault()
    const desc = newDesc.trim()
    const amt = parseFloat(newAmount.replace(',', '.'))
    if (!desc || isNaN(amt) || amt <= 0) return

    const dateToUse = quickAddDay || selectedDay || todayISO()

    onAddMovement({
      date: dateToUse,
      description: desc,
      amount: amt,
      category: newCategory,
      kind: newKind,
    })

    // Reset form
    setNewDesc('')
    setNewAmount('')
    setUserPickedCategory(false)
    onSetQuickAddDay(null)
  }

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

  // Label for the day in quick-add
  const targetDayISO = quickAddDay || selectedDay
  const targetDayLabel = targetDayISO
    ? `${fromISODate(targetDayISO).getDate()} de ${MONTHS[fromISODate(targetDayISO).getMonth()]}`
    : 'Hoy'

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

        <button
          type="button"
          className="desk-sheet__add-trigger-btn"
          onClick={() => onSetQuickAddDay(selectedDay || todayISO())}
        >
          + Nuevo gasto
        </button>

        <span className="desk-sheet__count">
          {filtered.length} {filtered.length === 1 ? 'movimiento' : 'movimientos'}
        </span>
      </div>

      {/* Quick add bar for the selected date */}
      {quickAddDay && (
        <form className="desk-sheet__quick-add" onSubmit={handleCreateMovement}>
          <div className="desk-sheet__quick-add-badge">
            <span>📅 {targetDayLabel}</span>
          </div>

          <input
            ref={descInputRef}
            type="text"
            className="desk-sheet__quick-desc"
            placeholder="Descripción (ej: Supermercado, Almuerzo...)"
            value={newDesc}
            onChange={(e) => handleDescChange(e.target.value)}
            required
          />

          <input
            type="number"
            step="any"
            className="desk-sheet__quick-amt"
            placeholder="Monto"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            required
          />

          <select
            className="desk-sheet__cat-select"
            value={newCategory}
            onChange={(e) => {
              setNewCategory(e.target.value as Category)
              setUserPickedCategory(true)
            }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_GLYPHS[c] ?? '🏷️'} {c}
              </option>
            ))}
          </select>

          <select
            className="desk-sheet__cat-select"
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as Kind)}
          >
            <option value="gasto">Gasto</option>
            <option value="ingreso">Ingreso</option>
          </select>

          <div className="desk-sheet__quick-actions">
            <button type="submit" className="desk-sheet__quick-save-btn">
              Guardar
            </button>
            <button
              type="button"
              className="desk-sheet__quick-cancel-btn"
              onClick={() => onSetQuickAddDay(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

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
                  {selectedDay ? (
                    <div>
                      <p>No hay movimientos registrados para el {targetDayLabel}.</p>
                      <button
                        type="button"
                        className="desk-sheet__add-trigger-btn"
                        style={{ marginBlockStart: '0.75rem' }}
                        onClick={() => onSetQuickAddDay(selectedDay)}
                      >
                        + Agregar gasto el {targetDayLabel}
                      </button>
                    </div>
                  ) : (
                    'No hay movimientos para los filtros seleccionados.'
                  )}
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
