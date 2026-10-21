import test from 'node:test'
import assert from 'node:assert/strict'
import {
  quotePassesAvailableJobsStrict,
  quoteShowsOnNewPhoneBookingInbox,
  quoteShowsOnNewPhoneBookingSentTab,
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

test('trash stays out of My saved quotes and Available Jobs', () => {
  const trashed = { ...base, deleted_at: '2026-10-21T10:00:00Z' }
  assert.equal(quoteShowsOnNewPhoneBookingInbox(trashed), false)
  assert.equal(quotePassesAvailableJobsStrict(trashed), false)
})

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
  assert.equal(quoteShowsOnNewPhoneBookingSentTab(deposit), false)
  assert.equal(quotePassesAvailableJobsStrict(deposit), true)
  assert.equal(phoneQuoteAdminStatus(deposit).label, 'Deposit paid')

  const full = { ...deposit, status: 'Booked', payment_status: 'paid', payment_type: 'full', amount_paid: 320, remaining_balance: 0 }
  assert.equal(quoteShowsOnNewPhoneBookingInbox(full), false)
  assert.equal(quoteShowsOnNewPhoneBookingSentTab(full), false)
  assert.equal(quotePassesAvailableJobsStrict(full), true)
  assert.equal(phoneQuoteAdminStatus(full).label, 'Paid in full')

  const paidStillPending = { ...deposit, operational_status: 'phone_booking_pending' }
  assert.equal(quotePassesAvailableJobsStrict(paidStillPending), true)
  assert.equal(quoteShowsOnNewPhoneBookingInbox(paidStillPending), false)
  assert.equal(quoteShowsOnNewPhoneBookingSentTab(paidStillPending), false)
})

test('unpaid release stays on the phone booking sent tab; a failed payment stays in the inbox', () => {
  const released = {
    ...base,
    operational_status: null,
    marketplace_visibility: 'hidden_from_partners',
  }
  assert.equal(quoteShowsOnNewPhoneBookingInbox(released), false)
  assert.equal(quoteShowsOnNewPhoneBookingSentTab(released), true)
  assert.equal(quotePassesAvailableJobsStrict(released), true)

  const failed = { ...base, payment_status: 'failed', amount_paid: 0 }
  assert.equal(quoteShowsOnNewPhoneBookingInbox(failed), true)
  assert.equal(quoteShowsOnNewPhoneBookingSentTab(failed), false)
  assert.equal(quotePassesAvailableJobsStrict(failed), false)
})
