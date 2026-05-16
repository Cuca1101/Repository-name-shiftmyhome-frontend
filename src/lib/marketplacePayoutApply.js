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
import { isSupabaseConfigured } from './supabase'

/**
 * @param {Record<string, unknown>} q
 * @param {{ clearManualOverride?: boolean }} [opts]
 */
export async function applyDefaultMarketplacePayoutToQuote(q, opts = {}) {
  const clearManual = opts.clearManualOverride !== false
  const id = String(q?.id || '').trim()
  if (!id) return

  const cur = loadAvailableJobAdminOverrides(id)
  if (!clearManual && cur.marketplacePayoutManualOverride) return

  const customerTotal = quoteCustomerTotalGbp(q)
  if (customerTotal == null || !Number.isFinite(customerTotal)) return

  const def = loadMarketplacePricingDefaults()
  const calc = computeMarketplacePayoutFromCustomerTotal(customerTotal, def.deductionType, def.deductionValue)
  if (!calc) return

  saveAvailableJobAdminOverrides(id, {
    marketplacePayoutGbp: calc.marketplacePayout,
    marketplacePayoutManualOverride: false,
    marketplaceDeductionSnapshot: { type: def.deductionType, value: def.deductionValue },
  })

  await updateQuoteWorkflowAssignmentSilent(id, {
    marketplace_payout_price: calc.marketplacePayout,
    platform_profit_amount: calc.platformProfit,
    marketplace_deduction_type: def.deductionType,
    marketplace_deduction_value: def.deductionValue,
  })
}

/**
 * @param {Record<string, unknown>[]} quotes
 */
export async function recalcMarketplacePayoutsAll(quotes, clearManualOverrides) {
  for (const q of quotes) {
    const mv = String(q.marketplace_visibility || '')
    if (mv !== 'visible_in_marketplace') continue
    await applyDefaultMarketplacePayoutToQuote(q, { clearManualOverride: clearManualOverrides })
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
    platform_profit_amount: profit,
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
