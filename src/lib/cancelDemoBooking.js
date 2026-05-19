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

export const DEMO_CANCELLATION_REASON = 'DEMO / TEST BOOKING'

/**
 * @param {Record<string, unknown> | null | undefined} q
 */
export function isQuoteDemoOrTest(q) {
  if (!q || typeof q !== 'object') return false
  if (q.is_test === true) return true
  const reason = String(q.admin_cancellation_reason ?? '').toUpperCase()
  return reason.includes('DEMO') || reason.includes('TEST BOOKING')
}

/**
 * Soft-cancel a demo/test booking: terminal workflow flags only — payment & Stripe fields unchanged.
 *
 * @param {string} quoteId
 * @param {Record<string, unknown>} [quote]
 * @returns {Promise<{ isTestStored: boolean, cancelledAt: string }>}
 */
export async function cancelDemoBookingForQuote(quoteId, quote = {}) {
  const id = String(quoteId || '').trim()
  if (!id) throw new Error('Missing quote id.')

  const ts = new Date().toISOString()
  const actor = await fetchAssignedByActor()
  const m = mergedAdminWorkflowForQuote(quote)
  const log = appendAdminNotesLog(
    m.adminNotesLog,
    actor,
    'Demo/test booking cancelled — payment and Stripe fields kept.',
  )

  const patch = {
    operational_status: 'Cancelled',
    cancelled_at: ts,
    admin_cancellation_reason: DEMO_CANCELLATION_REASON,
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
      adminCancellationReason: DEMO_CANCELLATION_REASON,
      marketplaceVisibility: 'cancelled',
      adminNotesLog: log,
      assignedDriver: '',
      assignedPartnerCompany: '',
    })
  }

  return { isTestStored, cancelledAt: ts }
}
