import { quotePatchForAdminDriverAssign } from '../driverOperationalStatus'
import { sendJobCustomerNotify } from '../jobCustomerTracking'
import { notifyDriverJobAssignedPush, notifyDriverJobRemovedPush } from '../sendDriverPush'
import { isSupabaseConfigured, supabase } from '../supabase'
import { cancelJobAssignmentForQuote, upsertJobAssignment } from './jobAssignmentsRepository'

/** Statuses that mean the driver should get a new-job FCM alert. */
function isActiveAssignmentStatus(status) {
  const s = String(status || '').trim().toLowerCase()
  return s === 'active' || s === 'assigned' || s === 'accepted'
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

  let priorDriverId = ''
  let priorStatus = ''
  let priorHidden = true
  let prepared = { ok: true, bumped: false, assignment_written: false }
  if (isSupabaseConfigured && supabase && isActiveAssignmentStatus(status)) {
    const { data: existing } = await supabase
      .from('job_assignments')
      .select('driver_id, status')
      .eq('quote_id', qid)
      .maybeSingle()
    priorDriverId = existing?.driver_id != null ? String(existing.driver_id) : ''
    priorStatus = String(existing?.status || '').trim().toLowerCase()
    priorHidden =
      !priorDriverId ||
      priorStatus === 'cancelled' ||
      priorStatus === 'inactive' ||
      priorStatus === 'unassigned' ||
      priorStatus === 'removed'
    const { data, error } = await supabase.rpc('prepare_driver_workflow_attempt', {
      p_quote_id: qid,
      p_reason: 'reassignment',
      p_driver_id: did,
      p_actor: opts.actor || null,
    })
    if (error) {
      const missing = /prepare_driver_workflow_attempt|schema cache|does not exist/i.test(error.message || '')
      if (!missing) throw error
    } else if (data && data.ok === false && data.error && data.error !== 'completed_or_cancelled') {
      throw new Error(
        data.error === 'not_authorised'
          ? 'Only an admin can reassign this job.'
          : `Could not start a fresh driver attempt (${data.error}).`,
      )
    } else if (data && typeof data === 'object') {
      prepared = data
    }
  }

  try {
    const alreadyReady =
      priorDriverId === did &&
      !priorHidden &&
      !prepared.bumped &&
      ['active', 'assigned', 'accepted'].includes(priorStatus)
    if (!prepared.assignment_written && !alreadyReady) {
      await upsertJobAssignment({
        quoteId: qid,
        driverId: did,
        status,
        scheduledDate: quote ? scheduledDateFromQuote(quote) : undefined,
      })
    }
    // Background ring: FCM wakes the phone when the app is not in foreground.
    const driverChanged = Boolean(priorDriverId && priorDriverId !== did)
    if (driverChanged) {
      void notifyDriverJobRemovedPush(priorDriverId, quote ? { ...quote, id: qid } : { id: qid }).catch(
        () => {},
      )
    }
    if (isActiveAssignmentStatus(status) && (prepared.bumped || driverChanged || priorHidden)) {
      void notifyDriverJobAssignedPush(did, quote ? { ...quote, id: qid } : { id: qid }).catch(
        () => {},
      )
    }
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
  const sync = await syncJobAssignmentFromQuoteAssign(quoteId, driverId, quote, {
    assignmentStatus: 'active',
    actor: quoteWorkflowPatch?.assigned_by || null,
  })
  if (!sync.synced) {
    const detail = sync.error?.message ? `: ${sync.error.message}` : ''
    throw new Error(
      `Driver saved on booking but mobile job list sync failed${detail}. Sign out and sign in again as admin, then re-assign. If it persists, apply migration 075 in Supabase SQL Editor.`,
    )
  }

  // Paid bookings: email customer driver allocation (idempotent; force on reassignment).
  const priorDriver = String(quote?.assigned_driver_id || '').trim()
  const reassigned = Boolean(priorDriver && priorDriver !== String(driverId))
  const paymentStatus = String(quote?.payment_status || '').toLowerCase()
  if (paymentStatus === 'paid' || paymentStatus === 'deposit_paid') {
    try {
      await sendJobCustomerNotify(quoteId, reassigned ? 'driver_reassigned' : 'driver_assigned', {
        force: reassigned,
      })
    } catch (e) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[assignDriverToQuote] customer notify failed', e?.message || e)
      }
    }
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
    assigned_partner_id: null,
    assigned_partner_company: null,
    status: 'Booked',
    operational_status: null,
    marketplace_visibility: 'hidden_from_partners',
    completed_at: null,
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
    void notifyDriverJobRemovedPush(priorDriverId, { id: quoteId }).catch(() => {})
  }
}

/**
 * Manual reset of this job's current driver attempt. Payments, booking details
 * and earlier history are left in place.
 *
 * @param {string} quoteId
 * @param {string | null} [actor]
 */
export async function resetDriverProgressForQuote(quoteId, actor = null) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }
  const qid = String(quoteId || '').trim()
  if (!qid) throw new Error('Missing job.')
  const { data, error } = await supabase.rpc('prepare_driver_workflow_attempt', {
    p_quote_id: qid,
    p_reason: 'manual',
    p_driver_id: null,
    p_actor: actor || null,
  })
  if (error) {
    if (/prepare_driver_workflow_attempt|schema cache|does not exist/i.test(error.message || '')) {
      throw new Error('Reset is not available until the latest database migration is applied.')
    }
    throw error
  }
  if (!data?.ok) {
    if (data?.error === 'completed_or_cancelled') {
      throw new Error('Completed or cancelled bookings cannot be reset.')
    }
    if (data?.error === 'not_authorised') {
      throw new Error('Only an admin can reset driver progress.')
    }
    throw new Error(data?.error || 'Reset failed')
  }
  return data
}

export { quotePatchForAdminDriverAssign }
