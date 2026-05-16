import { isSupabaseConfigured, supabase } from '../supabase'
import { DEFAULT_ITEMS_LIBRARY } from '../defaultItemsLibrary'
import { LS_ITEMS } from '../localStorageKeys'

const TABLE = 'items_library'

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/**
 * @typedef {Object} LibraryItemRow
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {number} cubic_metres
 * @property {'small'|'medium'|'large'|'heavy'} weight_type
 * @property {number} handling_multiplier
 * @property {number} default_quantity
 * @property {string} [created_at]
 */

/**
 * @returns {Promise<LibraryItemRow[]>}
 */
export async function fetchItemsLibrary() {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      return data ?? []
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[fetchItemsLibrary] Supabase unavailable — using cached/offline catalogue.', e?.message ?? e)
      }
    }
  }
  const raw = localStorage.getItem(LS_ITEMS)
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch {
      /* ignore */
    }
  }
  const seeded = DEFAULT_ITEMS_LIBRARY.map((row) => ({
    ...row,
    id: uuid(),
    created_at: new Date().toISOString(),
  }))
  localStorage.setItem(LS_ITEMS, JSON.stringify(seeded))
  return seeded
}

/**
 * @param {Omit<LibraryItemRow, 'id' | 'created_at'>} row
 */
export async function insertLibraryItem(row) {
  const now = new Date().toISOString()
  const record = { ...row, id: uuid(), created_at: now }
  if (isSupabaseConfigured && supabase) {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData?.session) throw new Error('Sign in to manage items.')
    const { data, error } = await supabase.from(TABLE).insert(record).select('*').single()
    if (error) throw error
    return data
  }
  const list = await fetchItemsFromLs()
  const next = [...list, record]
  localStorage.setItem(LS_ITEMS, JSON.stringify(next))
  return record
}

/**
 * @param {string} id
 * @param {Partial<LibraryItemRow>} patch
 */
export async function updateLibraryItem(id, patch) {
  if (isSupabaseConfigured && supabase) {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData?.session) throw new Error('Sign in to manage items.')
    const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).select('*').single()
    if (error) throw error
    return data
  }
  const list = await fetchItemsFromLs()
  const next = list.map((r) => (r.id === id ? { ...r, ...patch } : r))
  localStorage.setItem(LS_ITEMS, JSON.stringify(next))
  return next.find((r) => r.id === id)
}

/**
 * @param {string} id
 */
export async function deleteLibraryItem(id) {
  if (isSupabaseConfigured && supabase) {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData?.session) throw new Error('Sign in to manage items.')
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) throw error
    return
  }
  const list = await fetchItemsFromLs()
  localStorage.setItem(
    LS_ITEMS,
    JSON.stringify(list.filter((r) => r.id !== id)),
  )
}

async function fetchItemsFromLs() {
  const raw = localStorage.getItem(LS_ITEMS)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
