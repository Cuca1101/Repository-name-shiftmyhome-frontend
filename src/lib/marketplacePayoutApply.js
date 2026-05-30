import { appendAdminNotesLog } from './adminNotesLog'
import { loadAvailableJobAdminOverrides, saveAvailableJobAdminOverrides } from './availableJobLocalStore'
import { loadMarketplacePricingDefaults } from './marketplacePricingDefaultsStore'
import { computeMarketplacePayoutFromCustomerTotal, computePlatformProfitFromPayout } from './marketplacePayoutMath'
import {
  fetchAssignedByActor,
  updateQuoteWorkflowAssignment,
  updateQuoteWorkflowAssignmentSilent,
} from './data/quotesAdminRepository'
import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { quoteCustomerTotalGbp } from './marketplaceQuoteFinance'
import {
  computeJobAcceptedDefaultPayout,
  resolveJobAcceptedPaymentBreakdown,
} from './jobAcceptedPaymentDisplay'
import { recordDriverPayoutAudit } from './data/driverPayoutAuditRepository'
import { isSupabaseConfigured } from './supabase'

/**
 * @param {Record<string, unknown>} q
 * @param {{
 *   clearManualOverride?: boolean,
 *   source?: 'available_jobs' | 'settings' | 'settings_bulk' | 'marketplace_recalc',
 *   skipIfFixedFromAvailableJobs?: boolean,
 * }} [opts]
 */
export async function applyDefaultMarketplacePayoutToQuote(q, opts = {}) {
  const clearManual = opts.clearManualOverride !== false
  const source = opts.source || 'settings'
  const id = String(q?.id || '').trim()
  if (!id) return

  const cur = loadAvailableJobAdminOverrides(id)
  if (!clearManual && cur.marketplacePayoutManualOverride) return

  if (opts.skipIfFixedFromAvailableJobs) {
    const snap = cur.marketplaceDeductionSnapshot
    if (snap && typeof snap === 'object' && snap.source === 'available_jobs') {
      return
    }
  }

  const customerTotal = quoteCustomerTotalGbp(q)
  if (customerTotal == null || !Number.isFinite(customerTotal)) return

  const def = loadMarketplacePricingDefaults()
  const calc = computeMarketplacePayoutFromCustomerTotal(customerTotal, def.deductionType, def.deductionValue)
  if (!calc) return

  const appliedAt = new Date().toISOString()

  saveAvailableJobAdminOverrides(id, {
    marketplacePayoutGbp: calc.marketplacePayout,
    marketplacePayoutManualOverride: false,
    marketplaceDeductionSnapshot: {
      type: def.deductionType,
      value: def.deductionValue,
      source,
      appliedAt,
    },
  })

  await updateQuoteWorkflowAssignmentSilent(id, {
    marketplace_payout_price: calc.marketplacePayout,
    platform_profit_amount: calc.platformProfit,
    driver_payout_amount: calc.marketplacePayout,
    driver_payout_manual_override: false,
    marketplace_deduction_type: def.deductionType,
    marketplace_deduction_value: def.deductionValue,
    payout_updated_at: appliedAt,
  })
}

/**
 * @param {Record<string, unknown>[]} quotes
 */
export async function recalcMarketplacePayoutsAll(quotes, clearManualOverrides) {
  for (const q of quotes) {
    const mv = String(q.marketplace_visibility || '')
    if (mv !== 'visible_in_marketplace') continue
    await applyDefaultMarketplacePayoutToQuote(q, {
      clearManualOverride: clearManualOverrides,
      source: 'settings_bulk',
      skipIfFixedFromAvailableJobs: !clearManualOverrides,
    })
  }
}

/**
 * Apply default deduction to every Available Jobs quote (preview/save payout before marketplace publish).
 * @param {Record<string, unknown>[]} quotes
 */
export async function recalcAvailableJobsPayoutsAll(quotes, clearManualOverrides) {
  for (const q of quotes) {
    await applyDefaultMarketplacePayoutToQuote(q, {
      clearManualOverride: clearManualOverrides,
      source: 'available_jobs',
      skipIfFixedFromAvailableJobs: !clearManualOverrides,
    })
  }
}

/**
 * @param {string} quoteId
 * @param {Record<string, unknown>} q
 * @param {number} payoutGbp
 */
export async function setManualMarketplacePayout(quoteId, q, payoutGbp) {
  const id = String(quoteId || '').trim()
  if (!id || !Number.isFinite(payoutGbp) || payoutGbp < 0) return

  saveAvailableJobAdminOverrides(id, {
    marketplacePayoutGbp: payoutGbp,
    marketplacePayoutManualOverride: true,
    marketplaceDeductionSnapshot: null,
  })

  const customerTotal = quoteCustomerTotalGbp(q)
  const profit =
    customerTotal != null && Number.isFinite(payoutGbp)
      ? computePlatformProfitFromPayout(customerTotal, payoutGbp)
      : null

  await updateQuoteWorkflowAssignmentSilent(id, {
    marketplace_payout_price: payoutGbp,
    driver_payout_amount: payoutGbp,
    driver_payout_manual_override: true,
    platform_profit_amount: profit,
  })
}

/**
 * Manual driver payout override for Job Accepted / job detail (admin only).
 * @param {string} quoteId
 * @param {Record<string, unknown>} q
 * @param {number} payoutGbp
 * @param {string} [reason]
 */
export async function setManualJobAcceptedDriverPayout(quoteId, q, payoutGbp, reason = '') {
  const id = String(quoteId || '').trim()
  if (!id || !Number.isFinite(payoutGbp) || payoutGbp < 0) return

  const before = resolveJobAcceptedPaymentBreakdown(q)
  const defaultPayout =
    before.defaultDriverPayout ?? computeJobAcceptedDefaultPayout(q)?.driverPayout ?? null

  await setManualMarketplacePayout(id, q, payoutGbp)

  await recordDriverPayoutAudit({
    quoteId: id,
    quoteRef: String(q.quote_ref || id.slice(0, 8)),
    driverId: q.assigned_driver_id != null ? String(q.assigned_driver_id) : null,
    driverName: String(q.assigned_driver_name || '').trim(),
    action: 'manual_override',
    defaultPayoutGbp: defaultPayout,
    newPayoutGbp: payoutGbp,
    reason: String(reason || '').trim(),
  })

  const note = String(reason || '').trim()
  const patch = /** @type {Record<string, unknown>} */ ({
    driver_payout_amount: payoutGbp,
    driver_payout_manual_override: true,
  })
  if (note) patch.payout_notes = note

  if (note && isSupabaseConfigured) {
    const actor = await fetchAssignedByActor()
    const m = mergedAdminWorkflowForQuote(q)
    patch.admin_notes_log = appendAdminNotesLog(
      m.adminNotesLog,
      actor,
      `Driver payout override: £${payoutGbp.toFixed(2)} — ${note}`,
    )
  }

  await updateQuoteWorkflowAssignmentSilent(id, patch)
}

/**
 * Restore automatic marketplace deduction payout for a job.
 * @param {Record<string, unknown>} q
 */
export async function resetJobAcceptedDriverPayoutToDefault(q) {
  const id = String(q?.id || '').trim()
  if (!id) return

  const before = resolveJobAcceptedPaymentBreakdown(q)
  const previousPayout = before.driverPayout

  await applyDefaultMarketplacePayoutToQuote(q, { clearManualOverride: true })

  const afterDefault = computeJobAcceptedDefaultPayout(q)?.driverPayout ?? null

  await recordDriverPayoutAudit({
    quoteId: id,
    quoteRef: String(q.quote_ref || id.slice(0, 8)),
    driverId: q.assigned_driver_id != null ? String(q.assigned_driver_id) : null,
    driverName: String(q.assigned_driver_name || '').trim(),
    action: 'reset_to_default',
    defaultPayoutGbp: before.defaultDriverPayout ?? previousPayout,
    newPayoutGbp: afterDefault,
    reason: 'Reset to marketplace default payout',
  })
}

/**
 * Partner Dashboard feed: hidden jobs stay in admin Marketplace but are not shown to partners.
 * @param {string} quoteId
 * @param {boolean} hidden
 */
export async function setPartnerDashboardHiddenForQuote(quoteId, hidden) {
  const id = String(quoteId || '').trim()
  if (!id) return
  saveAvailableJobAdminOverrides(id, { partnerDashboardHidden: Boolean(hidden) })
  await updateQuoteWorkflowAssignmentSilent(id, { partner_dashboard_hidden: Boolean(hidden) })
}

/**
 * Remove a single job from the marketplace (returns to Available Jobs; unbundles if needed).
 * @param {string} quoteId
 * @param {Record<string, unknown>} [quote]
 */
export async function withdrawQuoteFromMarketplace(quoteId, quote = null) {
  const id = String(quoteId || '').trim()
  if (!id) return

  if (!isSupabaseConfigured) {
    saveAvailableJobAdminOverrides(id, {
      marketplaceVisibility: 'hidden_from_partners',
      partnerDashboardHidden: false,
    })
    return
  }

  const q = quote && typeof quote === 'object' ? quote : {}
  const actor = await fetchAssignedByActor()
  const m = mergedAdminWorkflowForQuote(q)
  const log = appendAdminNotesLog(m.adminNotesLog, actor, 'Removed from marketplace (admin).')

  await updateQuoteWorkflowAssignment(id, {
    marketplace_visibility: 'hidden_from_partners',
    assigned_driver_id: null,
    assigned_driver_name: null,
    assigned_partner_id: null,
    assigned_partner_company: null,
    operational_status: null,
    admin_notes_log: log,
  })
  await updateQuoteWorkflowAssignmentSilent(id, {
    partner_dashboard_hidden: false,
    bundled_journey_id: null,
  })
}
