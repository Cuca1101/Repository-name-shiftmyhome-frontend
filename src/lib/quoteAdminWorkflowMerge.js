import { loadAvailableJobAdminOverrides } from './availableJobLocalStore'
import { numOrNull } from './jobPayoutAccounting'

/**
 * Merge persisted quote workflow columns (Supabase) with sessionStorage overrides.
 * When `quotes.marketplace_visibility` exists on the row (post-migration), DB wins for workflow fields;
 * otherwise behaviour matches legacy session-only data.
 *
 * @param {Record<string, unknown>|null|undefined} q
 * @returns {Record<string, unknown>}
 */
export function mergedAdminWorkflowForQuote(q) {
  const id = String(q?.id || '').trim()
  const s = id ? loadAvailableJobAdminOverrides(id) : loadAvailableJobAdminOverrides('')
  if (!q || typeof q !== 'object') return s

  if (typeof q.marketplace_visibility !== 'string') {
    return s
  }

  const payoutRaw = q.marketplace_payout_price
  let marketplacePayoutGbp = s.marketplacePayoutGbp
  if (payoutRaw != null && payoutRaw !== '') {
    const n = Number(payoutRaw)
    if (Number.isFinite(n)) marketplacePayoutGbp = n
  } else if (numOrNull(q.driver_payout_amount) != null) {
    marketplacePayoutGbp = Number(q.driver_payout_amount)
  }

  const marketplacePayoutManualOverride =
    Boolean(q.driver_payout_manual_override) || Boolean(s.marketplacePayoutManualOverride)

  return {
    ...s,
    marketplaceVisibility: q.marketplace_visibility,
    marketplacePayoutGbp,
    marketplacePayoutManualOverride,
    assignedDriver: q.assigned_driver_name != null ? String(q.assigned_driver_name) : '',
    assignedPartnerCompany: q.assigned_partner_company != null ? String(q.assigned_partner_company) : '',
    operationalStatus: q.operational_status != null ? String(q.operational_status) : '',
    revealCustomerTotalToPartners:
      typeof q.allow_partner_customer_total_view === 'boolean'
        ? q.allow_partner_customer_total_view
        : Boolean(s.revealCustomerTotalToPartners),
    partnerDashboardHidden:
      typeof q.partner_dashboard_hidden === 'boolean'
        ? q.partner_dashboard_hidden
        : Boolean(s.partnerDashboardHidden),
    adminNotesLog:
      q.admin_notes_log != null && String(q.admin_notes_log).length > 0
        ? String(q.admin_notes_log)
        : s.adminNotesLog || '',
    adminCompletionNote:
      q.admin_completion_note != null ? String(q.admin_completion_note) : s.adminCompletionNote || '',
    adminCancellationReason:
      q.admin_cancellation_reason != null ? String(q.admin_cancellation_reason) : s.adminCancellationReason || '',
    workflowCompletedAt: q.completed_at != null ? String(q.completed_at) : s.workflowCompletedAt || '',
    workflowCancelledAt: q.cancelled_at != null ? String(q.cancelled_at) : s.workflowCancelledAt || '',
  }
}
