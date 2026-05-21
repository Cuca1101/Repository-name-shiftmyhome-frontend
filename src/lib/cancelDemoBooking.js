import { appendAdminNotesLog } from './adminNotesLog'
import {
  loadAvailableJobAdminOverrides,
  saveAvailableJobAdminOverrides,
} from './availableJobLocalStore'
import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import {
  fetchAssignedByActor,
  updateQuoteWorkflowAssignment,
  updateQuoteWorkflowAssignmentSilent,
} from './data/quotesAdminRepository'
import { removeJobAssignmentForQuote } from './data/driverAssignmentSync'
import { isSupabaseConfigured } from './supabase'
import { isQuoteDemoOrTest, isRealCustomerBooking, quoteMatchesDemoPatterns } from './demoTestRecordDetection'

/** @deprecated Use ADMIN_TEST_CANCELLATION_REASON */
export const DEMO_CANCELLATION_REASON = 'DEMO / TEST BOOKING'

export const ADMIN_TEST_CANCELLATION_REASON = 'DEMO / TEST BOOKING'

/**
 * @param {Record<string, unknown> | null | undefined} q
 */
export { isQuoteDemoOrTest, isRealCustomerBooking, quoteMatchesDemoPatterns } from './demoTestRecordDetection'

/**
 * Soft-cancel a test booking: workflow flags only — payment & Stripe fields unchanged.
 *
 * @param {string} quoteId
 * @param {Record<string, unknown>} [quote]
 * @param {{ reason?: string }} [opts]
 */
export async function cancelBookingForQuote(quoteId, quote = {}, opts = {}) {
  const id = String(quoteId || '').trim()
  if (!id) throw new Error('Missing quote id.')

  if (isRealCustomerBooking(quote)) {
    throw new Error(
      'This booking has a real payment record. Cancel it from job workflow instead of bulk test cleanup.',
    )
  }

  const ts = new Date().toISOString()
  const actor = await fetchAssignedByActor()
  const m = mergedAdminWorkflowForQuote(quote)
  const log = appendAdminNotesLog(
    m.adminNotesLog,
    actor,
    'Booking cancelled by admin (workflow only — payment and Stripe fields unchanged).',
  )

  const reason =
    opts.reason ||
    (quoteMatchesDemoPatterns(quote) ? ADMIN_TEST_CANCELLATION_REASON : 'Cancelled by admin')

  const patch = {
    operational_status: 'Cancelled',
    cancelled_at: ts,
    admin_cancellation_reason: reason,
    marketplace_visibility: 'cancelled',
    admin_notes_log: log,
    assigned_at: ts,
    assigned_by: actor,
    assigned_driver_id: null,
    assigned_driver_name: null,
    assigned_partner_id: null,
    assigned_partner_company: null,
  }

  let isTestStored = false

  if (isSupabaseConfigured) {
    await updateQuoteWorkflowAssignment(id, patch)
    const testResult = await updateQuoteWorkflowAssignmentSilent(id, { is_test: true })
    isTestStored = Boolean(testResult.savedRemote)
    await removeJobAssignmentForQuote(id)
  } else {
    saveAvailableJobAdminOverrides(id, {
      ...loadAvailableJobAdminOverrides(id),
      operationalStatus: 'Cancelled',
      workflowCancelledAt: ts,
      adminCancellationReason: reason,
      marketplaceVisibility: 'cancelled',
      adminNotesLog: log,
      assignedDriver: '',
      assignedPartnerCompany: '',
    })
  }

  return { isTestStored, cancelledAt: ts }
}

/** @deprecated Use cancelBookingForQuote */
export async function cancelDemoBookingForQuote(quoteId, quote = {}) {
  return cancelBookingForQuote(quoteId, quote)
}
