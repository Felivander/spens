import type { Movement, Settings } from '../types'

const MOVEMENTS_KEY = 'xpenz.movements.v1'
const SETTINGS_KEY = 'xpenz.settings.v1'

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  apiKey: '',
  model: 'llama-3.3-70b-versatile',
  // Build-time default so a deployed proxy needs no per-device setup.
  proxyUrl: import.meta.env.VITE_LLM_PROXY_URL ?? '',
  currency: '$',
  showCurrency: true,
  locale: 'es-AR',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
}

/** localStorage is unavailable in private-mode Safari and inside some iframes. */
function safeRead(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeWrite(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* Quota or disabled storage — the in-memory state stays correct for this session. */
  }
}

export function loadMovements(): Movement[] {
  const raw = safeRead(MOVEMENTS_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isMovement)
  } catch {
    return []
  }
}

export function saveMovements(movements: Movement[]): void {
  safeWrite(MOVEMENTS_KEY, JSON.stringify(movements))
}

export function loadSettings(): Settings {
  const raw = safeRead(SETTINGS_KEY)
  if (!raw) return { ...DEFAULT_SETTINGS }
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  safeWrite(SETTINGS_KEY, JSON.stringify(settings))
}

function isMovement(v: unknown): v is Movement {
  if (typeof v !== 'object' || v === null) return false
  const m = v as Record<string, unknown>
  return (
    typeof m.id === 'string' &&
    (m.kind === 'gasto' || m.kind === 'ingreso') &&
    typeof m.amount === 'number' &&
    Number.isFinite(m.amount) &&
    typeof m.description === 'string' &&
    typeof m.category === 'string' &&
    typeof m.date === 'string' &&
    typeof m.createdAt === 'number' &&
    (m.person === undefined || typeof m.person === 'string')
  )
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function exportJSON(movements: Movement[]): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), movements }, null, 2)
}

/** Returns the parsed movements, or throws with a message worth showing. */
export function importJSON(text: string): Movement[] {
  const data: unknown = JSON.parse(text)
  const list =
    Array.isArray(data)
      ? data
      : typeof data === 'object' && data !== null && Array.isArray((data as { movements?: unknown }).movements)
        ? (data as { movements: unknown[] }).movements
        : null

  if (!list) throw new Error('El archivo no tiene una lista de movimientos.')

  const valid = list.filter(isMovement)
  if (valid.length === 0) throw new Error('No se encontró ningún movimiento válido.')
  return valid
}
