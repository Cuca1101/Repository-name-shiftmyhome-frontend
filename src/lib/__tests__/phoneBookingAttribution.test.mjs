import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPhoneBookingAttribution,
  quoteCreatorFromDetailsText,
  staffNameFromAuthUser,
} from '../phoneBookingAttribution.js'

test('new quote records the signed-in staff member as the creator', () => {
  const saved = buildPhoneBookingAttribution({
    existingQuoteBy: null,
    existingChanges: [],
    actor: 'rhona@shiftmyhome.co.uk',
    at: '2026-10-21T09:00:00.000Z',
    previousFinal: 101.78,
    nextFinal: 101.78,
    reason: '',
  })
  assert.equal(saved.quoteBy.name, 'rhona@shiftmyhome.co.uk')
  assert.equal(saved.quoteBy.at, '2026-10-21T09:00:00.000Z')
  assert.equal(saved.priceChanges.length, 0)
})

test('a custom price on create records the change from the calculated total', () => {
  const saved = buildPhoneBookingAttribution({
    existingQuoteBy: null,
    existingChanges: [],
    actor: 'Rhona',
    at: '2026-10-21T09:05:00.000Z',
    previousFinal: 101.78,
    nextFinal: 90,
    reason: 'Phone discount',
  })
  assert.deepEqual(saved.priceChanges, [
    {
      by: 'Rhona',
      at: '2026-10-21T09:05:00.000Z',
      from: 101.78,
      to: 90,
      reason: 'Phone discount',
    },
  ])
})

test('a later editor does not replace the original creator', () => {
  const saved = buildPhoneBookingAttribution({
    existingQuoteBy: { name: 'Rhona', at: '2026-10-21T09:00:00.000Z' },
    existingChanges: [
      { by: 'Rhona', at: '2026-10-21T09:05:00.000Z', from: 101.78, to: 90, reason: 'Phone discount' },
    ],
    actor: 'Andrei',
    at: '2026-10-21T11:00:00.000Z',
    previousFinal: 90,
    nextFinal: 85,
    reason: 'Second discount',
  })
  assert.equal(saved.quoteBy.name, 'Rhona')
  assert.equal(saved.quoteBy.at, '2026-10-21T09:00:00.000Z')
  assert.equal(saved.priceChanges.length, 2)
  assert.equal(saved.priceChanges[1].by, 'Andrei')
  assert.equal(saved.priceChanges[1].from, 90)
  assert.equal(saved.priceChanges[1].to, 85)
  assert.equal(saved.priceChanges[0].by, 'Rhona')
})

test('saving the same price keeps the price author and can refresh the reason', () => {
  const saved = buildPhoneBookingAttribution({
    existingQuoteBy: { name: 'Rhona', at: '2026-10-21T09:00:00.000Z' },
    existingChanges: [
      { by: 'Rhona', at: '2026-10-21T09:05:00.000Z', from: 101.78, to: 90, reason: 'Old reason' },
    ],
    actor: 'Andrei',
    at: '2026-10-21T11:00:00.000Z',
    previousFinal: 90,
    nextFinal: 90,
    reason: 'Corrected reason',
  })
  assert.equal(saved.priceChanges.length, 1)
  assert.equal(saved.priceChanges[0].by, 'Rhona')
  assert.equal(saved.priceChanges[0].at, '2026-10-21T09:05:00.000Z')
  assert.equal(saved.priceChanges[0].reason, 'Corrected reason')
})

test('older quote text still identifies the creator', () => {
  const details = 'Created by admin (rhona@shiftmyhome.co.uk)\n\n---SMH_PHONE_BOOKING_WIZARD_JSON---\n{}'
  assert.equal(quoteCreatorFromDetailsText(details), 'rhona@shiftmyhome.co.uk')
})

test('staff name prefers the profile name', () => {
  assert.equal(
    staffNameFromAuthUser({ email: 'a@shiftmyhome.co.uk', user_metadata: { full_name: 'Andrei' } }),
    'Andrei',
  )
  assert.equal(staffNameFromAuthUser({ email: 'a@shiftmyhome.co.uk' }), 'a@shiftmyhome.co.uk')
})
