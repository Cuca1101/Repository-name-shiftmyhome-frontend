/**
 * Portal prices go through the same quote engine as the website and admin.
 */
import { buildQuoteEngineInput } from './buildQuoteEngineInput.js'
import { resolveChargeableTotal } from './adminAgreedPrice.js'
import { calculateQuote } from './pricingCalculator.js'
import { applyServicePackageToQuote } from './servicePackages.js'

const VAN_CAPACITY_M3 = 18

/**
 * @param {Array<Record<string, unknown>>} lines
 */
export function wizardLinesToEngineItems(lines) {
  return (Array.isArray(lines) ? lines : [])
    .filter((line) => (Number(line?.quantity) || 0) > 0 && line?.name)
    .map((line) => ({
      name: String(line.name),
      quantity: Number(line.quantity) || 1,
      volumePerUnitM3: Number(line.m3) || Number(line.volumePerUnitM3) || 0,
      handlingMultiplier:
        Number(line.mult) > 0
          ? Number(line.mult)
          : Number(line.handlingMultiplier) > 0
            ? Number(line.handlingMultiplier)
            : 1,
      weightType: line.weightType || 'medium',
      heavyFee: line.heavyFee,
      appliesHeavyHandlingFee: line.heavyFee,
      isCustom: Boolean(line.isCustom),
    }))
}

/**
 * @param {{
 *   settings: Record<string, unknown>,
 *   serviceType: string,
 *   wizard: Record<string, unknown>,
 * }} args
 */
export function pricePortalBooking({ settings, serviceType, wizard }) {
  const lineItems = wizardLinesToEngineItems(wizard?.inventoryLines)
  const heavyItemCount = lineItems.reduce(
    (sum, line) => sum + (line.weightType === 'heavy' ? line.quantity : 0),
    0,
  )
  const live = calculateQuote(
    settings,
    buildQuoteEngineInput({
      serviceType: serviceType || 'House Removals',
      wizard,
      lineItems,
      heavyItemCount,
    }),
  )
  const packaged = applyServicePackageToQuote({
    baseTotal: live.estimatedTotal,
    packageId: wizard?.packageTier || 'standard',
    settings,
    declaredVolumeM3: live.totalCubicMetres,
    vehicleCapacityM3: VAN_CAPACITY_M3,
  })
  return {
    total: packaged.finalTotal,
    crewSize: live.crewSizeUsedInPricing,
    volumeM3: live.totalCubicMetres,
    packageFee: packaged.fee,
    packageName: packaged.displayName,
  }
}

/** What the customer was charged for this booking before the edit. */
export function previousChargeableTotal(quote) {
  return resolveChargeableTotal(quote)
}
