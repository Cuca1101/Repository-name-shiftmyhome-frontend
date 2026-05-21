import { numOrNull, payoutStatusLabel } from './jobPayoutAccounting'
import { resolveJobPayoutWithDriverCharges, roundMoney } from './driverChargeAccounting'
import { updateQuoteWorkflowAssignmentSilent } from './data/quotesAdminRepository'

export const PAYOUT_PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
]

/**
 * @param {number | null | undefined} netPayable
 * @param {number} paidAmount
 * @param {string} [explicitStatus]
 */
export function computePayoutSettlement(netPayable, paidAmount, explicitStatus) {
  const net =
    netPayable != null && Number.isFinite(Number(netPayable))
      ? roundMoney(Math.max(0, Number(netPayable)))
      : null
  const paid = roundMoney(Math.max(0, Number(paidAmount) || 0))
  const remaining = net != null ? roundMoney(Math.max(0, net - paid)) : null
  const ps = String(explicitStatus || '').toLowerCase()

  if (ps === 'held' || ps === 'disputed') {
    return { netPayable: net, paidAmount: paid, remainingBalance: remaining, settlementStatus: ps }
  }

  if (net == null) {
    const status = paid > 0 ? 'partially_paid' : ps === 'not_set' || !ps ? 'pending' : ps
    return { netPayable: null, paidAmount: paid, remainingBalance: null, settlementStatus: status }
  }

  if (paid >= net - 0.005) {
    return { netPayable: net, paidAmount: paid, remainingBalance: 0, settlementStatus: 'paid' }
  }
  if (paid > 0) {
    return { netPayable: net, paidAmount: paid, remainingBalance: remaining, settlementStatus: 'partially_paid' }
  }

  const status =
    ps === 'paid' || ps === 'partially_paid' || ps === 'pending' || ps === 'not_set'
      ? ps === 'not_set' || !ps
        ? 'pending'
        : ps
      : ps === 'held' || ps === 'disputed'
        ? ps
        : 'pending'

  return { netPayable: net, paidAmount: paid, remainingBalance: remaining, settlementStatus: status }
}

/**
 * @param {ReturnType<typeof resolveJobPayoutWithDriverCharges>} payoutBase
 * @param {Record<string, unknown>} quote
 */
export function enrichPayoutWithSettlement(payoutBase, quote) {
  const paid = numOrNull(quote.payout_paid_amount) ?? 0
  const net = payoutBase.driverPayoutNet ?? payoutBase.driverPayout
  const s = computePayoutSettlement(net, paid, quote.payout_status)

  return {
    ...payoutBase,
    payoutPaidAmount: paid > 0 ? paid : null,
    payoutPaidAt: quote.payout_paid_at != null ? String(quote.payout_paid_at) : null,
    payoutPaymentMethod:
      quote.payout_payment_method != null ? String(quote.payout_payment_method) : null,
    payoutReference: quote.payout_reference != null ? String(quote.payout_reference) : null,
    payoutRemainingBalance: s.remainingBalance,
    payoutSettlementStatus: s.settlementStatus,
    payoutSettlementLabel: payoutStatusLabel(s.settlementStatus),
  }
}

/**
 * @param {Record<string, unknown>} quote
 * @param {Array<Record<string, unknown>>} [charges]
 */
export function resolveDriverPayoutSettlement(quote, charges = []) {
  return enrichPayoutWithSettlement(resolveJobPayoutWithDriverCharges(quote, charges), quote)
}

/**
 * @param {string | null | undefined} existing
 * @param {string | null | undefined} addition
 */
function mergePayoutNotes(existing, addition) {
  const a = String(addition || '').trim()
  if (!a) return String(existing || '').trim()
  const e = String(existing || '').trim()
  if (!e) return a
  return `${e}\n${a}`
}

/**
 * @param {string} quoteId
 * @param {Record<string, unknown>} quote
 * @param {Array<Record<string, unknown>>} charges
 * @param {{
 *   mode: 'full' | 'partial' | 'note_only',
 *   amountPaid?: number,
 *   paidAt?: string,
 *   method?: string,
 *   reference?: string,
 *   notes?: string,
 * }} input
 */
export async function recordDriverPayoutPayment(quoteId, quote, charges, input) {
  const settlement = resolveDriverPayoutSettlement(quote, charges)
  const net = settlement.driverPayoutNet ?? 0
  const currentPaid = settlement.payoutPaidAmount ?? 0
  const remaining = settlement.payoutRemainingBalance ?? roundMoney(Math.max(0, net - currentPaid))

  let addAmount = 0
  if (input.mode === 'full') {
    addAmount = remaining
  } else if (input.mode === 'partial') {
    addAmount = roundMoney(Number(input.amountPaid) || 0)
    if (addAmount <= 0) throw new Error('Enter a payment amount greater than zero.')
    if (addAmount > remaining + 0.01) {
      throw new Error(`Amount cannot exceed remaining balance (£${remaining.toFixed(2)}).`)
    }
  }

  const newPaid = roundMoney(currentPaid + addAmount)
  const computed = computePayoutSettlement(net, newPaid, null)

  const patch = {
    payout_paid_amount: newPaid,
    payout_paid_at: input.paidAt || new Date().toISOString(),
    payout_payment_method: input.method ? String(input.method) : null,
    payout_reference: input.reference ? String(input.reference).trim() : null,
    payout_status: computed.settlementStatus,
    payout_notes: mergePayoutNotes(quote.payout_notes, input.notes),
    payout_updated_at: new Date().toISOString(),
  }

  return updateQuoteWorkflowAssignmentSilent(String(quoteId), patch)
}

/**
 * @param {Record<string, unknown>[]} quotes
 * @param {Array<{ quoteId?: string | null }>} charges
 */
/**
 * Mark all jobs in a week with full remaining balance paid.
 * @param {Array<{ quoteId: string, quote: Record<string, unknown>, charges: unknown[], remaining: number }>} weekJobs
 */
export async function recordWeekDriverPayoutsPaid(weekJobs) {
  for (const j of weekJobs) {
    if (!j.remaining || j.remaining <= 0.005) continue
    await recordDriverPayoutPayment(j.quoteId, j.quote, j.charges || [], {
      mode: 'full',
      notes: 'Bulk week settlement',
    })
  }
}

export function aggregateDriverPayoutSettlementKpis(quotes, charges = []) {
  const chargesByQuote = new Map()
  for (const c of charges || []) {
    const qid = c.quoteId
    if (!qid) continue
    if (!chargesByQuote.has(qid)) chargesByQuote.set(qid, [])
    chargesByQuote.get(qid).push(c)
  }

  let gross = 0
  let deductions = 0
  let net = 0
  let paidToDrivers = 0
  let pending = 0

  for (const q of quotes || []) {
    const ps = String(q.payment_status || '')
    if (ps !== 'paid' && ps !== 'deposit_paid') continue
    if (!q.assigned_driver_id && !q.assigned_driver_name) continue

    const qCharges = chargesByQuote.get(String(q.id)) || []
    const s = resolveDriverPayoutSettlement(q, qCharges)
    if (s.driverPayoutGross != null) gross += s.driverPayoutGross
    if (s.driverDeductions != null) deductions += s.driverDeductions
    if (s.driverPayoutNet != null) net += s.driverPayoutNet
    paidToDrivers += s.payoutPaidAmount ?? 0
    pending += s.payoutRemainingBalance ?? 0
  }

  return {
    grossDriverPayouts: roundMoney(gross),
    driverDeductions: roundMoney(deductions),
    netDriverPayouts: roundMoney(net),
    paidToDrivers: roundMoney(paidToDrivers),
    pendingDriverPayouts: roundMoney(pending),
  }
}
