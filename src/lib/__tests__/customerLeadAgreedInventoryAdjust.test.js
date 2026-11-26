import assert from 'node:assert/strict'
import { register } from 'node:module'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const {
  applyInventoryDeltaToAgreedPrice,
  diffInventorySelection,
  previewLeadInventoryPriceChange,
  resolveInventoryLineVolumeM3,
  inventoryLinesToEngineItems,
} = await import('../customerLeadAgreedInventoryAdjust.js')

test('adding items raises the agreed price by the engine delta', () => {
  const result = applyInventoryDeltaToAgreedPrice({
    agreedPrice: 600.43,
    beforeTotal: 823.43,
    afterTotal: 873.43,
  })
  assert.deepEqual(result, {
    agreed_price: 650.43,
    calculated_total: 873.43,
    estimated_total: 873.43,
    delta: 50,
  })
})

test('removing items lowers the agreed price by the engine delta', () => {
  const result = applyInventoryDeltaToAgreedPrice({
    agreedPrice: 650.43,
    beforeTotal: 873.43,
    afterTotal: 823.43,
  })
  assert.deepEqual(result, {
    agreed_price: 600.43,
    calculated_total: 823.43,
    estimated_total: 823.43,
    delta: -50,
  })
})

test('agreed price does not go below zero', () => {
  const result = applyInventoryDeltaToAgreedPrice({
    agreedPrice: 20,
    beforeTotal: 100,
    afterTotal: 50,
  })
  assert.equal(result.agreed_price, 0)
  assert.equal(result.delta, -50)
})

test('no change when the engine total is unchanged', () => {
  assert.equal(
    applyInventoryDeltaToAgreedPrice({
      agreedPrice: 600,
      beforeTotal: 800,
      afterTotal: 800,
    }),
    null,
  )
})

test('diffInventorySelection reports extras and removals', () => {
  const diff = diffInventorySelection(
    [
      { name: 'Sofa', quantity: 1, catalogId: 'sofa' },
      { name: 'Box', quantity: 2, catalogId: 'box' },
    ],
    [
      { name: 'Sofa', quantity: 1, catalogId: 'sofa' },
      { name: 'Box', quantity: 5, catalogId: 'box' },
      { name: 'Bike', quantity: 1, catalogId: 'bike' },
    ],
  )
  assert.deepEqual(diff.added, [
    { name: 'Bike', quantity: 1 },
    { name: 'Box', quantity: 3 },
  ])
  assert.deepEqual(diff.removed, [])
})

test('previewLeadInventoryPriceChange keeps saved agreed fixed', () => {
  const preview = previewLeadInventoryPriceChange({
    pricingSettings: null,
    lead: { agreed_price: 600.43 },
    previousInventoryLines: [],
    nextInventoryLines: [],
  })
  assert.equal(preview.calculatedBefore, null)
  assert.equal(preview.calculatedAfter, null)
  assert.equal(preview.usesAgreed, true)
  assert.equal(preview.checkoutBefore, 600.43)
  assert.equal(preview.checkoutAfter, 600.43)
  assert.equal(preview.checkoutDelta, 0)
})

test('resolveInventoryLineVolumeM3 fills catalogue volume by name when m3 is missing', () => {
  assert.equal(resolveInventoryLineVolumeM3({ name: 'Double bed & mattress' }), 1.4)
  const [engine] = inventoryLinesToEngineItems([{ name: 'Double bed & mattress', quantity: 1 }])
  assert.equal(engine.volumePerUnitM3, 1.4)
})
