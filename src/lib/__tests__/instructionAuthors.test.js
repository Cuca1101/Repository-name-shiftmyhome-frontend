import assert from 'node:assert/strict'
import { register } from 'node:module'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const { applyInstructionEdit, composeInstructionRecord } = await import('../instructionAuthors.js')

test('one author is the only labelled block', () => {
  const customer = composeInstructionRecord({ customer: 'Please call before arrival.', admin: '' })
  assert.equal(customer.specialInstructions, 'Added by customer:\nPlease call before arrival.')
  assert.equal(customer.blocks.length, 1)

  const admin = composeInstructionRecord({ customer: '', admin: 'Please bring extra blankets.' })
  assert.equal(admin.specialInstructions, 'Added by admin:\nPlease bring extra blankets.')
  assert.equal(admin.blocks.length, 1)
})

test('both authors stay in separate blocks and an admin edit does not replace the customer', () => {
  const saved = applyInstructionEdit(
    { specialInstructions: 'Please call before arrival.' },
    { admin: 'Please bring extra blankets.' },
  )
  assert.equal(saved.customer, 'Please call before arrival.')
  assert.equal(saved.admin, 'Please bring extra blankets.')
  assert.equal(
    saved.specialInstructions,
    'Added by customer:\nPlease call before arrival.\n\nAdded by admin:\nPlease bring extra blankets.',
  )

  const again = applyInstructionEdit(
    {
      specialInstructions: saved.specialInstructions,
      customerSpecialInstructions: saved.customer,
      adminSpecialInstructions: saved.admin,
    },
    { admin: 'Use the side gate.' },
  )
  assert.equal(again.customer, 'Please call before arrival.')
  assert.equal(again.admin, 'Use the side gate.')
})

test('the automatic supply line is an admin note and does not duplicate', () => {
  const customerPick = applyInstructionEdit(
    { specialInstructions: 'Please call before arrival.' },
    { quantities: { mediumBoxes: 4, bubble: 1 }, actor: 'customer' },
  )
  assert.equal(customerPick.customer, 'Please call before arrival.')
  assert.equal(customerPick.supplyAuthor, 'admin')
  assert.equal(
    customerPick.specialInstructions,
    'Added by customer:\nPlease call before arrival.\n\nAdded by admin:\nSupply: 4 medium moving boxes, 1 roll of bubble wrap (10m).',
  )

  const adminChange = applyInstructionEdit(
    {
      specialInstructions: customerPick.specialInstructions,
      customerSpecialInstructions: customerPick.customer,
      adminSpecialInstructions: customerPick.admin,
      supplyNoteAuthor: customerPick.supplyAuthor,
    },
    { quantities: { mediumBoxes: 2, bubble: 1 }, actor: 'admin' },
  )
  assert.equal(adminChange.customer, 'Please call before arrival.')
  assert.equal(adminChange.supplyAuthor, 'admin')
  assert.equal(
    adminChange.specialInstructions,
    'Added by customer:\nPlease call before arrival.\n\nAdded by admin:\nSupply: 2 medium moving boxes, 1 roll of bubble wrap (10m).',
  )
  assert.equal(adminChange.specialInstructions.match(/Supply:/gi).length, 1)

  const cleared = applyInstructionEdit(
    {
      specialInstructions: adminChange.specialInstructions,
      customerSpecialInstructions: adminChange.customer,
      adminSpecialInstructions: 'Please bring extra blankets.',
      supplyNoteAuthor: 'admin',
    },
    { quantities: {}, actor: 'admin' },
  )
  assert.equal(cleared.customer, 'Please call before arrival.')
  assert.equal(cleared.admin, 'Please bring extra blankets.')
  assert.equal(cleared.supplyAuthor, '')
  assert.doesNotMatch(cleared.specialInstructions, /Supply:/i)
})
