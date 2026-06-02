/**
 * Full estimate for driver/admin extra item lists (library + pricing engine).
 */
import { fetchItemsLibrary } from './data/itemsLibraryRepository'
import { fetchPricingSettings } from './data/pricingSettingsRepository'
import { resolveDriverExtraChargePricing } from './driverExtraChargePricingSettings'
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
  const [allSettings, library] = await Promise.all([fetchPricingSettings(), fetchItemsLibrary()])
  const driverRates = resolveDriverExtraChargePricing(allSettings)
  const lineItems = resolveDriverItemsToLineItems(driverItems, library)
  const pricing = calculateExtraItemsCharge(driverRates, lineItems)
  const addedItemsStored = lineItemsToStoredAddedItems(lineItems, pricing)

  return {
    estimatedAmount: pricing.estimatedAmount,
    addedVolumeM3: pricing.totalVolumeM3,
    addedItemsStored,
    pricing,
    lineItems,
  }
}
