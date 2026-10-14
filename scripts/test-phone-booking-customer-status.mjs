import assert from 'node:assert/strict'
import { phoneMatchKey, resolvePhoneBookingCustomerStatus, usableCustomerEmail } from '../src/lib/phoneBookingCustomerStatus.js'

assert.equal(usableCustomerEmail(' Jane@Example.com '), 'jane@example.com')
assert.equal(usableCustomerEmail('phone-booking@shiftmyhome.local'), '')
assert.equal(phoneMatchKey('+44 7123 456789'), '7123456789')
assert.equal(phoneMatchKey('07123456789'), '7123456789')
assert.equal(phoneMatchKey('07123'), '')

assert.equal(resolvePhoneBookingCustomerStatus({ email: '', phone: '07123' }), null)

const fresh = resolvePhoneBookingCustomerStatus({
  identity: { ok: true, known: false, booking_count: 0 },
  email: 'new@example.com',
  phone: '07123456789',
})
assert.equal(fresh.kind, 'new')
assert.match(fresh.detail, /email/)

const returningEmail = resolvePhoneBookingCustomerStatus({
  identity: { ok: true, known: true, booking_count: 3, first_booking_at: '2024-03-18' },
  customers: [{ phone: '07111999888', booking_count: 1, full_name: 'Other' }],
  email: 'jane@example.com',
  phone: '07111999888',
})
assert.equal(returningEmail.kind, 'returning')
assert.equal(returningEmail.count, 3)
assert.equal(returningEmail.detail, '')

const returningPhone = resolvePhoneBookingCustomerStatus({
  identity: { ok: true, known: false, booking_count: 0 },
  customers: [{ phone: '+44 7123 456789', booking_count: 2, full_name: 'Jane Smith', first_booking_at: '2023-01-02' }],
  email: 'other@example.com',
  phone: '07123456789',
})
assert.equal(returningPhone.kind, 'returning')
assert.equal(returningPhone.count, 2)
assert.match(returningPhone.detail, /Jane Smith/)

const phoneOnlyNew = resolvePhoneBookingCustomerStatus({
  customers: [{ phone: '07111111111', booking_count: 4, full_name: 'Someone' }],
  phone: '07999999999',
})
assert.equal(phoneOnlyNew.kind, 'new')
assert.match(phoneOnlyNew.detail, /phone/)

assert.deepEqual(resolvePhoneBookingCustomerStatus({ identity: { ok: false }, email: 'a@b.co' }), { error: true })

console.log('Phone booking customer status checks passed')
