import { quotePatchForAdminDriverAssign } from '../driverOperationalStatus'
import { isSupabaseConfigured, supabase } from '../supabase'
import { cancelJobAssignmentForQuote, upsertJobAssignment } from './jobAssignmentsRepository'

/**
 * @param {Record<string, unknown>} quote
 * @returns {string}
 */
function scheduledDateFromQuote(quote) {
  const move = quote?.move_date != null ? String(quote.move_date) : ''
  const arrival = quote?.arrival_time != null ? String(quote.arrival_time).trim() : '09:00'
  if (move) {
    const d = new Date(`${move}T${arrival.length >= 4 ? arrival : '09:00'}:00`)
    if (!Number.isFinite(d.getTime())) return new Date().toISOString()
    return d.toISOString()
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
  if (!isSupabaseConfigured) return { synced: false }

  const qid = String(quoteId || '').trim()
  const did = String(driverId || '').trim()
  if (!qid || !did) return { synced: false }

  const rawStatus = opts.assignmentStatus ?? 'active'
  const status =
    rawStatus === 'Completed' || rawStatus === 'Cancelled'
      ? rawStatus
      : rawStatus === 'Assigned' || rawStatus === 'Accepted'
        ? 'active'
        : rawStatus

  try {
    await upsertJobAssignment({
      quoteId: qid,
      driverId: did,
      status,
      scheduledDate: quote ? scheduledDateFromQuote(quote) : undefined,
    })
    return { synced: true }
  } catch (e) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[driverAssignmentSync] upsert failed', e?.message || e)
    }
    return { synced: false, error: e }
  }
}

/**
 * Unassign driver: mark assignment inactive/cancelled (row kept for audit + realtime).
 * @param {string} quoteId
 * @param {'inactive' | 'cancelled'} [status]
 */
export async function removeJobAssignmentForQuote(quoteId, status = 'cancelled') {
  const result = await cancelJobAssignmentForQuote(quoteId, status)
  if (isSupabaseConfigured && !result.cancelled) {
    const detail = result.error?.message ? `: ${result.error.message}` : ''
    throw new Error(
      `Could not cancel job_assignments row${detail}. Apply migration 071 or check admin RLS.`,
    )
  }
  return result
}

/** Best-effort: clear active job from live GPS row after admin unassign. */
export async function clearDriverLocationAssignmentLink(driverId) {
  await clearDriverLocationJobLink(String(driverId || '').trim())
}

/**
 * Admin assign driver: update quotes + sync job_assignments.
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
    status: 'Booked',
    ...quoteWorkflowPatch,
  }
  await updateQuote(quoteId, patch)
  const sync = await syncJobAssignmentFromQuoteAssign(quoteId, driverId, quote, { assignmentStatus: 'active' })
  if (!sync.synced) {
    const detail = sync.error?.message ? `: ${sync.error.message}` : ''
    throw new Error(
      `Driver saved on booking but mobile job list sync failed${detail}. Sign out and sign in again as admin, then re-assign. If it persists, apply migration 075 in Supabase SQL Editor.`,
    )
  }
}

/**
 * Clear live GPS job link when admin unassigns (best-effort).
 * @param {string} driverId
 */
async function clearDriverLocationJobLink(driverId) {
  if (!isSupabaseConfigured || !supabase || !driverId) return
  try {
    await supabase
      .from('driver_locations')
      .update({
        quote_id: null,
        assignment_id: null,
        status: 'available',
        updated_at: new Date().toISOString(),
      })
      .eq('driver_id', driverId)
  } catch {
    // non-blocking — map may still show stale GPS until next driver ping
  }
}

/**
 * @param {string} quoteId
 * @param {Record<string, unknown>} quoteWorkflowPatch
 * @param {(id: string, patch: Record<string, unknown>) => Promise<void>} updateQuote
 * @param {{ priorDriverId?: string }} [opts]
 */
export async function clearDriverFromQuote(quoteId, quoteWorkflowPatch, updateQuote, opts = {}) {
  const priorDriverId = String(opts.priorDriverId || '').trim()
  const patch = {
    ...quoteWorkflowPatch,
    assigned_driver_id: null,
    assigned_driver_name: null,
    status: 'Booked',
  }
  await updateQuote(quoteId, patch)
  const cancelled = await cancelJobAssignmentForQuote(quoteId, 'cancelled')
  if (!cancelled.cancelled) {
    const detail = cancelled.error?.message ? `: ${cancelled.error.message}` : ''
    throw new Error(
      `Driver removed on quote but mobile assignment sync failed${detail}. Apply migration 071 in Supabase or check admin RLS.`,
    )
  }
  if (priorDriverId) {
    await clearDriverLocationJobLink(priorDriverId)
  }
}

export { quotePatchForAdminDriverAssign }
