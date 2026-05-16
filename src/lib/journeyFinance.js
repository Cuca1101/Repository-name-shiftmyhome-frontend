import { loadMarketplacePricingDefaults } from './marketplacePricingDefaultsStore'
import {
  computeMarketplacePayoutFromCustomerTotal,
  computePlatformProfitFromPayout,
} from './marketplacePayoutMath'
import { quoteCustomerTotalGbp } from './marketplaceQuoteFinance'

/**
 * Sum of customer totals for bundled quotes (same basis as marketplace math).
 * @param {Record<string, unknown>[]} quotes
 * @returns {number | null}
 */
export function sumQuoteCustomerTotalsGbp(quotes) {
  if (!Array.isArray(quotes) || quotes.length === 0) return null
  let sum = 0
  let any = false
  for (const q of quotes) {
    const v = quoteCustomerTotalGbp(q)
    if (v != null && Number.isFinite(v) && v > 0) {
      sum += v
      any = true
    }
  }
  return any ? Math.round(sum * 100) / 100 : null
}

/**
 * Suggested journey payout from default marketplace deduction rules (display / default only).
 * @param {Record<string, unknown>[]} quotes
 * @returns {{ payout: number, platformProfit: number, deductionLabel: string } | null}
 */
export function suggestJourneyMarketplacePayoutFromQuotes(quotes) {
  const total = sumQuoteCustomerTotalsGbp(quotes)
  if (total == null) return null
  const def = loadMarketplacePricingDefaults()
  const calc = computeMarketplacePayoutFromCustomerTotal(total, def.deductionType, def.deductionValue)
  if (!calc) return null
  return {
    payout: calc.marketplacePayout,
    platformProfit: calc.platformProfit,
    deductionLabel: calc.deductionLabel,
  }
}

/**
 * @param {number | null} customerTotal
 * @param {number | null} payout
 */
export function journeyPlatformProfitGbp(customerTotal, payout) {
  if (customerTotal == null || payout == null) return null
  return computePlatformProfitFromPayout(customerTotal, payout)
}

/**
 * Platform share as % of combined customer total (admin), given payout to partners.
 * @param {number | null} customerTotalGbp
 * @param {number | null} payoutGbp
 * @returns {number | null}
 */
export function effectivePlatformReductionPctOfCustomer(customerTotalGbp, payoutGbp) {
  if (customerTotalGbp == null || payoutGbp == null) return null
  const c = Number(customerTotalGbp)
  const p = Number(payoutGbp)
  if (!Number.isFinite(c) || c <= 0 || !Number.isFinite(p) || p < 0) return null
  return Math.round(((c - p) / c) * 10000) / 100
}
