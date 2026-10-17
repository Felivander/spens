export type Kind = 'gasto' | 'ingreso'

export interface Movement {
  id: string
  kind: Kind
  /** Always positive. `kind` carries the sign. */
  amount: number
  description: string
  category: string
  /** Local calendar day, `yyyy-mm-dd`. */
  date: string
  createdAt: number
  /**
   * Set on loans between people. `kind` still says which way the cash moved
   * (gasto = I handed money over, ingreso = I received it), so the balance
   * math is unchanged; these are just kept out of monthly spend/income.
   */
  person?: string
}

export type Scope = 'mes' | 'semana'

/**
 * Which slice of the current scope is on screen.
 * `'periodo'` = the whole month or the whole week.
 * `'hoy'`     = today (only offered in month scope).
 * `0..6`      = a weekday, Monday-first (only offered in week scope).
 */
export type Tab = 'periodo' | 'hoy' | 'ayer' | 'anteayer' | number

export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  /** `system` follows the OS; the others pin the appearance. */
  theme: Theme
  /** Groq API key (`gsk_…`). Only used when no proxy URL is configured. */
  apiKey: string
  /** Groq model id, e.g. `llama-3.3-70b-versatile`. */
  model: string
  /**
   * Optional serverless endpoint that holds the key server-side. When set, the
   * browser never sees the key and `apiKey` is ignored.
   */
  proxyUrl: string
  currency: string
  /** When false the currency symbol is hidden in all amounts. */
  showCurrency: boolean
  locale: string
  supabaseUrl?: string
  supabaseAnonKey?: string
}

export interface ParsedResult {
  movements: Omit<Movement, 'id' | 'createdAt'>[]
  reply: string
  /** Which path produced this — surfaced in the UI so the user is never guessing. */
  source: 'llm' | 'local'
}
