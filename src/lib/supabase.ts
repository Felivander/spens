import { createClient, type Session, type User } from '@supabase/supabase-js'
import type { Movement, Settings } from '../types'

let cachedClient: ReturnType<typeof createClient> | null = null
let cachedUrl = ''
let cachedKey = ''

export function getSupabaseClient(settings?: Settings) {
  const url = settings?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || ''
  const key = settings?.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || ''

  if (!url || !key) return null

  if (cachedClient && cachedUrl === url && cachedKey === key) {
    return cachedClient
  }

  cachedUrl = url
  cachedKey = key
  cachedClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })

  return cachedClient
}

export function isSupabaseConfigured(settings?: Settings): boolean {
  return Boolean(getSupabaseClient(settings))
}

/**
 * Initiates Google OAuth login via Supabase.
 * Redirects back to the current origin URL.
 */
export async function signInWithGoogle(settings?: Settings): Promise<void> {
  const client = getSupabaseClient(settings)
  if (!client) {
    throw new Error('Supabase no está configurado. Ingresá tu URL y Anon Key de Supabase en Ajustes.')
  }

  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
    },
  })

  if (error) throw error
}

/**
 * Signs out the current user session.
 */
export async function signOut(settings?: Settings): Promise<void> {
  const client = getSupabaseClient(settings)
  if (!client) return
  const { error } = await client.auth.signOut()
  if (error) throw error
}

/**
 * Listens for auth state changes (login, logout, session refresh).
 */
export function onAuthStateChange(
  callback: (session: Session | null, user: User | null) => void,
  settings?: Settings,
) {
  const client = getSupabaseClient(settings)
  if (!client) return () => {}

  // Trigger initial check
  client.auth.getSession().then(({ data }) => {
    callback(data.session, data.session?.user ?? null)
  })

  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((_event, session) => {
    callback(session, session?.user ?? null)
  })

  return () => {
    subscription.unsubscribe()
  }
}

interface SupabaseMovementRow {
  id: string
  user_id: string
  kind: 'gasto' | 'ingreso'
  amount: number
  description: string
  category: string
  date: string
  created_at: number
  person?: string | null
}

/**
 * Downloads all movements stored in Supabase for the authenticated user.
 */
export async function fetchRemoteMovements(userId: string, settings?: Settings): Promise<Movement[]> {
  const client = getSupabaseClient(settings)
  if (!client) return []

  const { data, error } = await client
    .from('movements')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('Error al descargar movimientos de Supabase:', error)
    return []
  }

  return (data as SupabaseMovementRow[]).map((row) => ({
    id: row.id,
    kind: row.kind,
    amount: Number(row.amount),
    description: row.description,
    category: row.category,
    date: row.date,
    createdAt: Number(row.created_at),
    ...(row.person ? { person: row.person } : {}),
  }))
}

/**
 * Upserts a list of movements to Supabase associated with the authenticated user.
 */
export async function syncMovementsToCloud(
  userId: string,
  movements: Movement[],
  settings?: Settings,
): Promise<boolean> {
  const client = getSupabaseClient(settings)
  if (!client || movements.length === 0) return true

  const rows: SupabaseMovementRow[] = movements.map((m) => ({
    id: m.id,
    user_id: userId,
    kind: m.kind,
    amount: m.amount,
    description: m.description,
    category: m.category,
    date: m.date,
    created_at: m.createdAt,
    // Only loans carry the column, so regular rows keep syncing even on a
    // database that hasn't run the `person` migration yet.
    ...(m.person ? { person: m.person } : {}),
  }))

  const { error } = await client.from('movements').upsert(rows as any, {
    onConflict: 'id',
  })

  if (error) {
    console.error('Error al sincronizar movimientos con Supabase:', error)
    return false
  }

  return true
}

/**
 * Deletes a single movement from Supabase.
 */
export async function deleteRemoteMovement(
  userId: string,
  movementId: string,
  settings?: Settings,
): Promise<boolean> {
  const client = getSupabaseClient(settings)
  if (!client) return true

  const { error } = await client
    .from('movements')
    .delete()
    .eq('id', movementId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error al eliminar movimiento de Supabase:', error)
    return false
  }

  return true
}

/**
 * Clears all remote movements for the user (e.g. on Clear All).
 */
export async function clearRemoteMovements(userId: string, settings?: Settings): Promise<boolean> {
  const client = getSupabaseClient(settings)
  if (!client) return true

  const { error } = await client
    .from('movements')
    .delete()
    .eq('user_id', userId)

  if (error) {
    console.error('Error al limpiar movimientos en Supabase:', error)
    return false
  }

  return true
}
