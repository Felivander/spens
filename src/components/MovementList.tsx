import { useState } from 'react'
import { CATEGORIES } from '../lib/categories'
import { formatSigned, parseAmountInput } from '../lib/format'
import { fromISODate, timeLabel, todayISO, WEEKDAYS, weekdayIndex } from '../lib/dates'
import type { Movement } from '../types'
import { isDebt } from '../lib/debts'

interface Props {
  movements: Movement[]
  /** When the view already covers a single day, the day headings are noise. */
  groupByDay: boolean
  currency: string
  locale: string
  onDelete: (id: string) => void
  onUpdateCategory: (id: string, category: string) => void
  onUpdate: (id: string, patch: Partial<Omit<Movement, 'id' | 'createdAt'>>) => void
}

/** Description, amount and date of an open row. Each field saves on blur or Enter. */
function RowEditor({
  movement,
  onUpdate,
}: {
  movement: Movement
  onUpdate: Props['onUpdate']
}) {
  const [desc, setDesc] = useState(movement.description)
  const [amount, setAmount] = useState(String(movement.amount).replace('.', ','))
  const [date, setDate] = useState(movement.date)
  const [person, setPerson] = useState(movement.person ?? '')

  const saveDesc = () => {
    const v = desc.trim()
    if (v && v !== movement.description) onUpdate(movement.id, { description: v })
    else setDesc(movement.description)
  }
  const saveAmount = () => {
    const n = parseAmountInput(amount)
    if (n > 0 && n !== movement.amount) onUpdate(movement.id, { amount: n })
    else setAmount(String(movement.amount).replace('.', ','))
  }
  const savePerson = () => {
    const v = person.trim()
    if (v && v !== movement.person) onUpdate(movement.id, { person: v })
    else setPerson(movement.person ?? '')
  }
  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
  }

  return (
    <div className="row__edit">
      <input
        className="row__field row__field--desc"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onBlur={saveDesc}
        onKeyDown={blurOnEnter}
        aria-label="Descripción"
        enterKeyHint="done"
      />
      <input
        className="row__field row__field--amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onBlur={saveAmount}
        onKeyDown={blurOnEnter}
        inputMode="decimal"
        aria-label="Monto"
        enterKeyHint="done"
      />
      {isDebt(movement) && (
        <input
          className="row__field row__field--person"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          onBlur={savePerson}
          onKeyDown={blurOnEnter}
          aria-label="Persona"
          placeholder="Persona"
          enterKeyHint="done"
        />
      )}
      <input
        className="row__field row__field--date"
        type="date"
        value={date}
        onChange={(e) => {
          setDate(e.target.value)
          if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) onUpdate(movement.id, { date: e.target.value })
        }}
        aria-label="Fecha"
      />
    </div>
  )
}

function dayHeading(iso: string): string {
  if (iso === todayISO()) return 'hoy'
  const d = fromISODate(iso)
  return `${WEEKDAYS[weekdayIndex(d)]} ${d.getDate()}`
}

const EVER_HAD_KEY = 'xpenz.everHadMovements'

function markEverHad() {
  try { window.localStorage.setItem(EVER_HAD_KEY, '1') } catch { /* ignore */ }
}

function everHad(): boolean {
  try { return !!window.localStorage.getItem(EVER_HAD_KEY) } catch { return false }
}

export function MovementList({
  movements,
  groupByDay,
  currency,
  locale,
  onDelete,
  onUpdateCategory,
  onUpdate,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null)

  // Persist the flag as soon as there's at least one movement
  if (movements.length > 0) markEverHad()

  if (movements.length === 0) {
    // Show the welcome hint only the very first time (never used before)
    if (everHad()) return null
    return (
      <div className="empty">
        <p className="empty__title">Nada por acá todavía.</p>
        <p className="empty__hint">
          Contale a la app lo que gastaste o cobraste y se anota solo.
        </p>
        <p className="empty__example">café 1.200</p>
      </div>
    )
  }

  // Newest first, then by capture time so same-day entries keep their order.
  const sorted = [...movements].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
  )

  const groups: { date: string; items: Movement[] }[] = []
  for (const m of sorted) {
    const key = groupByDay ? m.date : '__all__'
    const last = groups.at(-1)
    if (last && last.date === key) last.items.push(m)
    else groups.push({ date: key, items: [m] })
  }

  return (
    <div>
      {groups.map((group) => (
        <section key={group.date}>
          {groupByDay && <h2 className="list__daylabel">{dayHeading(group.date)}</h2>}

          {group.items.map((m) => {
            const isOpen = openId === m.id
            return (
              <div key={m.id} className="row">
                <button
                  type="button"
                  className="row__main"
                  aria-expanded={isOpen}
                  aria-label={`${m.description}, ${m.category}, ${formatSigned(
                    m.amount,
                    m.kind,
                    currency,
                    locale,
                  )}`}
                  onClick={() => setOpenId(isOpen ? null : m.id)}
                >
                  <span className="row__text">
                    <span className="row__desc" title={m.description}>
                      {m.description}
                    </span>
                    <span className="row__meta">
                      {isDebt(m) ? `${m.kind === 'gasto' ? '→' : '←'} ${m.person}` : m.category}
                      {groupByDay ? ` · ${timeLabel(m.createdAt)}` : ''}
                    </span>
                  </span>
                  <span
                    className={`row__amount${m.kind === 'ingreso' ? ' row__amount--in' : ''}`}
                  >
                    {formatSigned(m.amount, m.kind, currency, locale)}
                  </span>
                </button>

                {isOpen && <RowEditor movement={m} onUpdate={onUpdate} />}

                {isOpen && (
                  <div className="row__actions">
                    {!isDebt(m) && (
                    <div className="row__cat-selector" role="group" aria-label="Cambiar categoría">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          className={`cat-chip${m.category === cat ? ' cat-chip--active' : ''}`}
                          onClick={() => onUpdateCategory(m.id, cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    )}
                    <button
                      type="button"
                      className="row__delete"
                      onClick={() => {
                        onDelete(m.id)
                        setOpenId(null)
                      }}
                    >
                      Borrar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
