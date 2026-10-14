// deno-lint-ignore-file no-explicit-any
// @ts-nocheck
/**
 * Payment options for a phone quote sent by email.
 * Copy of src/lib/phoneQuotePaymentRules.js - keep both files identical in behaviour.
 */

export const PHONE_QUOTE_DEPOSIT_GBP = 50
export const PHONE_QUOTE_DEPOSIT_MIN_HOURS = 48
export const PHONE_QUOTE_DEFAULT_START = '08:00'
const LONDON_TZ = 'Europe/London'

/**
 * First HH:MM in the saved arrival text, e.g. "08:00â€“18:00" or "10:00 (Exact time)".
 * @param {unknown} arrivalTime
 * @returns {string | null}
 */
export function moveStartClockFromArrival(arrivalTime) {
  const m = String(arrivalTime ?? '').match(/(\d{1,2}):(\d{2})/)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (!Number.isInteger(hh) || hh > 23 || !Number.isInteger(mm) || mm > 59) return null
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function londonOffsetMs(utcMs) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (t) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(utcMs / 1000) * 1000
}

/**
 * UTC ms for a wall-clock date + time in Europe/London.
 * @param {string} dateYmd YYYY-MM-DD
 * @param {string} clock HH:MM
 * @returns {number | null}
 */
export function londonWallTimeToUtcMs(dateYmd, clock) {
  const d = String(dateYmd ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  const t = String(clock ?? '').trim().match(/^(\d{2}):(\d{2})$/)
  if (!d || !t) return null
  const guess = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]))
  let utc = guess - londonOffsetMs(guess)
  const second = guess - londonOffsetMs(utc)
  if (second !== utc) utc = second
  return Number.isFinite(utc) ? utc : null
}

function roundGbp(n) {
  return Math.round(n * 100) / 100
}

/**
 * @param {{
 *   moveDate: unknown,
 *   arrivalTime?: unknown,
 *   total: unknown,
 *   amountPaid?: unknown,
 *   paymentStatus?: unknown,
 *   now?: number,
 *   depositGbp?: number,
 * }} input
 */
export function phoneQuotePaymentOptions({
  moveDate,
  arrivalTime,
  total,
  amountPaid = 0,
  paymentStatus = '',
  now = Date.now(),
  depositGbp = PHONE_QUOTE_DEPOSIT_GBP,
}) {
  const totalGbp = Number(total)
  const safeTotal = Number.isFinite(totalGbp) && totalGbp > 0 ? roundGbp(totalGbp) : null
  const paid = Math.max(0, Number(amountPaid) || 0)
  const ps = String(paymentStatus ?? '').trim().toLowerCase()
  const startClock = moveStartClockFromArrival(arrivalTime) || PHONE_QUOTE_DEFAULT_START
  const moveStartMs = londonWallTimeToUtcMs(String(moveDate ?? ''), startClock)
  const hoursUntilMove = moveStartMs == null ? null : (moveStartMs - now) / 3_600_000

  const alreadyPaid = ps === 'paid' || ps === 'deposit_paid'
  const depositAllowed =
    !alreadyPaid &&
    safeTotal != null &&
    safeTotal > depositGbp &&
    hoursUntilMove != null &&
    hoursUntilMove >= PHONE_QUOTE_DEPOSIT_MIN_HOURS

  let fullOnlyReason = ''
  if (!alreadyPaid && !depositAllowed) {
    if (hoursUntilMove == null) fullOnlyReason = 'no_move_date'
    else if (hoursUntilMove < PHONE_QUOTE_DEPOSIT_MIN_HOURS) fullOnlyReason = 'under_48h'
    else if (safeTotal != null && safeTotal <= depositGbp) fullOnlyReason = 'total_too_low'
  }

  return {
    total: safeTotal,
    amountPaid: roundGbp(paid),
    balance: safeTotal == null ? null : roundGbp(Math.max(0, safeTotal - paid)),
    alreadyPaid,
    canPay: !alreadyPaid && safeTotal != null,
    depositAllowed,
    fullOnlyReason,
    deposit: depositGbp,
    balanceAfterDeposit: safeTotal == null ? null : roundGbp(Math.max(0, safeTotal - depositGbp)),
    hoursUntilMove: hoursUntilMove == null ? null : Math.round(hoursUntilMove * 100) / 100,
    moveStartIso: moveStartMs == null ? null : new Date(moveStartMs).toISOString(),
    moveStartClock: startClock,
  }
}

/**
 * Final price the customer pays: admin-agreed price first, then the calculated estimate.
 * @param {Record<string, unknown>} q
 */
export function phoneQuoteFinalTotal(q) {
  const agreed = Number(q?.agreed_price)
  if (Number.isFinite(agreed) && agreed > 0) return roundGbp(agreed)
  const est = Number(q?.estimated_total)
  return Number.isFinite(est) && est > 0 ? roundGbp(est) : null
}

/**
 * Admin list status for a phone booking.
 * @param {Record<string, unknown>} q
 * @returns {{ key: 'draft' | 'quote_sent' | 'deposit_paid' | 'paid_in_full', label: string }}
 */
export function phoneQuoteAdminStatus(q) {
  const ps = String(q?.payment_status ?? '').trim().toLowerCase()
  if (ps === 'paid') return { key: 'paid_in_full', label: 'Paid in full' }
  if (ps === 'deposit_paid') return { key: 'deposit_paid', label: 'Deposit paid' }
  if (q?.quote_sent_at) return { key: 'quote_sent', label: 'Quote sent' }
  return { key: 'draft', label: 'Draft' }
}
