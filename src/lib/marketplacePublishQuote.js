import { appendAdminNotesLog } from './adminNotesLog'
import { loadAvailableJobAdminOverrides, saveAvailableJobAdminOverrides } from './availableJobLocalStore'
import { applyDefaultMarketplacePayoutToQuote } from './marketplacePayoutApply'
import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import {
  fetchAssignedByActor,
  updateQuoteWorkflowAssignment,
  updateQuoteWorkflowAssignmentSilent,
} from './data/quotesAdminRepository'
import { removeJobAssignmentForQuote } from './data/driverAssignmentSync'
import { isSupabaseConfigured } from './supabase'

/**
 * List a quote on the partner marketplace (same behaviour as manual admin send).
 * Does not change customer totals, payments, or invoices.
 *
 * @param {string} quoteId
 * @param {Record<string, unknown>} quote
 * @param {{ logMessage?: string, autoSent?: boolean }} [opts]
 */
export async function publishQuoteToMarketplace(quoteId, quote, opts = {}) {
  const id = String(quoteId || '').trim()
  if (!id || !quote || typeof quote !== 'object') return { ok: false }

  const logMessage =
    opts.logMessage ||
    (opts.autoSent
      ? 'Auto-sent to Marketplace by system.'
      : 'Sent to Marketplace (admin).')
  const ts = new Date().toISOString()
  const mergedQuote = {
    ...quote,
    marketplace_visibility: 'visible_in_marketplace',
    assigned_driver_id: null,
    assigned_driver_name: null,
    assigned_partner_id: null,
    assigned_partner_company: null,
    operational_status: null,
  }

  if (!isSupabaseConfigured) {
    saveAvailableJobAdminOverrides(id, {
      marketplaceVisibility: 'visible_in_marketplace',
      assignedDriver: '',
      assignedPartnerCompany: '',
      operationalStatus: '',
      partnerDashboardHidden: false,
      adminNotesLog: appendAdminNotesLog(
        loadAvailableJobAdminOverrides(id).adminNotesLog,
        'system',
        logMessage,
      ),
    })
    await applyDefaultMarketplacePayoutToQuote(mergedQuote, { source: 'available_jobs' })
    return { ok: true, localOnly: true }
  }

  const by = await fetchAssignedByActor()
  const m = mergedAdminWorkflowForQuote(quote)
  const log = appendAdminNotesLog(m.adminNotesLog, opts.autoSent ? 'system' : by, logMessage)

  await updateQuoteWorkflowAssignment(id, {
    marketplace_visibility: 'visible_in_marketplace',
    assigned_driver_id: null,
    assigned_driver_name: null,
    assigned_partner_id: null,
    assigned_partner_company: null,
    operational_status: null,
    assigned_at: ts,
    assigned_by: by,
    admin_notes_log: log,
  })

  /** @type {Record<string, unknown>} */
  const silentPatch = { partner_dashboard_hidden: false }
  if (opts.autoSent) {
    silentPatch.auto_marketplace_sent_at = ts
    silentPatch.auto_marketplace_hold = false
  }

  await updateQuoteWorkflowAssignmentSilent(id, silentPatch)
  await removeJobAssignmentForQuote(id)
  await applyDefaultMarketplacePayoutToQuote(mergedQuote, { source: 'available_jobs' })

  return { ok: true }
}
