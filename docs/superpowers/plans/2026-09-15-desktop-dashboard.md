# Spens Desktop Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a comprehensive desktop dashboard view for Spens (active on `>= 1024px`) featuring a conversational sidebar, monthly metric cards, an interactive calendar with day-level filtering, and an editable spreadsheet-style movement table, while preserving 100% of the mobile interface.

**Architecture:** A responsive layout split where `< 1024px` maintains the single-column mobile view, and `>= 1024px` renders `.desktop-root` with a fixed 380px left sidebar (`.desktop-sidebar` containing the current chat, balance, and quick feed) alongside a flexible `.desktop-main` containing `DesktopDashboard`. Shared reactive state in `App.tsx` ensures instant two-way synchronization between chat entries, calendar badges, and table rows.

**Tech Stack:** React 18, TypeScript, Vite, CSS OKLCH design tokens, standard Web APIs (Intl, localStorage).

## Global Constraints

- Mobile experience (`< 1024px`) must remain completely unaffected, lightweight and fast.
- Design must strictly follow Spens Dieter Rams/Braun minimalist aesthetic (OKLCH warm palette, Helvetica/sans-serif, 1px structural rules, orange `--accent-text`, zero artificial drop shadows).
- All mutations (add, edit description/amount/category, delete) must update `movements` in `App.tsx` and sync with Supabase if logged in.
- No external UI library dependencies (e.g. no Tailwind, no Material UI); use vanilla CSS aligned with `src/app.css` and `src/index.css`.

---

### Task 1: Desktop Shell and Responsive Layout Scaffolding

**Files:**
- Create: `src/components/desktop/DesktopDashboard.tsx`
- Modify: `src/App.tsx:250-355`
- Modify: `src/app.css:1-35`

**Interfaces:**
- `DesktopDashboardProps`:
  ```ts
  interface DesktopDashboardProps {
    movements: Movement[]
    anchor: Date
    currency: string
    locale: string
    onUpdateCategory: (id: string, category: string) => void
    onUpdateMovement: (id: string, patch: Partial<Omit<Movement, 'id' | 'createdAt'>>) => void
    onDeleteMovement: (id: string) => void
  }
  ```

- [ ] **Step 1: Create minimal DesktopDashboard placeholder component**

```tsx
// src/components/desktop/DesktopDashboard.tsx
import React from 'react'
import type { Movement } from '../../types'

export interface DesktopDashboardProps {
  movements: Movement[]
  anchor: Date
  currency: string
  locale: string
  onUpdateCategory: (id: string, category: string) => void
  onUpdateMovement: (id: string, patch: Partial<Omit<Movement, 'id' | 'createdAt'>>) => void
  onDeleteMovement: (id: string) => void
}

export function DesktopDashboard({
  movements,
  anchor,
  currency,
  locale,
}: DesktopDashboardProps) {
  return (
    <div className="desktop-dashboard">
      <div className="desktop-dashboard__placeholder">
        <h2>Panel de Control</h2>
        <p>Cargando métricas y calendario...</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add onUpdateMovement handler in `src/App.tsx` and wrap layout in responsive desktop container**

Add `handleUpdateMovement` callback in `App.tsx`:
```tsx
const handleUpdateMovement = useCallback(
  (id: string, patch: Partial<Omit<Movement, 'id' | 'createdAt'>>) => {
    setMovements((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
      saveMovements(next)
      if (user) {
        const updated = next.find((m) => m.id === id)
        if (updated) void syncMovementsToCloud(user.id, [updated])
      }
      return next
    })
  },
  [user],
)
```

In `App.tsx` JSX:
Render `.desktop-root` that wraps the mobile sidebar `.desktop-sidebar` (the existing `.app`) and the desktop view `.desktop-main`:
```tsx
return (
  <div className="desktop-root">
    <div
      className="app desktop-sidebar"
      style={{ '--chat-h': `${chatHeight}px` } as React.CSSProperties}
    >
      {/* Existing mobile markup */}
    </div>

    <main className="desktop-main">
      <DesktopDashboard
        movements={movements}
        anchor={anchor}
        currency={currencySymbol}
        locale={settings.locale}
        onUpdateCategory={handleUpdateCategory}
        onUpdateMovement={handleUpdateMovement}
        onDeleteMovement={handleDelete}
      />
    </main>
  </div>
)
```

- [ ] **Step 3: Add CSS for `.desktop-root`, `.desktop-sidebar`, and `.desktop-main` in `src/app.css`**

```css
/* Responsive Desktop Split */
.desktop-root {
  display: contents;
}

.desktop-main {
  display: none;
}

@media (min-width: 1024px) {
  .desktop-root {
    display: flex;
    inline-size: 100vw;
    block-size: 100dvh;
    overflow: hidden;
    background: var(--paper);
  }

  .desktop-sidebar {
    flex: 0 0 24rem; /* 384px */
    max-width: 24rem;
    margin-inline: 0;
    border-inline-end: 1px solid var(--rule-strong);
    height: 100dvh;
    position: relative;
  }

  .desktop-main {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    height: 100dvh;
    overflow-y: auto;
    background: var(--paper-raised);
    padding: 1.5rem 2rem 3rem;
  }
}
```

- [ ] **Step 4: Run typecheck and verify build**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/desktop/DesktopDashboard.tsx src/App.tsx src/app.css
git commit -m "feat(desktop): scaffold desktop root and responsive two-panel layout"
```

---

### Task 2: Monthly Metric Cards Component

**Files:**
- Create: `src/components/desktop/MetricCards.tsx`
- Modify: `src/components/desktop/DesktopDashboard.tsx`
- Modify: `src/app.css`

**Interfaces:**
```ts
interface MetricCardsProps {
  movements: Movement[]
  currency: string
  locale: string
}
```

- [ ] **Step 1: Implement `src/components/desktop/MetricCards.tsx`**

Compute:
- Total gastos: sum of `m.amount` where `kind === 'gasto'`.
- Total ingresos: sum of `m.amount` where `kind === 'ingreso'`.
- Net balance: `totalIngresos - totalGastos`.
- Top category: Category with the highest sum of expenses, displaying its icon, name and amount.

```tsx
import React, { useMemo } from 'react'
import type { Movement } from '../../types'
import { formatMoney } from '../../lib/format'
import { CATEGORIES } from '../../lib/categories'

interface MetricCardsProps {
  movements: Movement[]
  currency: string
  locale: string
}

export function MetricCards({ movements, currency, locale }: MetricCardsProps) {
  const stats = useMemo(() => {
    let gastos = 0
    let ingresos = 0
    const catMap: Record<string, number> = {}

    for (const m of movements) {
      if (m.kind === 'gasto') {
        gastos += m.amount
        catMap[m.category] = (catMap[m.category] || 0) + m.amount
      } else {
        ingresos += m.amount
      }
    }

    let topCat = ''
    let topCatAmount = 0
    for (const [cat, amt] of Object.entries(catMap)) {
      if (amt > topCatAmount) {
        topCat = cat
        topCatAmount = amt
      }
    }

    const catObj = CATEGORIES.find((c) => c.name === topCat)

    return {
      gastos,
      ingresos,
      net: ingresos - gastos,
      topCat: topCat ? `${catObj?.glyph ?? '🏷️'} ${topCat}` : '—',
      topCatAmount,
    }
  }, [movements])

  return (
    <div className="desk-metrics">
      <div className="desk-metric-card">
        <span className="desk-metric-card__label">Gastos del mes</span>
        <span className="desk-metric-card__value">
          −{formatMoney(stats.gastos, currency, locale)}
        </span>
      </div>

      <div className="desk-metric-card">
        <span className="desk-metric-card__label">Ingresos del mes</span>
        <span className="desk-metric-card__value desk-metric-card__value--pos">
          +{formatMoney(stats.ingresos, currency, locale)}
        </span>
      </div>

      <div className="desk-metric-card">
        <span className="desk-metric-card__label">Balance neto</span>
        <span className={`desk-metric-card__value${stats.net >= 0 ? ' desk-metric-card__value--pos' : ''}`}>
          {formatMoney(stats.net, currency, locale)}
        </span>
      </div>

      <div className="desk-metric-card">
        <span className="desk-metric-card__label">Categoría principal</span>
        <span className="desk-metric-card__value desk-metric-card__value--cat">
          {stats.topCat}
        </span>
        {stats.topCatAmount > 0 && (
          <span className="desk-metric-card__sub">
            {formatMoney(stats.topCatAmount, currency, locale)}
          </span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add styles for `.desk-metrics` and `.desk-metric-card` in `src/app.css`**

```css
.desk-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-block-end: 1.5rem;
}

.desk-metric-card {
  background: var(--paper);
  border: 1px solid var(--rule-strong);
  border-radius: var(--r-inner);
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.desk-metric-card__label {
  font-size: var(--text-micro);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-muted);
}

.desk-metric-card__value {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.desk-metric-card__value--pos {
  color: var(--accent-text);
}

.desk-metric-card__value--cat {
  font-size: 1.125rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.desk-metric-card__sub {
  font-size: var(--text-label);
  color: var(--ink-muted);
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: Run typecheck to verify**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/desktop/MetricCards.tsx src/app.css
git commit -m "feat(desktop): add MetricCards component with 4 monthly metric blocks"
```

---

### Task 3: Interactive Month Calendar Component

**Files:**
- Create: `src/components/desktop/MonthCalendar.tsx`
- Modify: `src/components/desktop/DesktopDashboard.tsx`
- Modify: `src/app.css`

**Interfaces:**
```ts
interface MonthCalendarProps {
  anchor: Date
  movements: Movement[]
  selectedDay: string | null
  onSelectDay: (dayISO: string | null) => void
  currency: string
  locale: string
}
```

- [ ] **Step 1: Implement `src/components/desktop/MonthCalendar.tsx`**

Build 7-column calendar (Lunes to Domingo) generating calendar matrix for the `anchor` month:
- Groups movements by calendar date `yyyy-mm-dd`.
- Calculates daily net sum or expense total.
- Shows day number + badge with amount.
- Highlighting for `todayISO()`.
- Active styling when `selectedDay === dateISO`. Clicking toggles selection.

```tsx
import React, { useMemo } from 'react'
import type { Movement } from '../../types'
import { formatMoney } from '../../lib/format'
import { toISODate, todayISO } from '../../lib/dates'

const WEEKDAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

interface MonthCalendarProps {
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
    const map: Record<string, { net: number; count: number }> = {}
    for (const m of movements) {
      if (!map[m.date]) map[m.date] = { net: 0, count: 0 }
      map[m.date].net += m.kind === 'ingreso' ? m.amount : -m.amount
      map[m.date].count += 1
    }
    return map
  }, [movements])

  // Generate 7-day grid days
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    
    // Day of week index (Monday = 0, Sunday = 6)
    let startDay = firstDayOfMonth.getDay() - 1
    if (startDay === -1) startDay = 6

    const days: { date: Date; isCurrentMonth: boolean; iso: string }[] = []

    // Previous month padding
    for (let i = startDay; i > 0; i--) {
      const d = new Date(year, month, 1 - i)
      days.push({ date: d, isCurrentMonth: false, iso: toISODate(d) })
    }

    // Current month days
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(year, month, i)
      days.push({ date: d, isCurrentMonth: true, iso: toISODate(d) })
    }

    // Next month padding to fill multiple of 7
    const remaining = (7 - (days.length % 7)) % 7
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i)
      days.push({ date: d, isCurrentMonth: false, iso: toISODate(d) })
    }

    return days
  }, [year, month])

  const today = todayISO()

  return (
    <div className="desk-calendar">
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
                  {formatMoney(data.net, currency, locale)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add styles for `.desk-calendar` in `src/app.css`**

```css
.desk-calendar {
  background: var(--paper);
  border: 1px solid var(--rule-strong);
  border-radius: var(--r-card);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.desk-calendar__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: var(--text-micro);
  font-weight: 600;
  color: var(--ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid var(--rule);
}

.desk-calendar__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.375rem;
}

.desk-calendar__cell {
  min-height: 4.25rem;
  padding: 0.375rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  border: 1px solid var(--rule);
  border-radius: 8px;
  background: var(--paper);
  cursor: pointer;
  transition: border-color var(--fast) var(--ease), background var(--fast) var(--ease);
}

.desk-calendar__cell:hover:not(:disabled) {
  border-color: var(--rule-strong);
  background: var(--paper-raised);
}

.desk-calendar__cell--outside {
  opacity: 0.25;
  cursor: default;
}

.desk-calendar__cell--today .desk-calendar__cell-num {
  color: var(--accent-text);
  font-weight: 700;
}

.desk-calendar__cell--selected {
  border-color: var(--accent);
  background: color-mix(in oklch, var(--accent) 8%, var(--paper));
}

.desk-calendar__cell-num {
  font-size: var(--text-label);
  font-weight: 600;
  color: var(--ink);
}

.desk-calendar__cell-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.desk-calendar__cell-badge--pos {
  color: var(--accent-text);
}
```

- [ ] **Step 3: Run typecheck to verify**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/desktop/MonthCalendar.tsx src/app.css
git commit -m "feat(desktop): add MonthCalendar interactive grid component"
```

---

### Task 4: Spreadsheet / Plantilla Table Component with In-line Editing

**Files:**
- Create: `src/components/desktop/SpreadsheetTable.tsx`
- Modify: `src/components/desktop/DesktopDashboard.tsx`
- Modify: `src/app.css`

**Interfaces:**
```ts
interface SpreadsheetTableProps {
  movements: Movement[]
  selectedDay: string | null
  onClearDayFilter: () => void
  currency: string
  locale: string
  onUpdateCategory: (id: string, category: string) => void
  onUpdateMovement: (id: string, patch: Partial<Omit<Movement, 'id' | 'createdAt'>>) => void
  onDeleteMovement: (id: string) => void
}
```

- [ ] **Step 1: Implement `src/components/desktop/SpreadsheetTable.tsx`**

Includes:
- Search text filter input.
- Category filter dropdown.
- Day filter pill `📅 [Dia] ×`.
- Table columns: Fecha, Tipo (clickable to toggle gasto/ingreso), Descripción (editable on blur/Enter), Categoría (clickable chip dropdown), Monto (editable numeric input on click), Acciones (trash button).
- Sorting by Date or Amount.

```tsx
import React, { useState, useMemo } from 'react'
import type { Movement, Kind } from '../../types'
import { formatMoney } from '../../lib/format'
import { CATEGORIES } from '../../lib/categories'
import { timeLabel, fromISODate, MONTHS, WEEKDAYS, weekdayIndex } from '../../lib/dates'
import { TrashIcon } from '../icons'

interface SpreadsheetTableProps {
  movements: Movement[]
  selectedDay: string | null
  onClearDayFilter: () => void
  currency: string
  locale: string
  onUpdateCategory: (id: string, category: string) => void
  onUpdateMovement: (id: string, patch: Partial<Omit<Movement, 'id' | 'createdAt'>>) => void
  onDeleteMovement: (id: string) => void
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
          m.category.toLowerCase().includes(q)
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
          placeholder="Buscar movimientos..."
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
            <option key={c.name} value={c.name}>
              {c.glyph} {c.name}
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
          {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      <div className="desk-sheet__table-wrap">
        <table className="desk-sheet__table">
          <thead>
            <tr>
              <th style={{ width: '15%' }}>Fecha</th>
              <th style={{ width: '10%' }}>Tipo</th>
              <th style={{ width: '35%' }}>Descripción</th>
              <th style={{ width: '22%' }}>Categoría</th>
              <th style={{ width: '12%', textAlign: 'right' }}>Monto</th>
              <th style={{ width: '6%' }}></th>
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
                        {CATEGORIES.find((c) => c.name === m.category)?.glyph ?? '🏷️'} {m.category}
                      </button>

                      {isCatOpen && (
                        <div className="desk-sheet__cat-menu">
                          {CATEGORIES.map((c) => (
                            <button
                              key={c.name}
                              type="button"
                              className="desk-sheet__cat-option"
                              onClick={() => {
                                onUpdateCategory(m.id, c.name)
                                setOpenCatId(null)
                              }}
                            >
                              <span>{c.glyph}</span> {c.name}
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
```

- [ ] **Step 2: Add styles for `.desk-sheet` in `src/app.css`**

```css
.desk-sheet {
  background: var(--paper);
  border: 1px solid var(--rule-strong);
  border-radius: var(--r-card);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.desk-sheet__toolbar {
  padding: 0.875rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-bottom: 1px solid var(--rule);
  background: var(--paper);
}

.desk-sheet__search {
  flex: 1 1 auto;
  max-width: 18rem;
  height: 2.125rem;
  padding: 0 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--rule-strong);
  background: var(--paper-raised);
  font-size: var(--text-body);
  color: var(--ink);
}

.desk-sheet__cat-select {
  height: 2.125rem;
  padding: 0 0.5rem;
  border-radius: 8px;
  border: 1px solid var(--rule-strong);
  background: var(--paper-raised);
  font-size: var(--text-label);
  color: var(--ink);
}

.desk-sheet__day-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: color-mix(in oklch, var(--accent) 12%, var(--paper));
  color: var(--accent-text);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: var(--text-micro);
  font-weight: 600;
}

.desk-sheet__clear-btn {
  background: none;
  border: none;
  color: inherit;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.desk-sheet__count {
  margin-inline-start: auto;
  font-size: var(--text-micro);
  color: var(--ink-muted);
}

.desk-sheet__table-wrap {
  overflow-x: auto;
  max-height: 28rem;
  overflow-y: auto;
}

.desk-sheet__table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: var(--text-body);
}

.desk-sheet__table th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--paper-raised);
  border-bottom: 1px solid var(--rule-strong);
  padding: 0.625rem 1rem;
  font-size: var(--text-micro);
  font-weight: 600;
  text-transform: uppercase;
  color: var(--ink-muted);
  letter-spacing: 0.05em;
}

.desk-sheet__row {
  border-bottom: 1px solid var(--rule);
  transition: background var(--fast) var(--ease);
}

.desk-sheet__row:hover {
  background: color-mix(in oklch, var(--paper-raised) 50%, var(--paper));
}

.desk-sheet__table td {
  padding: 0.75rem 1rem;
  vertical-align: middle;
}

.desk-sheet__cell-date {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  font-variant-numeric: tabular-nums;
}

.desk-sheet__cell-time {
  font-size: var(--text-micro);
  color: var(--ink-muted);
}

.desk-sheet__kind-pill {
  border: none;
  padding: 0.1875rem 0.5rem;
  border-radius: 999px;
  font-size: var(--text-micro);
  font-weight: 600;
  cursor: pointer;
}

.desk-sheet__kind-pill--gasto {
  background: var(--paper-raised);
  color: var(--ink);
}

.desk-sheet__kind-pill--ingreso {
  background: color-mix(in oklch, var(--accent) 15%, var(--paper));
  color: var(--accent-text);
}

.desk-sheet__editable {
  cursor: pointer;
  padding: 0.25rem 0.375rem;
  border-radius: 4px;
}

.desk-sheet__editable:hover {
  background: var(--paper-raised);
  outline: 1px dashed var(--rule-strong);
}

.desk-sheet__inline-input {
  width: 100%;
  padding: 0.25rem 0.375rem;
  font-size: inherit;
  font-family: inherit;
  border: 1px solid var(--accent);
  border-radius: 4px;
  background: var(--paper);
  color: var(--ink);
}

.desk-sheet__cell-cat {
  position: relative;
}

.desk-sheet__cat-btn {
  background: var(--paper-raised);
  border: 1px solid var(--rule);
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  font-size: var(--text-label);
  color: var(--ink);
  cursor: pointer;
}

.desk-sheet__cat-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 10;
  background: var(--paper-raised);
  border: 1px solid var(--rule-strong);
  border-radius: 8px;
  padding: 0.375rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.25rem;
  min-width: 14rem;
}

.desk-sheet__cat-option {
  background: none;
  border: none;
  padding: 0.375rem 0.5rem;
  border-radius: 4px;
  font-size: var(--text-label);
  text-align: left;
  color: var(--ink);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.desk-sheet__cat-option:hover {
  background: var(--paper);
}

.desk-sheet__amt {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}

.desk-sheet__amt--pos {
  color: var(--accent-text);
}

.desk-sheet__del-btn {
  background: none;
  border: none;
  color: var(--ink-muted);
  cursor: pointer;
  padding: 0.25rem;
  display: inline-flex;
  align-items: center;
  border-radius: 4px;
}

.desk-sheet__del-btn:hover {
  color: oklch(0.6 0.2 25);
  background: var(--paper-raised);
}

.desk-sheet__empty {
  text-align: center;
  padding: 2.5rem;
  color: var(--ink-muted);
}
```

- [ ] **Step 3: Run typecheck to verify**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/desktop/SpreadsheetTable.tsx src/app.css
git commit -m "feat(desktop): add SpreadsheetTable component with in-line editing and filtering"
```

---

### Task 5: Assemble Desktop Dashboard and Verify

**Files:**
- Modify: `src/components/desktop/DesktopDashboard.tsx`
- Modify: `src/app.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Wire `DesktopDashboard.tsx` with `MetricCards`, `MonthCalendar`, and `SpreadsheetTable`**

```tsx
import React, { useState, useMemo } from 'react'
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
}

export function DesktopDashboard({
  movements,
  anchor,
  currency,
  locale,
  onUpdateCategory,
  onUpdateMovement,
  onDeleteMovement,
}: DesktopDashboardProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // Movements of the currently viewed month
  const monthMovements = useMemo(() => {
    return movements.filter((m) => isSameMonth(m.date, anchor))
  }, [movements, anchor])

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
            currency={currency}
            locale={locale}
          />
        </div>

        <div className="desk-dash__table-col">
          <SpreadsheetTable
            movements={monthMovements}
            selectedDay={selectedDay}
            onClearDayFilter={() => setSelectedDay(null)}
            currency={currency}
            locale={locale}
            onUpdateCategory={onUpdateCategory}
            onUpdateMovement={onUpdateMovement}
            onDeleteMovement={onDeleteMovement}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add styles for `.desk-dash` layout in `src/app.css`**

```css
.desk-dash {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.desk-dash__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.desk-dash__title {
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--ink);
  text-transform: capitalize;
}

.desk-dash__subtitle {
  font-size: var(--text-label);
  color: var(--ink-muted);
}

.desk-dash__body {
  display: grid;
  grid-template-columns: 24rem 1fr;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 1280px) {
  .desk-dash__body {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 3: Run full TypeScript check and production build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS with clean build.

- [ ] **Step 4: Commit and Push**

```bash
git add -A
git commit -m "feat: complete desktop dashboard with calendar, metrics, and spreadsheet view"
git push
```
