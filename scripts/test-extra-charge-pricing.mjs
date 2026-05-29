import { calculateExtraItemsCharge } from '../src/lib/extraChargePricing.js'
import { resolveDriverItemsToLineItems } from '../src/lib/extraChargeInventory.js'
import { getDefaultPricingSettings } from '../src/lib/defaultPricingSettings.js'

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

if (pricing.estimatedAmount <= 0) {
  console.error('FAIL: expected positive estimate')
  process.exit(1)
}
console.log('OK')
