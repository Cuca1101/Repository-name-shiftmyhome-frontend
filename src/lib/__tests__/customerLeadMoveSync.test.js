import assert from 'node:assert/strict'
import { register } from 'node:module'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const {
  buildLeadWizardData,
  mergeLeadEditsIntoQuoteDetails,
  mergePriceNoteIntoSpecialInstructions,
  notesForCustomerEmail,
} = await import('../customerLeadMoveSync.js')

test('a price note becomes the special instruction and is written on the booking', () => {
  assert.equal(mergePriceNoteIntoSpecialInstructions('', 'Call before 8am'), 'Call before 8am')
  assert.equal(
    mergePriceNoteIntoSpecialInstructions('Park on the left', 'Call before 8am'),
    'Park on the left\nCall before 8am',
  )
  assert.equal(
    mergePriceNoteIntoSpecialInstructions('Old note', 'New note', 'Old note'),
    'New note',
  )

  const details = mergeLeadEditsIntoQuoteDetails('Converted from customer lead by admin.', {
    specialInstructions: 'Call before 8am',
    priceNote: 'Agreed on the phone',
    inventoryLines: [{ name: 'Double bed', quantity: 1, m3: 1.4 }],
  })

  assert.match(details, /Customer notes: Call before 8am/)
  assert.match(details, /Price override reason: Agreed on the phone/)
  assert.match(details, /Inventory:\n- 1× Double bed/)
})

test('editing the list replaces the old items on an existing booking', () => {
  const before = [
    'Customer notes: Old note',
    'Price override reason: First price',
    'Inventory:',
    '- 2× Sofa (2 m³)',
    '',
    'Crew: 2',
  ].join('\n')

  const details = mergeLeadEditsIntoQuoteDetails(before, {
    specialInstructions: 'Use the side door',
    priceNote: 'Second price',
    inventoryLines: [{ name: 'King size bed', quantity: 1, m3: 1.7 }],
  })

  assert.match(details, /Customer notes: Use the side door/)
  assert.match(details, /Price override reason: Second price/)
  assert.match(details, /- 1× King size bed/)
  assert.doesNotMatch(details, /Sofa/)
  assert.match(details, /Crew: 2/)
})

test('the email can tell a customer note from an admin note', () => {
  const customerOnly = notesForCustomerEmail({
    wizard_data: { step3: { specialInstructions: 'Park on the left' } },
  })
  assert.deepEqual(customerOnly, { customer: 'Park on the left', admin: '' })

  const withPriceNote = notesForCustomerEmail({
    price_override_reason: 'Call before 8am',
    wizard_data: { step3: { specialInstructions: 'Park on the left\nCall before 8am' } },
  })
  assert.deepEqual(withPriceNote, { customer: 'Park on the left', admin: 'Call before 8am' })

  const edited = buildLeadWizardData(
    {
      price_override_reason: 'Call before 8am',
      wizard_data: { step3: { specialInstructions: 'Park on the left\nCall before 8am' } },
    },
    {
      inventoryLines: [],
      specialInstructions: 'Use the side door',
      instructionsAuthor: 'admin',
    },
  )
  assert.equal(edited.wizard_data.step3.customerSpecialInstructions, 'Park on the left')
  assert.equal(edited.wizard_data.step3.specialInstructionsSource, 'admin')
  assert.deepEqual(notesForCustomerEmail({ ...edited, price_override_reason: 'Call before 8am', wizard_data: edited.wizard_data }), {
    customer: 'Park on the left',
    admin: 'Use the side door\nCall before 8am',
  })
})
