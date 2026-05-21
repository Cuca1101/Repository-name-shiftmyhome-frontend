import { sanitizeAdminIlikeTerm } from '../adminSearch'
import { isSupabaseConfigured, supabase } from '../supabase'
import { HOME_PAGE_QUOTE_SOURCE, PUBLIC_QUOTE_REQUEST_SOURCES } from './quotesRepository'

const QUOTES_TABLE = 'quotes'

/** Keys known to exist on `quotes` from workflow migrations (safe fallback if newer columns are missing). */
const QUOTE_ASSIGNMENT_SAFE_KEYS = new Set([
  'bundled_journey_id',
  'marketplace_visibility',
  'marketplace_payout_price',
  'partner_dashboard_hidden',
  'assigned_driver_id',
  'assigned_driver_name',
  'assigned_partner_id',
  'assigned_partner_company',
  'operational_status',
  'assigned_at',
  'assigned_by',
  'admin_notes_log',
  'admin_completion_note',
  'admin_cancellation_reason',
  'completed_at',
  'cancelled_at',
  'driver_payout_amount',
  'partner_payout_amount',
  'platform_profit_amount',
  'platform_margin_percent',
  'driver_payout_manual_override',
  'partner_payout_manual_override',
  'payout_status',
  'payout_notes',
  'payout_paid_amount',
  'payout_paid_at',
  'payout_payment_method',
  'payout_reference',
  'payout_updated_at',
  'auto_marketplace_hold',
  'auto_marketplace_eligible_at',
  'auto_marketplace_sent_at',
  'is_test',
  'archived_for_go_live',
  'admin_notified_at',
  'admin_notification_intent_id',
])

/**
 * @typedef {'all'|'all_paid'|'unpaid'|'deposit_paid'|'paid'|'booked'} AvailableJobsAdminFilter
 */

/**
 * @param {AvailableJobsAdminFilter} filterKey
 * @param {string} [searchTerm] partial ilike on quote_ref, name, phone, email, pickup, delivery
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function fetchQuotesForAdmin(filterKey = 'all', searchTerm = '') {
  if (!isSupabaseConfigured || !supabase) {
    return []
  }

  let q = supabase.from(QUOTES_TABLE).select('*').order('created_at', { ascending: false })

  if (filterKey === 'all_paid') {
    q = q.in('payment_status', ['paid', 'deposit_paid'])
  } else if (filterKey === 'unpaid') {
    q = q.eq('payment_status', 'unpaid')
  } else if (filterKey === 'deposit_paid') {
    q = q.eq('payment_status', 'deposit_paid')
  } else if (filterKey === 'paid') {
    q = q.eq('payment_status', 'paid')
  } else if (filterKey === 'booked') {
    q = q.eq('status', 'Booked')
  }

  const safe = sanitizeAdminIlikeTerm(searchTerm)
  if (safe.length > 0) {
    const p = `%${safe}%`
    q = q.or(
      `quote_ref.ilike.${p},full_name.ilike.${p},phone.ilike.${p},email.ilike.${p},pickup_address.ilike.${p},delivery_address.ilike.${p}`,
    )
  }

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

/**
 * @param {string} id
 * @returns {Promise<Record<string, unknown>|undefined>}
 */
export async function fetchQuoteByIdForAdmin(id) {
  if (!isSupabaseConfigured || !supabase) {
    return undefined
  }
  const { data, error } = await supabase.from(QUOTES_TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ?? undefined
}

/**
 * @param {string[]} ids quote UUIDs in desired order
 * @returns {Promise<Record<string, unknown>[]>} rows in the same order as `ids` (missing ids skipped)
 */
export async function fetchQuotesByIds(ids) {
  const uniq = [...new Set((ids || []).map((x) => String(x || '').trim()).filter(Boolean))]
  if (!isSupabaseConfigured || !supabase || uniq.length === 0) {
    return []
  }
  const { data, error } = await supabase.from(QUOTES_TABLE).select('*').in('id', uniq)
  if (error) throw error
  const byId = new Map((data ?? []).map((r) => [String(r.id), r]))
  return uniq.map((id) => byId.get(id)).filter(Boolean)
}

/**
 * Full quote rows by `quote_ref`, preserving input order (missing refs omitted).
 * @param {string[]} quoteRefs
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function fetchQuotesByQuoteRefsFull(quoteRefs) {
  const uniq = [...new Set((quoteRefs || []).map((x) => String(x || '').trim()).filter(Boolean))]
  if (!isSupabaseConfigured || !supabase || uniq.length === 0) {
    return []
  }
  const { data, error } = await supabase.from(QUOTES_TABLE).select('*').in('quote_ref', uniq)
  if (error) throw error
  const byRef = new Map((data ?? []).map((r) => [String(r.quote_ref), r]))
  return uniq.map((ref) => byRef.get(ref)).filter(Boolean)
}

/**
 * Map quote_ref → quote row (payment fields) for joining to jobs.
 *
 * @param {string[]} quoteRefs
 * @returns {Promise<Record<string, Record<string, unknown>>>}
 */
export async function fetchQuotesByQuoteRefs(quoteRefs) {
  const uniq = [...new Set(quoteRefs.filter(Boolean).map((s) => String(s).trim()))]
  if (!isSupabaseConfigured || !supabase || uniq.length === 0) {
    return {}
  }

  const { data, error } = await supabase
    .from(QUOTES_TABLE)
    .select(
      'id, quote_ref, payment_status, payment_type, amount_paid, paid_at, stripe_session_id, stripe_payment_intent_id, status',
    )
    .in('quote_ref', uniq)

  if (error) throw error
  /** @type {Record<string, Record<string, unknown>>} */
  const map = {}
  for (const row of data ?? []) {
    if (row.quote_ref) map[row.quote_ref] = row
  }
  return map
}

/**
 * Head-count summaries for the admin dashboard (no row payload).
 *
 * @returns {Promise<{ total: number, unpaid: number, deposit_paid: number, paid: number, booked: number } | null>}
 */
export async function fetchQuotePaymentStats() {
  if (!isSupabaseConfigured || !supabase) {
    return null
  }

  const countEq = async (column, value) => {
    const { count, error } = await supabase
      .from(QUOTES_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq(column, value)
    if (error) throw error
    return count ?? 0
  }

  const [totalRes, unpaid, deposit_paid, paid, booked] = await Promise.all([
    supabase.from(QUOTES_TABLE).select('id', { count: 'exact', head: true }),
    countEq('payment_status', 'unpaid'),
    countEq('payment_status', 'deposit_paid'),
    countEq('payment_status', 'paid'),
    countEq('status', 'Booked'),
  ])

  if (totalRes.error) throw totalRes.error

  return {
    total: totalRes.count ?? 0,
    unpaid,
    deposit_paid,
    paid,
    booked,
  }
}

/**
 * Homepage contact-section leads only.
 *
 * @param {string} [searchTerm] matches quote_ref, name, phone, email, pickup, delivery (partial ilike)
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function fetchHomePageQuoteRequests(searchTerm = '') {
  if (!isSupabaseConfigured || !supabase) {
    return []
  }

  let q = supabase
    .from(QUOTES_TABLE)
    .select('*')
    .in('source', PUBLIC_QUOTE_REQUEST_SOURCES)
    .order('created_at', { ascending: false })

  const safe = sanitizeAdminIlikeTerm(searchTerm)
  if (safe.length > 0) {
    const p = `%${safe}%`
    q = q.or(
      `quote_ref.ilike.${p},full_name.ilike.${p},phone.ilike.${p},email.ilike.${p},pickup_address.ilike.${p},delivery_address.ilike.${p}`,
    )
  }

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

/**
 * Workflow statuses stored in `quotes.status` (shared with legacy wizard).
 *
 * @param {string} id quote row uuid
 * @param {string} status one of New, Contacted, Quoted, Booked, Cancelled
 */
export async function updateQuoteWorkflowStatus(id, status) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }
  const { error } = await supabase.from(QUOTES_TABLE).update({ status }).eq('id', id)
  if (error) throw error
}

/**
 * Authenticated admin label for assignment audit (email preferred).
 *
 * @returns {Promise<string|null>}
 */
export async function fetchAssignedByActor() {
  if (!isSupabaseConfigured || !supabase) return null
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  const u = data?.user
  if (!u) return null
  return u.email || u.id || null
}

/**
 * Partial update of workflow / marketplace columns on `quotes`.
 * Only keys present in `patch` are sent (undefined values are omitted).
 *
 * @param {string} quoteId
 * @param {Record<string, unknown>} patch snake_case column names
 */
export async function updateQuoteWorkflowAssignment(quoteId, patch) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }
  const id = String(quoteId || '').trim()
  if (!id) throw new Error('Missing quote id.')

  const cleaned = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  )
  if (Object.keys(cleaned).length === 0) return

  const { error } = await supabase.from(QUOTES_TABLE).update(cleaned).eq('id', id)
  if (error) throw error
}

/**
 * Same as {@link updateQuoteWorkflowAssignment} but never throws. On schema errors (unknown columns),
 * retries with a reduced key set so admins are not blocked.
 *
 * @param {string} quoteId
 * @param {Record<string, unknown>} patch
 * @returns {Promise<{ savedRemote: boolean }>}
 */
export async function updateQuoteWorkflowAssignmentSilent(quoteId, patch) {
  if (!isSupabaseConfigured || !supabase) {
    return { savedRemote: false }
  }
  const id = String(quoteId || '').trim()
  if (!id) return { savedRemote: false }

  const cleaned = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
  if (Object.keys(cleaned).length === 0) return { savedRemote: true }

  const { error } = await supabase.from(QUOTES_TABLE).update(cleaned).eq('id', id)
  if (!error) return { savedRemote: true }

  const minimal = Object.fromEntries(
    Object.entries(cleaned).filter(([k]) => QUOTE_ASSIGNMENT_SAFE_KEYS.has(k)),
  )
  if (Object.keys(minimal).length === 0) return { savedRemote: false }

  const { error: err2 } = await supabase.from(QUOTES_TABLE).update(minimal).eq('id', id)
  return { savedRemote: !err2 }
}
