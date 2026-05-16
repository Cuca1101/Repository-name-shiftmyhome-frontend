/**
 * @param {unknown} n
 */
function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

/**
 * @param {'percentage' | 'fixed'} deductionType
 * @param {number} deductionValue
 */
export function formatMarketplaceDeductionLabel(deductionType, deductionValue) {
  if (deductionType === 'percentage') return `${Number(deductionValue)}%`
  return `£${round2(deductionValue).toFixed(2)}`
}

/**
 * @param {number} customerTotalGbp
 * @param {'percentage' | 'fixed'} deductionType
 * @param {number} deductionValue
 * @returns {{ marketplacePayout: number, platformProfit: number, deductionLabel: string } | null}
 */
export function computeMarketplacePayoutFromCustomerTotal(customerTotalGbp, deductionType, deductionValue) {
  if (!Number.isFinite(customerTotalGbp) || customerTotalGbp <= 0) return null
  const v = Number(deductionValue)
  if (!Number.isFinite(v) || v < 0) return null

  let marketplacePayout
  let platformProfit

  if (deductionType === 'percentage') {
    const pct = Math.min(100, Math.max(0, v))
    platformProfit = round2(customerTotalGbp * (pct / 100))
    marketplacePayout = round2(customerTotalGbp - platformProfit)
  } else {
    const fixed = Math.min(customerTotalGbp, Math.max(0, v))
    platformProfit = round2(fixed)
    marketplacePayout = round2(customerTotalGbp - fixed)
  }

  return {
    marketplacePayout,
    platformProfit,
    deductionLabel: formatMarketplaceDeductionLabel(deductionType, deductionValue),
  }
}

/**
 * Profit when payout was set manually (or from stored payout).
 * @param {number} customerTotalGbp
 * @param {number} marketplacePayoutGbp
 */
export function computePlatformProfitFromPayout(customerTotalGbp, marketplacePayoutGbp) {
  if (!Number.isFinite(customerTotalGbp) || !Number.isFinite(marketplacePayoutGbp)) return null
  return round2(customerTotalGbp - marketplacePayoutGbp)
}
