import assert from 'node:assert/strict'
import { register } from 'node:module'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const { buildSupplyNote, syncSupplyNote } = await import('../supplyInstructionNote.js')

test('the supply note uses the ordered name, size, quantity, and unit', () => {
  assert.equal(
    buildSupplyNote({
      mediumBoxes: 4,
      bubble: 1,
      tape: 2,
    }),
    'Supply: 4 medium moving boxes, 1 roll of bubble wrap (10m), 2 rolls of packing tape.',
  )
  assert.equal(
    buildSupplyNote({ smallBoxes: 1, paper: 2, mattress: 1, extraLargeBoxes: 3 }),
    'Supply: 1 small moving box, 3 extra large moving boxes, 2 packs of packing paper (50-sheet), 1 mattress cover.',
  )
})

test('customer boxes in the move inventory are not materials we supply', () => {
  assert.equal(buildSupplyNote({}), '')
  assert.equal(
    syncSupplyNote('Customer has 4 medium boxes of their own.\nUse the side door.', {
      mediumBoxes: 0,
      bubble: 0,
    }),
    'Customer has 4 medium boxes of their own.\nUse the side door.',
  )
})

test('changing the quantity replaces the supply line and keeps the handwritten note', () => {
  const first = syncSupplyNote('Park on the left.\n\nCall before arrival.', { mediumBoxes: 4, tape: 1 })
  assert.equal(
    first,
    'Park on the left.\n\nCall before arrival.\nSupply: 4 medium moving boxes, 1 roll of packing tape.',
  )
  const changed = syncSupplyNote(first, { mediumBoxes: 2, bubble: 1 })
  assert.equal(
    changed,
    'Park on the left.\n\nCall before arrival.\nSupply: 2 medium moving boxes, 1 roll of bubble wrap (10m).',
  )
  assert.equal(changed.split('\n').filter((line) => line.startsWith('Supply:')).length, 1)
})

test('clearing every supplied material removes only the supply line', () => {
  const cleared = syncSupplyNote(
    'Park on the left.\nSupply: 4 medium moving boxes.\n\nCall before arrival.',
    {},
  )
  assert.equal(cleared, 'Park on the left.\n\nCall before arrival.')
})

test('saving the same materials does not add a second supply line', () => {
  const once = syncSupplyNote('Park on the left.', { largeBoxes: 2 })
  const again = syncSupplyNote(once, { largeBoxes: 2 })
  assert.equal(again, once)
  const duplicated = syncSupplyNote(`${once}\n${once.split('\n').at(-1)}`, { largeBoxes: 2 })
  assert.equal(duplicated.split('\n').filter((line) => line.startsWith('Supply:')).length, 1)
})
