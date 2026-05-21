import { isDriverChargeDeductible } from './driverChargeConstants'
import { resolveJobPayoutAccounting } from './jobPayoutAccounting'

/**
 * @param {unknown} v
 */
export function roundMoney(v) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

/**
 * @param {Array<{ status?: string, amount?: unknown }>} charges
 */
export function sumDeductibleDriverCharges(charges) {
  let sum = 0
  for (const c of charges || []) {
    if (!isDriverChargeDeductible(c.status)) continue
    const a = Number(c.amount)
    if (Number.isFinite(a) && a > 0) sum += a
  }
  return roundMoney(sum)
}

/**
 * Adjusted platform profit when driver charges are recovered by the business.
 * @param {number | null} customerTotal
 * @param {number | null} driverGrossPayout
 * @param {number | null} partnerPayout
 * @param {number} driverChargesDeducted
 */
export function adjustedPlatformProfitWithCharges(
  customerTotal,
  driverGrossPayout,
  partnerPayout,
  driverChargesDeducted,
) {
  const t = customerTotal != null ? Number(customerTotal) : null
  if (t == null || !Number.isFinite(t)) return null
  const d = driverGrossPayout != null ? Number(driverGrossPayout) : 0
  const p = partnerPayout != null ? Number(partnerPayout) : 0
  const ch = Number(driverChargesDeducted) || 0
  return roundMoney(t - d - p + ch)
}

/**
 * @param {Record<string, unknown>} quote
 * @param {Array<Record<string, unknown>>} [charges]
 * @param {number} [adjustmentsSumGbp]
 */
export function resolveJobPayoutWithDriverCharges(quote, charges = [], adjustmentsSumGbp) {
  const base = resolveJobPayoutAccounting(quote, adjustmentsSumGbp)
  const jobCharges = Array.isArray(charges) ? charges : []
  const deductions = sumDeductibleDriverCharges(jobCharges)
  const grossDriver = base.driverPayout
  const netDriver =
    grossDriver != null ? roundMoney(Math.max(0, Number(grossDriver) - deductions)) : null

  const adjustedProfit = adjustedPlatformProfitWithCharges(
    base.customerTotal,
    grossDriver,
    base.partnerPayout,
    deductions,
  )

  return {
    ...base,
    driverCharges: jobCharges,
    driverChargesCount: jobCharges.length,
    driverDeductions: deductions > 0 ? deductions : null,
    driverPayoutGross: grossDriver,
    driverPayoutNet: netDriver,
    platformProfitAdjusted: adjustedProfit,
    platformProfitGross: base.platformProfit,
  }
}

/**
 * ISO week key YYYY-Www from date.
 * @param {Date} d
 */
export function isoWeekKey(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/**
 * @param {unknown} q
 */
export function quotePayrollTimestamp(q) {
  const paid = q?.paid_at ? new Date(String(q.paid_at)).getTime() : 0
  if (Number.isFinite(paid) && paid > 0) return paid
  const mv = q?.move_date ? new Date(String(q.move_date)).getTime() : 0
  if (Number.isFinite(mv) && mv > 0) return mv
  const cr = q?.created_at ? new Date(String(q.created_at)).getTime() : 0
  return Number.isFinite(cr) ? cr : 0
}
