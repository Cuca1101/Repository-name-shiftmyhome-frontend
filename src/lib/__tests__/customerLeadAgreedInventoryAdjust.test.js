import assert from 'node:assert/strict'
import { register } from 'node:module'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const { applyInventoryDeltaToAgreedPrice } = await import('../customerLeadAgreedInventoryAdjust.js')

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
