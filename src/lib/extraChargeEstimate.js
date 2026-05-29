/**
 * Full estimate for driver/admin extra item lists (library + pricing engine).
 */
import { fetchItemsLibrary } from './data/itemsLibraryRepository'
import { fetchPricingSettings } from './data/pricingSettingsRepository'
import { lineItemsToStoredAddedItems, resolveDriverItemsToLineItems } from './extraChargeInventory'
import { calculateExtraItemsCharge } from './extraChargePricing'

/**
 * @typedef {Object} ExtraChargeEstimate
 * @property {number} estimatedAmount
 * @property {number} addedVolumeM3
 * @property {object[]} addedItemsStored
 * @property {import('./extraChargePricing.js').ExtraItemsChargeResult} pricing
 * @property {import('./extraChargeInventory.js').ResolvedExtraLineItem[]} lineItems
 */

/**
 * @param {import('./extraChargeInventory.js').DriverAddedItem[]} driverItems
 * @returns {Promise<ExtraChargeEstimate>}
 */
export async function estimateExtraChargeFromDriverItems(driverItems) {
  const [settings, library] = await Promise.all([fetchPricingSettings(), fetchItemsLibrary()])
  const lineItems = resolveDriverItemsToLineItems(driverItems, library)
  const pricing = calculateExtraItemsCharge(settings, lineItems)
  const addedItemsStored = lineItemsToStoredAddedItems(lineItems, pricing)

  return {
    estimatedAmount: pricing.estimatedAmount,
    addedVolumeM3: pricing.totalVolumeM3,
    addedItemsStored,
    pricing,
    lineItems,
  }
}
