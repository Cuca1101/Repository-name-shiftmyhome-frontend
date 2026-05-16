import { quotePatchForAdminDriverAssign } from '../driverOperationalStatus'
import { isSupabaseConfigured, supabase } from '../supabase'

const ASSIGNMENTS_TABLE = 'job_assignments'

/**
 * @param {Record<string, unknown>} quote
 * @returns {string}
 */
function quoteRef(quote) {
  const r = quote?.quote_ref != null ? String(quote.quote_ref).trim() : ''
  return r || String(quote?.id || '').slice(0, 8)
}

/**
 * @param {Record<string, unknown>} quote
 * @returns {string}
 */
function scheduledDateFromQuote(quote) {
  const move = quote?.move_date != null ? String(quote.move_date) : ''
  const arrival = quote?.arrival_time != null ? String(quote.arrival_time).trim() : '09:00'
  if (move) {
    const d = new Date(`${move}T${arrival.length >= 4 ? arrival : '09:00'}:00`)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  if (quote?.created_at) return String(quote.created_at)
  return new Date().toISOString()
}

/**
 * After admin assigns a driver on a quote, upsert job_assignments for the Driver App.
 *
 * @param {string} quoteId
 * @param {string} driverId public.drivers.id
 * @param {Record<string, unknown>} [quote] optional row for scheduled_date
 * @param {{ assignmentStatus?: string }} [opts]
 */
export async function syncJobAssignmentFromQuoteAssign(quoteId, driverId, quote, opts = {}) {
  if (!isSupabaseConfigured || !supabase) return { synced: false }
  const qid = String(quoteId || '').trim()
  const did = String(driverId || '').trim()
  if (!qid || !did) return { synced: false }

  const status = opts.assignmentStatus ?? 'Assigned'
  const scheduled = quote ? scheduledDateFromQuote(quote) : new Date().toISOString()
  const now = new Date().toISOString()

  const row = {
    quote_id: qid,
    driver_id: did,
    status,
    scheduled_date: scheduled,
    updated_at: now,
  }

  const { error } = await supabase.from(ASSIGNMENTS_TABLE).upsert(row, { onConflict: 'quote_id' })
  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[driverAssignmentSync] upsert failed', error.message, {
        quoteRef: quote ? quoteRef(quote) : qid,
      })
    }
    return { synced: false, error }
  }
  return { synced: true }
}

/**
 * Remove driver assignment row when admin clears driver from quote.
 * @param {string} quoteId
 */
export async function removeJobAssignmentForQuote(quoteId) {
  if (!isSupabaseConfigured || !supabase) return { removed: false }
  const qid = String(quoteId || '').trim()
  if (!qid) return { removed: false }
  const { error } = await supabase.from(ASSIGNMENTS_TABLE).delete().eq('quote_id', qid)
  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[driverAssignmentSync] delete failed', error.message)
    }
    return { removed: false, error }
  }
  return { removed: true }
}

/**
 * Admin assign driver: update quotes + sync assignment.
 *
 * @param {string} quoteId
 * @param {string} driverId
 * @param {string} driverName
 * @param {Record<string, unknown>} quote
 * @param {Record<string, unknown>} quoteWorkflowPatch extra columns for quotes update
 * @param {(id: string, patch: Record<string, unknown>) => Promise<void>} updateQuote
 */
export async function assignDriverToQuote(quoteId, driverId, driverName, quote, quoteWorkflowPatch, updateQuote) {
  const patch = {
    ...quotePatchForAdminDriverAssign(),
    assigned_driver_id: driverId,
    assigned_driver_name: driverName,
    assigned_partner_id: null,
    assigned_partner_company: null,
    ...quoteWorkflowPatch,
  }
  await updateQuote(quoteId, patch)
  await syncJobAssignmentFromQuoteAssign(quoteId, driverId, quote, { assignmentStatus: 'Assigned' })
}

/** @param {string} quoteId @param {Record<string, unknown>} quoteWorkflowPatch @param {(id: string, patch: Record<string, unknown>) => Promise<void>} updateQuote */
export async function clearDriverFromQuote(quoteId, quoteWorkflowPatch, updateQuote) {
  const patch = {
    assigned_driver_id: null,
    assigned_driver_name: null,
    ...quoteWorkflowPatch,
  }
  await updateQuote(quoteId, patch)
  await removeJobAssignmentForQuote(quoteId)
}

export { quotePatchForAdminDriverAssign }
