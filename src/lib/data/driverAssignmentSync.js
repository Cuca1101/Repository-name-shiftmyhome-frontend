import { quotePatchForAdminDriverAssign } from '../driverOperationalStatus'
import { isSupabaseConfigured } from '../supabase'
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
  return cancelJobAssignmentForQuote(quoteId, status)
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
      `Driver saved on booking but mobile job list sync failed${detail}. Re-assign the driver or check job_assignments in Supabase.`,
    )
  }
}

/** @param {string} quoteId @param {Record<string, unknown>} quoteWorkflowPatch @param {(id: string, patch: Record<string, unknown>) => Promise<void>} updateQuote */
export async function clearDriverFromQuote(quoteId, quoteWorkflowPatch, updateQuote) {
  const patch = {
    assigned_driver_id: null,
    assigned_driver_name: null,
    ...quoteWorkflowPatch,
  }
  await updateQuote(quoteId, patch)
  await removeJobAssignmentForQuote(quoteId, 'cancelled')
}

export { quotePatchForAdminDriverAssign }
