import { isSupabaseConfigured, supabase } from '../supabase'

const TABLE = 'job_assignments'

/** @typedef {'active' | 'inactive' | 'cancelled' | 'Assigned' | 'Accepted' | 'Completed' | 'Cancelled'} JobAssignmentStatus */

/**
 * @param {string} [raw]
 * @returns {JobAssignmentStatus}
 */
export function normalizeJobAssignmentStatus(raw) {
  const s = String(raw || 'active').trim()
  if (s === 'Assigned' || s === 'Accepted') return 'active'
  if (s === 'Completed') return 'Completed'
  if (s === 'Cancelled') return 'Cancelled'
  if (s === 'inactive' || s === 'cancelled' || s === 'active') return /** @type {JobAssignmentStatus} */ (s)
  return 'active'
}

/**
 * @param {string[]} quoteIds
 * @returns {Promise<Record<string, { status: string, updated_at: string, driver_id?: string }>>}
 */
export async function fetchJobAssignmentsByQuoteIds(quoteIds) {
  /** @type {Record<string, { status: string, updated_at: string, driver_id?: string }>} */
  const out = {}
  if (!isSupabaseConfigured || !supabase) return out
  const ids = [...new Set((quoteIds || []).map((x) => String(x || '').trim()).filter(Boolean))]
  if (ids.length === 0) return out
  const { data, error } = await supabase
    .from(TABLE)
    .select('quote_id, driver_id, status, updated_at')
    .in('quote_id', ids.slice(0, 200))
  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[jobAssignments] fetch failed', error.message)
    }
    return out
  }
  for (const row of data ?? []) {
    if (!row?.quote_id) continue
    out[String(row.quote_id)] = {
      status: String(row.status || ''),
      updated_at: row.updated_at != null ? String(row.updated_at) : '',
      driver_id: row.driver_id != null ? String(row.driver_id) : '',
    }
  }
  return out
}

/**
 * Upsert assignment for Driver App (one row per quote).
 *
 * @param {{
 *   quoteId: string,
 *   driverId: string,
 *   status?: string,
 *   scheduledDate?: string,
 * }} input
 */
export async function upsertJobAssignment(input) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }
  const quoteId = String(input.quoteId || '').trim()
  const driverId = String(input.driverId || '').trim()
  if (!quoteId || !driverId) throw new Error('Missing quote or driver id.')

  const now = new Date().toISOString()
  const status = normalizeJobAssignmentStatus(input.status)

  const { data: existing } = await supabase
    .from(TABLE)
    .select('quote_id, created_at')
    .eq('quote_id', quoteId)
    .maybeSingle()

  const row = {
    quote_id: quoteId,
    driver_id: driverId,
    status,
    scheduled_date: input.scheduledDate || now,
    updated_at: now,
    ...(existing?.quote_id ? {} : { created_at: now }),
  }

  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: 'quote_id' })
  if (error) throw error
  return { quoteId, driverId, status }
}

/**
 * Unassign: keep row for audit; mobile filters non-active statuses.
 * @param {string} quoteId
 * @param {'inactive' | 'cancelled'} [status]
 */
export async function cancelJobAssignmentForQuote(quoteId, status = 'cancelled') {
  if (!isSupabaseConfigured || !supabase) return { cancelled: false }
  const qid = String(quoteId || '').trim()
  if (!qid) return { cancelled: false }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from(TABLE)
    .update({
      status: status === 'inactive' ? 'inactive' : 'cancelled',
      updated_at: now,
    })
    .eq('quote_id', qid)

  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[jobAssignments] cancel failed', error.message)
    }
    return { cancelled: false, error }
  }
  return { cancelled: true }
}
