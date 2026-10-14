import test from 'node:test'
import assert from 'node:assert/strict'
import {
  quotePassesAvailableJobsStrict,
  quoteShowsOnNewPhoneBookingInbox,
} from '../adminJobListRules.js'
import { phoneQuoteAdminStatus } from '../phoneQuotePaymentRules.js'

const base = {
  id: '00000000-0000-4000-8000-000000000001',
  quote_ref: 'SMH-2026-000001',
  source: 'phone_booking',
  status: 'Booked',
  payment_status: 'unpaid',
  operational_status: 'phone_booking_pending',
  amount_paid: 0,
}

test('draft / quote sent: stays in My jobs created, not in Available Jobs', () => {
  const sent = { ...base, quote_sent_at: '2026-10-14T10:00:00Z' }
  assert.equal(quoteShowsOnNewPhoneBookingInbox(sent), true)
  assert.equal(quotePassesAvailableJobsStrict(sent), false)
  assert.equal(phoneQuoteAdminStatus(sent).label, 'Quote sent')
})

test('after payment the webhook releases the quote: Available Jobs, not the inbox', () => {
  const deposit = {
    ...base,
    status: 'deposit_paid',
    payment_status: 'deposit_paid',
    payment_type: 'deposit',
    amount_paid: 50,
    remaining_balance: 270,
    operational_status: null,
    marketplace_visibility: 'hidden_from_partners',
  }
  assert.equal(quoteShowsOnNewPhoneBookingInbox(deposit), false)
  assert.equal(quotePassesAvailableJobsStrict(deposit), true)
  assert.equal(phoneQuoteAdminStatus(deposit).label, 'Deposit paid')

  const full = { ...deposit, status: 'Booked', payment_status: 'paid', payment_type: 'full', amount_paid: 320, remaining_balance: 0 }
  assert.equal(quotePassesAvailableJobsStrict(full), true)
  assert.equal(phoneQuoteAdminStatus(full).label, 'Paid in full')
})
