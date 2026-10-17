import { guessCategory, INCOME_HINTS } from './categories'
import { addDays, todayISO, toISODate } from './dates'
import { matchWordAmount } from './numbers'
import { DEBT_CATEGORY } from './debts'
import type { ParsedResult } from '../types'

const strip = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * Turns a written amount into a number. Handles the shapes people actually
 * type in es-AR: `1.200`, `1200`, `1.200,50`, `$1200`, `5k`, `5 mil`, `2 lucas`.
 */
function parseAmount(token: string, suffix: string | undefined): number | null {
  let raw = token.replace(/[$\s]/g, '')

  const dots = (raw.match(/\./g) ?? []).length
  const commas = (raw.match(/,/g) ?? []).length

  if (dots > 0 && commas > 0) {
    // "1.234,56" — dots group, comma decides the decimal.
    raw = raw.replace(/\./g, '').replace(',', '.')
  } else if (commas === 1 && /,\d{1,2}$/.test(raw)) {
    raw = raw.replace(',', '.')
  } else if (commas > 0) {
    raw = raw.replace(/,/g, '')
  } else if (dots > 0) {
    // A single trailing group of exactly 3 digits is a thousands separator
    // ("1.200"), anything else is a decimal point ("1.5").
    raw = /^\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replace(/\./g, '') : raw
  }

  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n)) return null

  const multiplier = suffix ? multiplierFor(strip(suffix)) : 1
  return n * multiplier
}

function multiplierFor(suffix: string): number {
  if (/^(k|mil|luca|lucas)$/.test(suffix)) return 1000
  if (/^(m|palo|palos|millon|millones)$/.test(suffix)) return 1_000_000
  return 1
}

const AMOUNT_RE =
  /\$?\s?(\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(k|mil|lucas?|m|palos?|millones?|millon)?\b/i

/** Relative day words, mapped to a concrete ISO date. */
function resolveDate(text: string, defaultDate?: string): string {
  const t = strip(text)
  const now = new Date()
  if (/\bantea?yer\b|\banteayer\b/.test(t)) return toISODate(addDays(now, -2))
  if (/\bayer\b/.test(t)) return toISODate(addDays(now, -1))
  if (/\bmanana\b/.test(t)) return toISODate(addDays(now, 1))

  // Explicit "12/3" or "12-3-2025".
  const m = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (m) {
    const day = Number(m[1])
    const month = Number(m[2]) - 1
    const yearRaw = m[3] ? Number(m[3]) : now.getFullYear()
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw
    const d = new Date(year, month, day)
    if (!Number.isNaN(d.getTime())) return toISODate(d)
  }
  return defaultDate || todayISO()
}

/** Strips the amount, filler words and date words to leave a usable label. */
function cleanDescription(text: string, amountToken: string): string {
  let out = text.replace(amountToken, ' ')
  // Remove the + sign used as income marker (e.g. "prestamo male +3000" → "prestamo male")
  out = out.replace(/\+\s*/g, ' ')
  out = out.replace(
    /\b(gaste|gasté|gasto|pague|pagué|compre|compré|cobre|cobré|cobro|me pagaron|ingreso|de|en|por|un|una|el|la|los|las|pesos|peso|ars|hoy|ayer|anteayer|manana|mañana)\b/gi,
    ' ',
  )
  out = out.replace(/\s{2,}/g, ' ').trim()
  out = out.replace(/^[-–—,.;:]+|[-–—,.;:]+$/g, '').trim()
  if (!out) return 'Movimiento'
  return out.charAt(0).toUpperCase() + out.slice(1)
}

/**
 * Splits one message into candidate movements.
 *
 * Three separators need care rather than a naive split:
 *  - a comma between digits is a decimal mark ("1.200,50"), not a separator;
 *  - a slash is almost always a date ("12/3"), so it is not a separator at all;
 *  - a "+" is ambiguous. After an amount it separates ("café 1200 + nafta 500");
 *    before one it is the income marker ("préstamo male +3000").
 */
function splitChunks(input: string): string[] {
  // Telling the two "+" apart reads naturally as a lookbehind — but Safari only
  // gained those in 16.4, and this is an iPhone app first. esbuild silently
  // downgrades an unsupported literal to `new RegExp(...)`, which converts a
  // build error into a *runtime* one: the app loads fine, then throws on every
  // message the user sends. So the separating "+" is rewritten to a comma with
  // a capture group, and the existing comma rule does the split.
  const normalised = input.replace(/(\d)\s*\+(?=\s*\S)/g, '$1, ')

  return normalised
    .split(/\s*(?:,(?!\d)|;|\by\b)\s*/i)
    .map((c) => c.trim())
    .filter(Boolean)
}

/* ----------------------------------------------------------------- loans -- */

const L = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ'
/** One name word, optionally followed by a capitalised surname ("Juan Pérez"). */
const NAME = String.raw`([${L}]+(?:\s+[A-ZÁÉÍÓÚÑ][${L}]+)?)`
/** End of word that, unlike `\b`, treats accented letters as letters. */
const E = `(?![${L}])`

/** Words that can sit where a name would but never are one. */
const NOT_NAMES = new Set([
  'el', 'la', 'los', 'las', 'lo', 'mi', 'me', 'te', 'se', 'le', 'les', 'que', 'y', 'a', 'de',
  'un', 'una', 'hoy', 'ayer', 'anteayer', 'manana', 'mañana', 'ya', 'no', 'plata', 'guita',
  'pesos', 'peso', 'mil', 'lucas', 'luca', 'k', 'palos', 'palo', 'todo', 'eso', 'esto', 'con',
])

const capitalise = (name: string) =>
  name.replace(/\s+/g, ' ').trim().replace(/(^|\s)(\S)/g, (_, sp: string, c: string) => sp + c.toUpperCase())

function cleanName(raw: string | undefined): string | null {
  if (!raw) return null
  const words = raw.trim().split(/\s+/)
  if (NOT_NAMES.has(strip(words[0]))) return null
  // A trailing filler word ("Juan ayer") is not part of the name.
  const kept = words.filter((w, i) => i === 0 || !NOT_NAMES.has(strip(w)))
  return capitalise(kept.join(' '))
}

export type DebtMatch =
  | { kind: 'gasto' | 'ingreso'; person: string; description: string }
  | { ask: true }

/**
 * Recognises money lent or repaid between people. `null` means "not a loan".
 * Run on the chunk with the amount already removed, so names never pick up
 * digits.
 *
 *   le presté 20k a Juan     → gasto,   "Préstamo a Juan"
 *   le devolví 10k a Juan    → gasto,   "Le devolví a Juan"
 *   Juan me prestó 10k       → ingreso, "Préstamo de Juan"
 *   Juan me devolvió 5k      → ingreso, "Devolución de Juan"
 */
export function detectDebt(text: string): DebtMatch | null {
  const t = text.replace(/\s{2,}/g, ' ').trim()
  const rx = (src: string) => new RegExp(src, 'i')

  // Money going out: "(le) presté … a Juan", "le devolví … a Juan".
  const lend = t.match(rx(String.raw`\b(?:le\s+)?prest[eé]${E}.*?\ba\s+${NAME}`))
  if (lend) {
    const person = cleanName(lend[1])
    if (person) return { kind: 'gasto', person, description: `Préstamo a ${person}` }
  }
  const repayOut =
    t.match(rx(String.raw`\ble\s+devolv[ií]${E}.*?\ba\s+${NAME}`)) ??
    t.match(rx(String.raw`\ble\s+pagu[eé]${E}.*?\ba\s+${NAME}.*\bdeb[ií]a${E}`))
  if (repayOut) {
    const person = cleanName(repayOut[1])
    if (person) return { kind: 'gasto', person, description: `Le devolví a ${person}` }
  }

  // Money coming in: "Juan me prestó", "me prestó Juan", same for devolvió.
  const inBefore = t.match(rx(String.raw`(?:^|\s)${NAME}\s+me\s+(prest[oó]|devolvi[oó]|pag[oó](?=.*\bdeb[ií]a${E}))${E}`))
  const inAfter = t.match(rx(String.raw`\bme\s+(prest[oó]|devolvi[oó])${E}\s+(?:la\s+plata\s+)?${NAME}`))
  const incoming = inBefore
    ? { name: inBefore[1], verb: inBefore[2] }
    : inAfter
      ? { name: inAfter[2], verb: inAfter[1] }
      : null
  if (incoming) {
    const person = cleanName(incoming.name)
    if (person) {
      const lent = /^prest/i.test(incoming.verb)
      return {
        kind: 'ingreso',
        person,
        description: lent ? `Préstamo de ${person}` : `Devolución de ${person}`,
      }
    }
  }

  // A lending verb with nobody attached: ask instead of guessing.
  if (rx(String.raw`\b(?:prest[eéoó]|prestaron|le\s+devolv[ií])${E}`).test(t)) return { ask: true }
  return null
}

/**
 * Offline parser — the default path, and the fallback when the optional LLM
 * is unavailable. Understands es-AR amount notation in digits and in words,
 * relative dates, and several movements in one message.
 */
export function parseLocal(input: string, defaultDate?: string): ParsedResult {
  const chunks = splitChunks(input)
  const movements: ParsedResult['movements'] = []
  let missingPerson = false

  for (const chunk of chunks) {
    // Digits first — they're unambiguous. Fall back to written-out numbers.
    const match = chunk.match(AMOUNT_RE)
    let amount: number | null = null
    let matchedText = ''

    if (match) {
      amount = parseAmount(match[1], match[2])
      matchedText = match[0]
    } else {
      const word = matchWordAmount(chunk)
      if (word) {
        amount = word.value
        matchedText = chunk.slice(word.start, word.end)
      }
    }

    if (amount === null || amount <= 0) continue

    const debt = detectDebt(chunk.replace(matchedText, ' '))
    if (debt && 'ask' in debt) {
      missingPerson = true
      continue
    }
    if (debt) {
      movements.push({
        kind: debt.kind,
        amount,
        description: debt.description,
        category: DEBT_CATEGORY,
        date: resolveDate(chunk, defaultDate),
        person: debt.person,
      })
      continue
    }

    // A "+" immediately before the amount (anywhere in the chunk) marks it as income.
    // Covers both "+3000" and "prestamo male +3000".
    const forceIncome = /(?:^|\s)\+\s*\d/.test(chunk)

    const kindText = strip(chunk)
    const kind: 'gasto' | 'ingreso' =
      forceIncome || INCOME_HINTS.some((h) => kindText.includes(strip(h)))
        ? 'ingreso'
        : 'gasto'

    const description = cleanDescription(chunk, matchedText)

    movements.push({
      kind,
      amount,
      description,
      category: guessCategory(description, kind),
      date: resolveDate(chunk, defaultDate),
    })
  }

  const reply =
    movements.length === 0 && missingPerson
      ? '¿A quién? Probá "le presté 20k a Juan".'
      : movements.length === 0
      ? 'No encontré un monto. Probá "café 1.200".'
      : movements.length === 1
        ? 'Anotado.'
        : `Anoté ${movements.length} movimientos.`

  return { movements, reply, source: 'local' }
}
