/**
 * Customer Leads Trash, move-date badges, and the 12-hour converted window.
 * Run: node scripts/test-customer-lead-list.mjs
 */
import {
  convertedLeadVisibleInCustomerLeads,
  customerLeadCallbackDue,
  customerLeadMoveCountdown,
  customerLeadNeedsFirstCall,
  customerLeadToCall,
  customerLeadVisibleInList,
} from '../src/lib/customerLeadList.js'

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
}

const noonLondon = new Date('2026-10-13T11:00:00Z')
const lateSameDay = new Date('2026-10-13T22:30:00Z')
const afterMidnight = new Date('2026-10-13T23:30:00Z')

const today = customerLeadMoveCountdown('2026-10-13', noonLondon)
const tomorrow = customerLeadMoveCountdown('2026-10-14', noonLondon)
const two = customerLeadMoveCountdown('2026-10-15', noonLondon)
const three = customerLeadMoveCountdown('2026-10-16', noonLondon)
const past = customerLeadMoveCountdown('2026-10-12', noonLondon)
const stillToday = customerLeadMoveCountdown('2026-10-13', lateSameDay)
const expiredAfterDay = customerLeadMoveCountdown('2026-10-13', afterMidnight)
const beforeClock = customerLeadMoveCountdown('2026-10-13T15:00:00', new Date('2026-10-13T13:00:00Z'))
const afterClock = customerLeadMoveCountdown('2026-10-13T15:00:00', new Date('2026-10-13T14:00:00Z'))

assert(today?.label === 'Move date today' && today.highlight, 'today is Move date today and highlighted')
assert(tomorrow?.label === '1 day left' && tomorrow.highlight, 'tomorrow is 1 day left and highlighted')
assert(two?.label === '2 days left' && two.highlight, 'two days left is highlighted')
assert(three?.label === '3 days left' && three.highlight === false, 'three days left is not highlighted')
assert(past?.label === 'Expired' && past.highlight, 'a past date is Expired')
assert(stillToday?.label === 'Move date today', 'a date-only lead stays today until the London day ends')
assert(expiredAfterDay?.label === 'Expired', 'a date-only lead is Expired after that London day ends')
assert(beforeClock?.label === 'Move date today', 'a timed move later today is still Move date today')
assert(afterClock?.label === 'Expired', 'a timed move is Expired once that London time has passed')
assert(customerLeadMoveCountdown('', noonLondon) == null, 'a missing move date has no badge')
assert(
  customerLeadMoveCountdown('2026-10-13T00:00:00Z', noonLondon)?.label === 'Move date today',
  'midnight is a date-only move and stays valid until the London day ends',
)

const recent = { status: 'converted_to_booking', converted_at: '2026-10-13T00:00:00Z' }
const old = { status: 'converted_to_booking', converted_at: '2026-10-12T10:00:00Z' }
const noStamp = { status: 'converted_to_booking', converted_at: null }
const open = { status: 'quote_viewed', converted_at: null, move_date: '2026-10-12' }
const now = new Date('2026-10-13T11:00:00Z')

assert(convertedLeadVisibleInCustomerLeads(recent, now), 'a lead converted 11 hours ago stays listed')
assert(!convertedLeadVisibleInCustomerLeads(old, now), 'a lead converted more than 12 hours ago leaves the list')
assert(convertedLeadVisibleInCustomerLeads(noStamp, now), 'a converted lead without converted_at stays listed')
assert(convertedLeadVisibleInCustomerLeads(open, now), 'an unconverted lead is not hidden by the 12-hour rule')

assert(customerLeadVisibleInList(open, 'all', now), 'an unconverted lead stays on All')
assert(!customerLeadVisibleInList(old, 'all', now), 'an old converted lead is hidden from All')
assert(!customerLeadVisibleInList(old, 'converted', now), 'an old converted lead is hidden from Converted')
assert(customerLeadVisibleInList(recent, 'converted', now), 'a recent converted lead stays on Converted')
assert(
  customerLeadVisibleInList({ ...old, deleted_at: '2026-10-13T10:00:00Z' }, 'trash', now),
  'Trash keeps a converted lead after 12 hours',
)
assert(
  !customerLeadVisibleInList({ ...open, deleted_at: '2026-10-13T10:00:00Z' }, 'all', now),
  'a trashed lead leaves the main list',
)
assert(
  customerLeadVisibleInList({ ...open, deleted_at: '2026-10-13T10:00:00Z' }, 'trash', now),
  'a trashed lead appears in Trash',
)

const freshUnpaid = { status: 'new_lead', created_at: '2026-10-12T12:00:00Z', customer_paid: false }
const olderUnpaid = { status: 'new_lead', created_at: '2026-10-10T12:00:00Z', customer_paid: false }
const freshPaid = { status: 'converted_to_booking', created_at: '2026-10-12T12:00:00Z', customer_paid: true }
const freshCalled = { status: 'new_lead', created_at: '2026-10-12T12:00:00Z', called_at: '2026-10-13T09:00:00Z' }
const due = { status: 'quote_viewed', callback_at: '2026-10-13T10:00:00Z', created_at: '2026-10-01T00:00:00Z' }
const dismissed = {
  status: 'quote_viewed',
  callback_at: '2026-10-13T10:00:00Z',
  callback_dismissed_at: '2026-10-13T10:05:00Z',
  created_at: '2026-10-01T00:00:00Z',
}
const futureCallback = {
  status: 'quote_viewed',
  called_at: '2026-10-13T09:00:00Z',
  callback_at: '2026-10-14T10:00:00Z',
  created_at: '2026-10-01T00:00:00Z',
}

assert(customerLeadNeedsFirstCall(freshUnpaid, now), 'a new unpaid lead is To call for 48 hours')
assert(!customerLeadNeedsFirstCall(olderUnpaid, now), 'an unpaid lead older than 48 hours is not a first call')
assert(!customerLeadNeedsFirstCall(freshPaid, now), 'a lead the customer paid is not To call')
assert(!customerLeadNeedsFirstCall(freshCalled, now), 'a lead already marked called is not a first call')
assert(customerLeadCallbackDue(due, now), 'a reached callback shows the notice')
assert(!customerLeadCallbackDue(dismissed, now), 'a closed callback notice stays closed')
assert(!customerLeadCallbackDue(futureCallback, now), 'a future callback is not due yet')
assert(customerLeadToCall(due, now), 'a due callback is in To call')
assert(customerLeadVisibleInList(freshUnpaid, 'to_call', now), 'To call lists a new unpaid lead')
assert(!customerLeadVisibleInList(olderUnpaid, 'to_call', now), 'To call hides an old unpaid lead with no reminder')
assert(customerLeadVisibleInList(due, 'to_call', now), 'To call lists a due callback')
assert(!customerLeadVisibleInList({ ...freshUnpaid, deleted_at: '2026-10-13T10:00:00Z' }, 'to_call', now), 'Trash is not To call')

console.log('PASS: Customer Leads trash, move-date badges, 12-hour converted window, and call reminders')
