import { CATEGORIES, guessCategory } from './categories'
import { todayISO, WEEKDAYS, weekdayIndex } from './dates'
import { parseLocal } from './parse'
import { DEBT_CATEGORY } from './debts'
import type { ParsedResult, Settings } from '../types'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

/** Free-tier Groq models that handle es-AR extraction well, fastest first. */
export const GROQ_MODELS = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B — equilibrado' },
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B — más preciso' },
  { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B — más rápido' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B — mínima latencia' },
] as const

function systemPrompt(): string {
  const now = new Date()
  const today = todayISO()
  const dayName = WEEKDAYS[weekdayIndex(now)]

  return `Sos el motor de registro de una app de gastos personales en español rioplatense.

Convertís lo que escribe la persona en movimientos de dinero estructurados.

Hoy es ${dayName} ${today} (formato yyyy-mm-dd).

Respondé SIEMPRE con un único objeto JSON, sin texto alrededor y sin bloques de código:

{
  "movimientos": [
    {
      "tipo": "gasto" | "ingreso",
      "monto": number,            // positivo siempre, el signo lo da "tipo"
      "descripcion": string,      // breve, 1 a 4 palabras, en minúscula salvo nombres propios
      "categoria": ${CATEGORIES.map((c) => `"${c}"`).join(' | ')},
      "fecha": "yyyy-mm-dd",
      "persona": string | null    // solo en préstamos entre personas, si no null
    }
  ],
  "respuesta": string             // confirmación de una línea, máximo 8 palabras
}

Reglas:
- Un mensaje puede contener varios movimientos ("café 1200 y nafta 15000" son dos).
- Interpretá la notación local: "1.200" son mil doscientos; "1.200,50" lleva centavos; "5k", "5 mil" y "5 lucas" son cinco mil; "2 palos" son dos millones.
- Cobros, sueldos, ventas, reintegros y depósitos son "ingreso". Todo lo demás es "gasto".
- Si el monto va precedido por un signo "+\" explícito (ej: "+3000", "+5 mil"), clasificalo siempre como "ingreso" independientemente de la descripción.
- Resolvé fechas relativas: "ayer", "anteayer", "el martes", "12/3". Sin indicación, usá hoy.
- Elegí la categoría más específica posible. Si ninguna encaja, usá "Otros".
- Si el mensaje no contiene ningún monto, devolvé "movimientos": [] y explicá en una línea qué falta.
- No inventes montos, fechas ni movimientos que la persona no mencionó.
- Préstamos entre personas: completá "persona" con el nombre (capitalizado) y "tipo" según hacia dónde va la plata:
  - "le presté 20k a Juan" o "le devolví 10k a Juan" → "gasto" (la plata sale).
  - "Juan me prestó 10k" o "Juan me devolvió 5k" → "ingreso" (la plata entra).
  - La "descripcion" queda "Préstamo a Juan", "Le devolví a Juan", "Préstamo de Juan" o "Devolución de Juan". La "categoria" no importa.
  - Si se nombra un préstamo sin decir a quién ("le presté 20k"), devolvé "movimientos": [] y preguntá a quién.
  - "me devolvieron" o "me pagaron" sin una persona concreta (reintegros, clientes) NO es préstamo: "persona" es null.`
}

interface RawMovement {
  tipo?: unknown
  monto?: unknown
  descripcion?: unknown
  categoria?: unknown
  fecha?: unknown
  persona?: unknown
}

/** Models occasionally wrap JSON in prose or fences even in JSON mode. */
function extractJSON(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text

  try {
    return JSON.parse(candidate)
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start === -1 || end <= start) throw new Error('La respuesta del modelo no era JSON.')
    return JSON.parse(candidate.slice(start, end + 1))
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Never trusts the model's shape. Every field is checked and, where the model
 * drifted, repaired locally rather than dropped.
 */
function coerce(payload: unknown, defaultDate?: string): ParsedResult {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('La respuesta del modelo no era un objeto.')
  }

  const obj = payload as { movimientos?: unknown; respuesta?: unknown }
  const list = Array.isArray(obj.movimientos) ? obj.movimientos : []

  const movements: ParsedResult['movements'] = []

  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue
    const m = item as RawMovement

    const amount = typeof m.monto === 'number' ? m.monto : Number.parseFloat(String(m.monto ?? ''))
    if (!Number.isFinite(amount) || amount <= 0) continue

    const kind = m.tipo === 'ingreso' ? 'ingreso' : 'gasto'
    const description =
      typeof m.descripcion === 'string' && m.descripcion.trim()
        ? m.descripcion.trim().slice(0, 60)
        : 'Movimiento'

    const category =
      typeof m.categoria === 'string' && (CATEGORIES as readonly string[]).includes(m.categoria)
        ? m.categoria
        : guessCategory(description, kind)

    const date = typeof m.fecha === 'string' && ISO_DATE.test(m.fecha)
      ? (m.fecha === todayISO() && defaultDate ? defaultDate : m.fecha)
      : (defaultDate || todayISO())

    const person =
      typeof m.persona === 'string' && m.persona.trim() ? m.persona.trim().slice(0, 40) : undefined

    movements.push({
      kind,
      amount: Math.abs(amount),
      description: description.charAt(0).toUpperCase() + description.slice(1),
      category: person ? DEBT_CATEGORY : category,
      date,
      ...(person ? { person } : {}),
    })
  }

  const reply =
    typeof obj.respuesta === 'string' && obj.respuesta.trim()
      ? obj.respuesta.trim()
      : movements.length
        ? 'Anotado.'
        : 'No encontré un monto.'

  return { movements, reply, source: 'llm' }
}

export function hasLLM(settings: Settings): boolean {
  return Boolean(settings.proxyUrl.trim() || settings.apiKey.trim())
}

async function callGroq(text: string, settings: Settings, signal: AbortSignal): Promise<unknown> {
  const viaProxy = Boolean(settings.proxyUrl.trim())

  const body = {
    model: settings.model || 'llama-3.3-70b-versatile',
    // Deterministic extraction — this is parsing, not writing.
    temperature: 0,
    max_completion_tokens: 1024,
    response_format: { type: 'json_object' as const },
    messages: [
      { role: 'system' as const, content: systemPrompt() },
      { role: 'user' as const, content: text },
    ],
  }

  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (!viaProxy) headers.authorization = `Bearer ${settings.apiKey.trim()}`

  const res = await fetch(viaProxy ? settings.proxyUrl.trim() : GROQ_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Groq respondió ${res.status}. ${detail.slice(0, 200)}`)
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[]
  }

  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('Groq no devolvió contenido.')

  return extractJSON(content)
}

export interface ParseOutcome extends ParsedResult {
  /** Populated when the LLM was tried and failed; the result then came from the local parser. */
  warning?: string
}

/**
 * Single entry point for the chat bar.
 *
 * Tries Groq when it's configured and falls back to the offline parser on any
 * failure — no key, no network, CORS, rate limit, malformed JSON. The chat is
 * never a dead end, and the UI is told which path produced the result.
 */
export async function parseMessage(
  text: string,
  settings: Settings,
  defaultDate?: string,
  timeoutMs = 15_000,
): Promise<ParseOutcome> {
  if (!hasLLM(settings)) return parseLocal(text, defaultDate)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const payload = await callGroq(text, settings, controller.signal)
    const result = coerce(payload, defaultDate)

    // A model that found nothing may simply have missed an obvious amount.
    if (result.movements.length === 0) {
      const local = parseLocal(text, defaultDate)
      if (local.movements.length > 0) return local
    }
    return result
  } catch (error) {
    const local = parseLocal(text, defaultDate)
    const reason =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'La IA tardó demasiado'
        : error instanceof Error
          ? error.message
          : 'Falló la IA'
    return { ...local, warning: `${reason} — usé el lector local.` }
  } finally {
    clearTimeout(timer)
  }
}
