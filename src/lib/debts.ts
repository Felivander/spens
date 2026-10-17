import type { Movement } from '../types'

/** Category stamped on loan movements. Not part of CATEGORIES on purpose. */
export const DEBT_CATEGORY = 'Préstamos'

export function isDebt(m: Movement): boolean {
  return Boolean(m.person)
}

/** "Juan", "juan" and "Juán" are the same person. */
export function personKey(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}

export interface DebtBalance {
  key: string
  /** Spelling from the most recent movement. */
  name: string
  /** > 0 they owe me, < 0 I owe them. */
  net: number
  lastDate: string
  items: Movement[]
}

/** Cents-level noise from partial payments shouldn't keep a debt alive. */
const SETTLED = 0.005

export function isSettled(b: DebtBalance): boolean {
  return Math.abs(b.net) < SETTLED
}

/**
 * Per-person running balance. Money I handed over (gasto) raises what they
 * owe me; money I received (ingreso) lowers it — one rule covers lending,
 * borrowing and both kinds of repayment.
 */
export function debtBalances(movements: Movement[]): DebtBalance[] {
  const map = new Map<string, DebtBalance>()
  const ordered = movements
    .filter(isDebt)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)

  for (const m of ordered) {
    const key = personKey(m.person!)
    const b = map.get(key) ?? { key, name: m.person!, net: 0, lastDate: m.date, items: [] }
    b.net += m.kind === 'gasto' ? m.amount : -m.amount
    b.name = m.person!.trim()
    b.lastDate = m.date
    b.items.push(m)
    map.set(key, b)
  }

  return [...map.values()].sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
}

export function debtTotals(movements: Movement[]): { owedToMe: number; iOwe: number } {
  let owedToMe = 0
  let iOwe = 0
  for (const b of debtBalances(movements)) {
    if (isSettled(b)) continue
    if (b.net > 0) owedToMe += b.net
    else iOwe += -b.net
  }
  return { owedToMe, iOwe }
}

/** The movement that brings a person's balance back to zero. */
export function settleMovement(b: DebtBalance, date: string): Omit<Movement, 'id' | 'createdAt'> {
  const theyOwe = b.net > 0
  return {
    kind: theyOwe ? 'ingreso' : 'gasto',
    amount: Math.round(Math.abs(b.net) * 100) / 100,
    description: theyOwe ? `Devolución de ${b.name}` : `Le devolví a ${b.name}`,
    category: DEBT_CATEGORY,
    date,
    person: b.name,
  }
}
