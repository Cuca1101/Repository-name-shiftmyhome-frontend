import { resolveCalculatedTotal } from './adminAgreedPrice.js'

/**
 * @typedef {{ id: string, amountGbp: number }} CustomerMoneyRecord
 */

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

function moneyAmount(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return round2(n)
}

/**
 * Charge the customer agreed to. A stored remaining_balance of 0 is not the price
 * when the quote total is higher.
 * @param {Record<string, unknown>} quote
 * @param {number} adjustmentsGbp
 */
function displayTotal(quote, adjustmentsGbp) {
  const rawAgreed = quote.agreed_price
  const agreed =
    rawAgreed != null && String(rawAgreed).trim() !== '' ? Number(rawAgreed) : Number.NaN
  const base = Number.isFinite(agreed) && agreed >= 0 ? round2(agreed) : resolveCalculatedTotal(quote)
  if (base == null) return null
  return round2(base + (Number(adjustmentsGbp) || 0))
}

/**
 * Display-only payment label and amounts. Does not write payments or change booking.
 *
 * `amount_paid` is one confirmed receipt: the Stripe amount received, or a manual
 * amount. Another row with the same payment id is the same payment. Refunds are
 * subtracted once. If `amount_paid` is already the net of those refunds, they are
 * not subtracted again.
 *
 * @param {Record<string, unknown> | null | undefined} quote
 * @param {{
 *   adjustmentsGbp?: number,
 *   payments?: CustomerMoneyRecord[],
 *   refunds?: CustomerMoneyRecord[],
 * }} [options]
 */
export function resolveCustomerPaymentSummary(quote, options = {}) {
  const q = quote && typeof quote === 'object' ? quote : {}
  const status = String(q.payment_status || '').toLowerCase()
  const type = String(q.payment_type || '').toLowerCase()
  const intent = String(q.stripe_payment_intent_id || '').trim()
  const recorded = moneyAmount(q.amount_paid)
  const confirmedBooking = status !== 'failed' && recorded > 0
  const bookingKey = intent || (confirmedBooking ? `manual:${String(q.id || 'quote')}` : '')

  /** @type {Map<string, number>} */
  const payments = new Map()
  if (confirmedBooking && bookingKey) payments.set(bookingKey, recorded)

  let sameIntentGross = recorded
  for (const row of options.payments || []) {
    const id = String(row?.id || '').trim()
    const amount = moneyAmount(row?.amountGbp)
    if (!id || amount <= 0) continue
    if (id === bookingKey) {
      sameIntentGross = Math.max(sameIntentGross, amount)
      continue
    }
    if (payments.has(id)) continue
    payments.set(id, amount)
  }

  /** @type {Map<string, number>} */
  const refunds = new Map()
  for (const row of options.refunds || []) {
    const id = String(row?.id || '').trim()
    const amount = moneyAmount(row?.amountGbp)
    if (!id || amount <= 0 || refunds.has(id)) continue
    refunds.set(id, amount)
  }

  const refundSum = round2([...refunds.values()].reduce((sum, amount) => sum + amount, 0))
  const extraSum = round2(
    [...payments.entries()]
      .filter(([id]) => id !== bookingKey)
      .reduce((sum, [, amount]) => sum + amount, 0),
  )
  const alreadyNet =
    confirmedBooking &&
    refundSum > 0 &&
    recorded + 0.02 < sameIntentGross &&
    Math.abs(recorded - Math.max(0, sameIntentGross - refundSum)) <= 0.02
  const bookingNet = alreadyNet ? recorded : round2(Math.max(0, recorded - refundSum))
  const paid = confirmedBooking || extraSum > 0 ? round2(Math.max(0, bookingNet + extraSum)) : 0

  const total = displayTotal(q, options.adjustmentsGbp || 0)
  const remaining = total != null ? round2(Math.max(0, total - paid)) : null
  const fullyPaid = total != null && paid > 0 && paid + 0.009 >= total

  let label = 'Unpaid'
  let tone = 'slate'
  if (paid <= 0) {
    label = 'Unpaid'
    tone = 'slate'
  } else if (fullyPaid) {
    label = 'Paid in full'
    tone = 'emerald'
  } else if ((status === 'deposit_paid' || type === 'deposit') && extraSum <= 0) {
    label = 'Deposit paid'
    tone = 'orange'
  } else {
    label = 'Partially paid'
    tone = 'orange'
  }

  return { total, paid, remaining, label, tone }
}
