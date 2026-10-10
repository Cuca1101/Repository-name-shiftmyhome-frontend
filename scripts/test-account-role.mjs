import assert from 'node:assert/strict'
import { canEnterCustomerPortal, sessionKindFromUser, withCustomerQuery } from '../src/lib/accountRole.js'

const admin = { app_metadata: { role: 'admin' }, email: 'owner@example.com' }
const driver = { user_metadata: { role: 'driver' }, email: 'driver@example.com' }
const customer = { email: 'booker@example.com', user_metadata: { account_kind: 'customer' } }
const legacy = { email: 'legacy@example.com' }

assert.equal(sessionKindFromUser(null), 'none')
assert.equal(sessionKindFromUser(admin), 'admin')
assert.equal(sessionKindFromUser(driver), 'driver')
assert.equal(sessionKindFromUser(customer), 'customer')
assert.equal(sessionKindFromUser(legacy), 'customer')
assert.equal(sessionKindFromUser({ app_metadata: { role: 'admin' }, user_metadata: { role: 'customer' } }), 'admin')

assert.equal(canEnterCustomerPortal(null), false)
assert.equal(canEnterCustomerPortal(admin), false)
assert.equal(canEnterCustomerPortal(driver), false)
assert.equal(canEnterCustomerPortal(customer), true)
assert.equal(canEnterCustomerPortal(legacy), true)

const first = '11111111-1111-4111-8111-111111111111'
const second = '22222222-2222-4222-8222-222222222222'
assert.equal(withCustomerQuery('/portal/bookings', first), `/portal/bookings?customer=${first}`)
assert.equal(withCustomerQuery('/portal/bookings', second), `/portal/bookings?customer=${second}`)
assert.notEqual(withCustomerQuery('/portal/bookings', first), withCustomerQuery('/portal/bookings', second))
assert.equal(
  withCustomerQuery(`/portal/bookings/${first}/edit#portal-edit-addresses`, second),
  `/portal/bookings/${first}/edit?customer=${second}#portal-edit-addresses`,
)
assert.equal(withCustomerQuery('/portal/bookings?tab=upcoming', first).includes(`customer=${first}`), true)
assert.equal(withCustomerQuery('/quote?from=account', ''), '/quote?from=account')

console.log('account role checks passed')
