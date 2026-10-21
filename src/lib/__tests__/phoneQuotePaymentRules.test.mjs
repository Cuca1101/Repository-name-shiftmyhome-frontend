import test from 'node:test'
import assert from 'node:assert/strict'
import {
  londonWallTimeToUtcMs,
  moveStartClockFromArrival,
  phoneQuoteAdminStatus,
  phoneQuoteFinalTotal,
  phoneQuotePaymentOptions,
} from '../phoneQuotePaymentRules.js'

const ms = (iso) => Date.parse(iso)

test('arrival text gives the move start clock', () => {
  assert.equal(moveStartClockFromArrival('08:00–18:00'), '08:00')
  assert.equal(moveStartClockFromArrival('10:00 (Exact time)'), '10:00')
  assert.equal(moveStartClockFromArrival('Flexible window · 13:00–14:30'), '13:00')
  assert.equal(moveStartClockFromArrival(''), null)
})

test('London wall time converts with GMT and BST', () => {
  assert.equal(londonWallTimeToUtcMs('2026-11-05', '08:00'), ms('2026-11-05T08:00:00Z'))
  assert.equal(londonWallTimeToUtcMs('2026-07-01', '10:00'), ms('2026-07-01T09:00:00Z'))
})

test('deposit stays available on both sides of the 48h boundary', () => {
  const base = { moveDate: '2026-11-05', arrivalTime: '08:00–18:00', total: 300 }
  const at48 = phoneQuotePaymentOptions({ ...base, now: ms('2026-11-03T08:00:00Z') })
  assert.equal(at48.hoursUntilMove, 48)
  assert.equal(at48.depositAllowed, true)
  assert.equal(at48.deposit, 50)
  assert.equal(at48.balanceAfterDeposit, 250)

  const under = phoneQuotePaymentOptions({ ...base, now: ms('2026-11-03T08:00:00.001Z') })
  assert.equal(under.depositAllowed, true)
  assert.equal(under.fullOnlyReason, '')
  assert.equal(under.canPay, true)
  assert.equal(under.balanceAfterDeposit, 250)
})

test('48h boundary in summer time (BST) still allows the deposit', () => {
  const base = { moveDate: '2026-07-10', arrivalTime: '10:00 (Exact time)', total: 200 }
  assert.equal(phoneQuotePaymentOptions({ ...base, now: ms('2026-07-08T09:00:00Z') }).depositAllowed, true)
  assert.equal(phoneQuotePaymentOptions({ ...base, now: ms('2026-07-08T09:00:01Z') }).depositAllowed, true)
})

test('48h is real elapsed time across the October clock change', () => {
  const opts = phoneQuotePaymentOptions({
    moveDate: '2026-10-26',
    arrivalTime: '08:00–12:00',
    total: 200,
    now: ms('2026-10-24T08:00:00Z'),
  })
  assert.equal(opts.hoursUntilMove, 48)
  assert.equal(opts.depositAllowed, true)
})

test('deposit stays available when fewer than 48 hours remain', () => {
  const quote = { moveDate: '2026-11-05', arrivalTime: '09:00–13:00', total: 420 }
  const whenSent = phoneQuotePaymentOptions({ ...quote, now: ms('2026-10-30T12:00:00Z') })
  assert.equal(whenSent.depositAllowed, true)
  const whenPaying = phoneQuotePaymentOptions({ ...quote, now: ms('2026-11-04T10:00:00Z') })
  assert.equal(whenPaying.depositAllowed, true)
  assert.equal(whenPaying.fullOnlyReason, '')
  assert.equal(whenPaying.balanceAfterDeposit, 370)
})

test('no deposit when total is £50 or less, or when already paid', () => {
  const now = ms('2026-10-01T00:00:00Z')
  const low = phoneQuotePaymentOptions({ moveDate: '2026-11-05', total: 50, now })
  assert.equal(low.depositAllowed, false)
  assert.equal(low.fullOnlyReason, 'total_too_low')
  const paid = phoneQuotePaymentOptions({ moveDate: '2026-11-05', total: 300, paymentStatus: 'deposit_paid', amountPaid: 50, now })
  assert.equal(paid.alreadyPaid, true)
  assert.equal(paid.canPay, false)
  assert.equal(paid.depositAllowed, false)
  assert.equal(paid.balance, 250)
  const noDate = phoneQuotePaymentOptions({ moveDate: '', total: 300, now })
  assert.equal(noDate.depositAllowed, true)
  assert.equal(noDate.fullOnlyReason, '')
})

test('final total uses the admin agreed price first', () => {
  assert.equal(phoneQuoteFinalTotal({ agreed_price: '157.82', estimated_total: '110.94' }), 157.82)
  assert.equal(phoneQuoteFinalTotal({ agreed_price: null, estimated_total: '110.94' }), 110.94)
  assert.equal(phoneQuoteFinalTotal({}), null)
})

test('admin status keeps deposit paid separate from paid in full', () => {
  assert.equal(phoneQuoteAdminStatus({ payment_status: 'unpaid' }).label, 'Draft')
  assert.equal(phoneQuoteAdminStatus({ payment_status: 'unpaid', quote_sent_at: '2026-10-14T10:00:00Z' }).label, 'Quote sent')
  assert.equal(phoneQuoteAdminStatus({ payment_status: 'failed', quote_sent_at: '2026-10-14T10:00:00Z' }).label, 'Quote sent')
  assert.equal(phoneQuoteAdminStatus({ payment_status: 'deposit_paid', quote_sent_at: 'x' }).label, 'Deposit paid')
  assert.equal(phoneQuoteAdminStatus({ payment_status: 'paid' }).label, 'Paid in full')
})
