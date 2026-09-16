import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const { calculateExtraItemsCharge } = await import('../src/lib/extraChargePricing.js')
const { resolveDriverItemsToLineItems } = await import('../src/lib/extraChargeInventory.js')
const { getDefaultPricingSettings } = await import('../src/lib/defaultPricingSettings.js')

const settings = getDefaultPricingSettings()
const library = [
  { id: '1', name: 'Double Bed', cubic_metres: 1.2, weight_type: 'medium', handling_multiplier: 1 },
  { id: '2', name: 'Wardrobe', cubic_metres: 1.5, weight_type: 'heavy', handling_multiplier: 1.1 },
]

const driverItems = [
  { name: 'Double Bed', quantity: 1 },
  { name: 'Wardrobe', quantity: 1 },
]

const lineItems = resolveDriverItemsToLineItems(driverItems, library)
const pricing = calculateExtraItemsCharge(settings, lineItems)

console.log('lineItems', lineItems)
console.log('estimatedAmount', pricing.estimatedAmount)
console.log('totalVolumeM3', pricing.totalVolumeM3)
console.log('breakdown', pricing.breakdownLines)

// Wardrobe heavy ×1.1 is ordinary — no specialist fee; volume only on raw 2.7 m³ × £30 × band 1.0
if (Math.abs(pricing.totalVolumeM3 - 2.7) > 0.001) {
  console.error('FAIL: expected raw volume 2.7 m³, got', pricing.totalVolumeM3)
  process.exit(1)
}
if (pricing.estimatedAmount <= 0) {
  console.error('FAIL: expected positive estimate')
  process.exit(1)
}
if (pricing.breakdownLines.some((l) => /heavy/i.test(l.label))) {
  console.error('FAIL: wardrobe ×1.1 should not add specialist heavy fee')
  process.exit(1)
}
console.log('OK')
