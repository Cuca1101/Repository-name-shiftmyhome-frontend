/**
 * Editing a phone booking keeps the same reference and payment history.
 * The update patch must not rewrite sent-email, token, or payment columns.
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const { appendWizardSnapshotToDetails } = await import('../src/lib/adminPhoneBookingWizardSnapshot.js')
const { adminPhoneBookingFormStateFromQuoteRow, phoneBookingUpdatePatch } = await import(
  '../src/lib/adminPhoneBooking.js'
)

const wizard = {
  pickupAddress: '10 Downing Street, London',
  deliveryAddress: 'Edinburgh Castle, Edinburgh',
  moveDate: '2026-11-20',
  arrivalWindow: 'flex_window',
  flexibleArrivalFrom: '08:00',
  flexibleArrivalUntil: '10:00',
  pickupPropertyType: 'House',
  pickupFloor: '0',
  pickupLift: false,
  inventoryLines: [{ name: 'Bedside table', quantity: 2, m3: 0.2 }],
  fullName: 'Jane Smith',
  email: 'jane@example.com',
  phone: '07123456789',
  extraServices: ['packing'],
}

const details = appendWizardSnapshotToDetails('Saved summary', {
  wizard,
  serviceType: 'Home removals',
  useCalculatedPrice: false,
  finalPriceOverride: '250.00',
  overrideReason: 'Phone agreement',
  adminNote: 'Call before arrival',
})

const loaded = adminPhoneBookingFormStateFromQuoteRow({
  quote_ref: 'SMH-1042',
  details,
  service_type: 'Home removals',
  estimated_total: 300,
  remaining_balance: 200,
  amount_paid: 50,
})

assert.equal(loaded.step, 4)
assert.equal(loaded.quoteRef, 'SMH-1042')
assert.equal(loaded.wizard.pickupAddress, '10 Downing Street, London')
assert.equal(loaded.wizard.deliveryAddress, 'Edinburgh Castle, Edinburgh')
assert.equal(loaded.wizard.moveDate, '2026-11-20')
assert.equal(loaded.wizard.flexibleArrivalFrom, '08:00')
assert.equal(loaded.wizard.flexibleArrivalUntil, '10:00')
assert.equal(loaded.wizard.inventoryLines[0].quantity, 2)
assert.equal(loaded.wizard.fullName, 'Jane Smith')
assert.equal(loaded.wizard.email, 'jane@example.com')
assert.equal(loaded.useCalculatedPrice, false)
assert.equal(loaded.finalPriceOverride, '250.00')

const existing = {
  quote_ref: 'SMH-1042',
  source: 'admin_phone_booking',
  payment_status: 'deposit_paid',
  payment_type: 'deposit',
  amount_paid: 50,
  paid_at: '2026-10-01T10:00:00.000Z',
  operational_status: 'pending_quote',
  quote_sent_at: '2026-10-01T09:00:00.000Z',
  quote_sent_count: 1,
  quote_sent_total: 250,
  quote_pay_token: 'keep-token',
  stripe_session_id: 'cs_keep',
  stripe_payment_intent_id: 'pi_keep',
  customer_id: 'cust-1',
  customer_kind: 'returning',
  created_at: '2026-09-01T00:00:00.000Z',
}

const patch = phoneBookingUpdatePatch(
  existing,
  {
    quote_ref: 'SMH-NEW',
    source: 'website',
    payment_status: 'unpaid',
    payment_type: null,
    amount_paid: 0,
    paid_at: null,
    operational_status: 'new',
    remaining_balance: 400,
    quote_sent_at: null,
    quote_sent_count: 0,
    quote_pay_token: 'replaced',
    pickup_address: 'New pickup',
    estimated_total: 400,
  },
  320,
)

assert.equal(patch.quote_ref, 'SMH-1042')
assert.equal(patch.source, 'admin_phone_booking')
assert.equal(patch.payment_status, 'deposit_paid')
assert.equal(patch.payment_type, 'deposit')
assert.equal(patch.amount_paid, 50)
assert.equal(patch.paid_at, '2026-10-01T10:00:00.000Z')
assert.equal(patch.operational_status, 'pending_quote')
assert.equal(patch.remaining_balance, 270)
assert.equal(patch.pickup_address, 'New pickup')
assert.equal(patch.estimated_total, 400)
for (const key of [
  'quote_sent_at',
  'quote_sent_count',
  'quote_sent_total',
  'quote_pay_token',
  'stripe_session_id',
  'stripe_payment_intent_id',
  'customer_id',
  'customer_kind',
  'created_at',
]) {
  assert.equal(Object.hasOwn(patch, key), false, key)
}

console.log('Phone booking edit checks passed')
