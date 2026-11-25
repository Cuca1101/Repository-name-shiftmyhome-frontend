import assert from 'node:assert/strict'
import { register } from 'node:module'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const { mergeSuppliedBoxesIntoEngineItems, syncSuppliedBoxesIntoInventory } = await import(
  '../suppliedBoxesInventory.js'
)

const sofa = { lineId: 'sofa-1', name: '3 seater sofa', quantity: 1, m3: 2.2 }

test('ordered boxes join the inventory once and keep their catalogue volume', () => {
  const first = syncSuppliedBoxesIntoInventory([sofa], { mediumBoxes: 4 })
  assert.equal(first.length, 2)
  assert.equal(first[0].name, '3 seater sofa')
  const boxes = first[1]
  assert.equal(boxes.name, 'Medium moving box (Boxes supplied by us)')
  assert.equal(boxes.quantity, 4)
  assert.equal(boxes.m3, 0.1)
  assert.equal(boxes.suppliedByUs, true)

  const again = syncSuppliedBoxesIntoInventory(first, { mediumBoxes: 4 })
  assert.equal(again.filter((line) => line.suppliedByUs).length, 1)
  assert.equal(again.length, 2)

  const reduced = syncSuppliedBoxesIntoInventory(again, { mediumBoxes: 2, largeBoxes: 1 })
  const supplied = reduced.filter((line) => line.suppliedByUs)
  assert.deepEqual(
    supplied.map((line) => [line.suppliedMaterialId, line.quantity, line.m3]),
    [
      ['mediumBoxes', 2, 0.1],
      ['largeBoxes', 1, 0.2],
    ],
  )
  assert.equal(reduced.filter((line) => line.name === '3 seater sofa').length, 1)

  const cleared = syncSuppliedBoxesIntoInventory(reduced, { mediumBoxes: 0, largeBoxes: 0 })
  assert.deepEqual(
    cleared.map((line) => line.name),
    ['3 seater sofa'],
  )
})

test('the moving price sees each supplied box once', () => {
  const already = syncSuppliedBoxesIntoInventory([sofa], { smallBoxes: 4 })
  const engine = mergeSuppliedBoxesIntoEngineItems(
    already.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      volumePerUnitM3: line.m3,
    })),
    { smallBoxes: 4 },
  )
  const supplied = engine.filter((item) => String(item.name).includes('Boxes supplied by us'))
  assert.equal(supplied.length, 1)
  assert.equal(supplied[0].quantity, 4)
  assert.equal(supplied[0].volumePerUnitM3, 0.05)
  assert.equal(engine.filter((item) => item.name === '3 seater sofa').length, 1)
})
