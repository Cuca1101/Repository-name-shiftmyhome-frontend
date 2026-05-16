import { isSupabaseConfigured, supabase } from '../supabase'
import { LS_REVIEWS } from '../localStorageKeys'

const TABLE = 'reviews'

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const DEFAULT_REVIEWS = [
  { author_name: 'James', body: 'Brilliant service from start to finish.', rating: 5, is_published: true, sort_order: 0 },
  { author_name: 'Sarah', body: 'Needed a sofa and beds moved at short notice. Highly recommend.', rating: 5, is_published: true, sort_order: 1 },
  { author_name: 'David', body: 'Clear communication on WhatsApp, fair price for a full flat move.', rating: 5, is_published: true, sort_order: 2 },
]

/**
 * Public: published only. Admin calls fetchAllReviewsForAdmin.
 */
export async function fetchPublishedReviews() {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return data ?? []
  }
  const all = readLs()
  return all.filter((r) => r.is_published).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

export async function fetchAllReviewsForAdmin() {
  if (isSupabaseConfigured && supabase) {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData?.session) throw new Error('Sign in required.')
    const { data, error } = await supabase.from(TABLE).select('*').order('sort_order', { ascending: true })
    if (error) throw error
    return data ?? []
  }
  const raw = localStorage.getItem(LS_REVIEWS)
  if (raw) {
    try {
      const p = JSON.parse(raw)
      if (Array.isArray(p) && p.length > 0) return p
    } catch {
      /* ignore */
    }
  }
  const seeded = DEFAULT_REVIEWS.map((r, i) => ({
    ...r,
    id: uuid(),
    created_at: new Date().toISOString(),
    sort_order: i,
  }))
  localStorage.setItem(LS_REVIEWS, JSON.stringify(seeded))
  return seeded
}

export async function upsertReview(row) {
  const now = new Date().toISOString()
  if (isSupabaseConfigured && supabase) {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData?.session) throw new Error('Sign in required.')
    if (row.id) {
      const { data, error } = await supabase.from(TABLE).update(row).eq('id', row.id).select('*').single()
      if (error) throw error
      return data
    }
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ ...row, created_at: now })
      .select('*')
      .single()
    if (error) throw error
    return data
  }
  const list = readLs()
  if (row.id) {
    const next = list.map((r) => (r.id === row.id ? { ...r, ...row } : r))
    localStorage.setItem(LS_REVIEWS, JSON.stringify(next))
    return next.find((r) => r.id === row.id)
  }
  const rec = { ...row, id: uuid(), created_at: now }
  list.push(rec)
  localStorage.setItem(LS_REVIEWS, JSON.stringify(list))
  return rec
}

export async function deleteReview(id) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) throw error
    return
  }
  localStorage.setItem(
    LS_REVIEWS,
    JSON.stringify(readLs().filter((r) => r.id !== id)),
  )
}

function readLs() {
  const raw = localStorage.getItem(LS_REVIEWS)
  if (!raw) return []
  try {
    const p = JSON.parse(raw)
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}
