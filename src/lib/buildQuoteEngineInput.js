import { parsePackingMaterialQuantities } from './packingMaterialsCatalog'
import { getLocalDateYYYYMMDD } from './moveDateLocal'
import { isBankHolidayDate, isWeekendDate } from './pricingCalculator'

/**
 * Shared input for calculateQuote — quote wizard, admin booking, promo previews.
 * @param {{
 *   serviceType: string,
 *   wizard: Record<string, unknown>,
 *   lineItems: import('./pricingCalculator.js').QuoteLineItem[],
 *   heavyItemCount?: number,
 *   promoCode?: string,
 * }} params
 */
export function buildQuoteEngineInput({
  serviceType,
  wizard,
  lineItems,
  heavyItemCount = 0,
  promoCode,
}) {
  const moveDate = wizard.moveDate
  const today = getLocalDateYYYYMMDD()
  const sameDay = moveDate === today
  const bankHoliday = isBankHolidayDate(moveDate)
  const weekend = isWeekendDate(moveDate)
  const packingMaterialQuantities = parsePackingMaterialQuantities(wizard)

  return {
    serviceType,
    distanceMiles: Number(wizard.distanceMiles) || 0,
    mapboxRouteDurationSeconds:
      wizard.mapboxRouteDurationSeconds != null && wizard.mapboxRouteDurationSeconds !== ''
        ? Number(wizard.mapboxRouteDurationSeconds)
        : undefined,
    lineItems,
    access: {
      pickupFloor: wizard.pickupFloor == null ? 0 : Number(wizard.pickupFloor),
      deliveryFloor: wizard.deliveryFloor == null ? 0 : Number(wizard.deliveryFloor),
      pickupLift: wizard.pickupLift == null ? undefined : Boolean(wizard.pickupLift),
      deliveryLift: wizard.deliveryLift == null ? undefined : Boolean(wizard.deliveryLift),
      longWalk: wizard.walkingDistance === 'long',
      parking: wizard.parkingDistance === 'long',
      stairsFlights: wizard.stairsFlights,
      heavyItemCount,
    },
    extras: {
      packing: wizard.packing,
      packingApproxBoxes: wizard.packingApproxBoxes,
      packingFragile: wizard.packingFragile,
      packingMaterials: wizard.packingMaterials,
      packingMaterialQuantities,
      dismantling: wizard.dismantling,
      dismantlingItemCount: wizard.dismantlingItemCount,
      reassembly: wizard.reassembly,
      reassemblyItemCount: wizard.reassemblyItemCount,
      reassemblySameAsDismantling: wizard.reassemblySameAsDismantling,
      waitingHours: 0,
      extraHelpers: 0,
      sameDay,
      weekend,
      bankHoliday,
      exactArrivalPremium: wizard.arrivalWindow === 'exact',
      promoCode: promoCode !== undefined ? promoCode : wizard.promoCode,
      packageTier: wizard.packageTier || 'standard',
    },
    crewSize:
      wizard.crewSize != null && wizard.crewSize !== '' ? Number(wizard.crewSize) : undefined,
    moveDate,
  }
}
