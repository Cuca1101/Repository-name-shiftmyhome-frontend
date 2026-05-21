import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { resolveFinancials } from './quoteJobAdminModel'
import { quoteAdjustmentsSumGbp } from './marketplaceQuoteFinance'
import {
  loadDefaultPlatformMarginPercent,
  useDefaultMarginEstimatesEnabled,
} from './marketplacePricingDefaultsStore'

export const PAYOUT_STATUSES = [
  { value: 'not_set', label: 'Not set' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'held', label: 'Held' },
  { value: 'disputed', label: 'Disputed' },
]

/** @param {unknown} v */
export function numOrNull(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

/** @param {unknown} status */
export function payoutStatusLabel(status) {
  const s = String(status || 'not_set').toLowerCase()
  const hit = PAYOUT_STATUSES.find((p) => p.value === s)
  return hit?.label || 'Not set'
}

/**
 * @param {number} customerTotal
 * @param {number} marginPct
 */
export function platformProfitFromMargin(customerTotal, marginPct) {
  const t = Number(customerTotal)
  const m = Number(marginPct)
  if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(m) || m < 0 || m > 100) return null
  return Math.round(t * (m / 100) * 100) / 100
}

/**
 * Auto driver payout from margin % (remainder after platform profit and partner payout).
 * @param {number} customerTotal
 * @param {number} marginPct
 * @param {number} [partnerPayout]
 */
export function driverPayoutFromMargin(customerTotal, marginPct, partnerPayout = 0) {
  const t = Number(customerTotal)
  const profit = platformProfitFromMargin(t, marginPct)
  if (profit == null) return null
  const partner = Number(partnerPayout) || 0
  const driver = t - profit - partner
  return Math.round(Math.max(0, driver) * 100) / 100
}

/**
 * Platform profit when payouts are set manually.
 * @param {number | null} customerTotal
 * @param {number | null} driverPayout
 * @param {number | null} partnerPayout
 */
export function platformProfitFromPayouts(customerTotal, driverPayout, partnerPayout) {
  const t = customerTotal != null ? Number(customerTotal) : null
  if (t == null || !Number.isFinite(t)) return null
  const d = driverPayout != null ? Number(driverPayout) : 0
  const p = partnerPayout != null ? Number(partnerPayout) : 0
  if (!Number.isFinite(d) || !Number.isFinite(p)) return null
  return Math.round((t - d - p) * 100) / 100
}

/**
 * Effective margin % from profit and customer total.
 * @param {number | null} customerTotal
 * @param {number | null} platformProfit
 */
export function marginPctFromProfit(customerTotal, platformProfit) {
  const t = Number(customerTotal)
  const pr = Number(platformProfit)
  if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(pr)) return null
  return Math.round((pr / t) * 1000) / 10
}

/**
 * True when admin has saved payout/margin fields — do not overwrite with global default.
 * @param {Record<string, unknown>} q
 */
export function quoteHasSavedPayoutFields(q) {
  if (!q || typeof q !== 'object') return false
  if (q.driver_payout_manual_override || q.partner_payout_manual_override) return true
  if (numOrNull(q.driver_payout_amount) != null) return true
  if (numOrNull(q.partner_payout_amount) != null) return true
  if (numOrNull(q.platform_margin_percent) != null) return true
  if (q.payout_updated_at != null && String(q.payout_updated_at).trim() !== '') return true
  const ps = String(q.payout_status || 'not_set').toLowerCase()
  if (ps !== 'not_set' && q.payout_updated_at) return true
  return false
}

/**
 * @param {Record<string, unknown>} q
 * @param {number} [adjustmentsSumGbp]
 */
export function resolveJobPayoutAccounting(q, adjustmentsSumGbp) {
  const adj = adjustmentsSumGbp ?? quoteAdjustmentsSumGbp(q)
  const fin = resolveFinancials(q, adj)
  const customerTotal = fin.customerTotal
  const overrides = mergedAdminWorkflowForQuote(q)

  const driverRecorded = numOrNull(q.driver_payout_amount)
  const partnerRecorded = numOrNull(q.partner_payout_amount)
  const marginStored = numOrNull(q.platform_margin_percent)
  const profitStored = numOrNull(q.platform_profit_amount)
  const marketplacePayout = numOrNull(q.marketplace_payout_price)

  const driverManual = Boolean(q.driver_payout_manual_override)
  const partnerManual = Boolean(q.partner_payout_manual_override)

  const driverPayout = driverRecorded
  const partnerPayout = partnerRecorded

  let platformProfit = profitStored
  let driverEstimate = driverPayout
  let marginEstimate = marginStored
  let isEstimate = false

  if (platformProfit == null && customerTotal != null) {
    if (driverManual || partnerManual || driverPayout != null || partnerPayout != null) {
      platformProfit = platformProfitFromPayouts(
        customerTotal,
        driverPayout ?? 0,
        partnerPayout ?? 0,
      )
    } else if (marginStored != null) {
      platformProfit = platformProfitFromMargin(customerTotal, marginStored)
    }
  }

  const useDefaultEstimate =
    useDefaultMarginEstimatesEnabled() &&
    !quoteHasSavedPayoutFields(q) &&
    marginStored == null &&
    driverPayout == null &&
    partnerPayout == null &&
    profitStored == null &&
    !driverManual &&
    !partnerManual

  if (useDefaultEstimate && customerTotal != null) {
    const defMargin = loadDefaultPlatformMarginPercent()
    if (Number.isFinite(defMargin)) {
      isEstimate = true
      marginEstimate = defMargin
      platformProfit = platformProfitFromMargin(customerTotal, defMargin)
      driverEstimate = driverPayoutFromMargin(customerTotal, defMargin, 0)
    }
  }

  const marginPct =
    marginEstimate != null
      ? marginEstimate
      : marginPctFromProfit(customerTotal, platformProfit)

  const payoutMissing =
    !isEstimate &&
    driverPayout == null &&
    partnerPayout == null &&
    platformProfit == null &&
    marginStored == null

  return {
    customerTotal,
    paid: fin.paid,
    remaining: fin.remaining,
    driverName: String(q.assigned_driver_name || overrides.assignedDriver || '').trim() || null,
    partnerName: String(q.assigned_partner_company || overrides.assignedPartnerCompany || '').trim() || null,
    driverPayout: driverEstimate,
    partnerPayout,
    marketplacePartnerPayout: marketplacePayout,
    platformProfit,
    marginPct,
    platformMarginPercent: marginEstimate,
    payoutIsEstimate: isEstimate,
    driverManualOverride: driverManual,
    partnerManualOverride: partnerManual,
    payoutStatus: String(q.payout_status || 'not_set').toLowerCase(),
    payoutNotes: String(q.payout_notes || '').trim(),
    payoutUpdatedAt: q.payout_updated_at != null ? String(q.payout_updated_at) : null,
    payoutMissing,
    payoutNotSetLabel: payoutMissing ? 'Payout not set' : isEstimate ? 'Estimate (default margin)' : null,
  }
}

/**
 * @param {Record<string, unknown>} patch
 */
export function buildPayoutAccountingPatch(patch) {
  const out = {}

  if ('platformMarginPercent' in patch) {
    const m = patch.platformMarginPercent
    out.platform_margin_percent =
      m === '' || m == null ? null : numOrNull(m)
  }

  if ('driverPayoutAmount' in patch) {
    out.driver_payout_amount =
      patch.driverPayoutAmount === '' || patch.driverPayoutAmount == null
        ? null
        : numOrNull(patch.driverPayoutAmount)
  }

  if ('partnerPayoutAmount' in patch) {
    out.partner_payout_amount =
      patch.partnerPayoutAmount === '' || patch.partnerPayoutAmount == null
        ? null
        : numOrNull(patch.partnerPayoutAmount)
  }

  if ('driverPayoutManualOverride' in patch) {
    out.driver_payout_manual_override = Boolean(patch.driverPayoutManualOverride)
  }

  if ('partnerPayoutManualOverride' in patch) {
    out.partner_payout_manual_override = Boolean(patch.partnerPayoutManualOverride)
  }

  if ('payoutStatus' in patch) {
    out.payout_status = patch.payoutStatus ? String(patch.payoutStatus) : 'not_set'
  }

  if ('payoutNotes' in patch) {
    out.payout_notes = patch.payoutNotes != null ? String(patch.payoutNotes).trim() : ''
  }

  const customerTotal =
    patch.customerTotalForProfit != null && Number.isFinite(Number(patch.customerTotalForProfit))
      ? Number(patch.customerTotalForProfit)
      : null

  if (customerTotal != null && Object.keys(out).length > 0) {
    const driver =
      'driver_payout_amount' in out
        ? out.driver_payout_amount ?? 0
        : patch.driverPayoutForCalc ?? 0
    const partner =
      'partner_payout_amount' in out
        ? out.partner_payout_amount ?? 0
        : patch.partnerPayoutForCalc ?? 0
    const driverManual = patch.driverPayoutManualOverride === true
    const partnerManual = patch.partnerPayoutManualOverride === true
    const margin =
      'platform_margin_percent' in out
        ? out.platform_margin_percent
        : patch.platformMarginPercent != null
          ? numOrNull(patch.platformMarginPercent)
          : null

    if (driverManual || partnerManual) {
      out.platform_profit_amount = platformProfitFromPayouts(customerTotal, driver, partner)
    } else if (margin != null) {
      out.platform_profit_amount = platformProfitFromMargin(customerTotal, margin)
      if (!driverManual && !('driver_payout_amount' in out && patch.skipAutoDriver)) {
        out.driver_payout_amount = driverPayoutFromMargin(customerTotal, margin, partner)
      }
    } else {
      out.platform_profit_amount = platformProfitFromPayouts(customerTotal, driver, partner)
    }

    out.payout_updated_at = new Date().toISOString()
  }

  return out
}
