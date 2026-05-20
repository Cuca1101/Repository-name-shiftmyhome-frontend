import { SERVICE_TYPES } from '../constants/serviceTypes'

/**
 * @returns {import('./pricingCalculator.js').PricingSettings}
 */
export function getDefaultPricingSettings() {
  const basePriceByService = Object.fromEntries(
    SERVICE_TYPES.map((s) => {
      if (s === 'Man with Van') return [s, 75]
      if (s === 'Furniture Delivery') return [s, 60]
      if (s === 'Office Moves') return [s, 150]
      if (s === 'Clearance') return [s, 90]
      if (s === 'Storage Move') return [s, 85]
      if (s === 'Student Moves') return [s, 70]
      if (s === 'House Removals') return [s, 120]
      return [s, 100]
    }),
  )

  return {
    basePriceByService,
    pricePerMile: 1.6,
    pricePerCubicMetre: 48,
    minimumJobPrice: 85,
    floorChargePerFloor: 12,
    noLiftCharge: 30,
    longWalkingDistanceCharge: 25,
    parkingCharge: 15,
    waitingTimePricePerHour: 40,
    sameDaySurchargePercent: 12,
    weekendSurchargePercent: 15,
    extraHelperPrice: 45,
    crewSurchargePerExtraMember: 45,
    /** When true, each service base price is per crew member — total base = rate × crew size from the quote (no separate extra-crew surcharge). */
    basePricePerMan: false,
    crewSizeOneEnabled: true,
    crewSizeTwoEnabled: true,
    crewSizeThreeEnabled: true,
    crewSizeFourEnabled: true,
    largeMoveVolumeThresholdM3: 35,
    minimumCrewForLargeMoves: 3,
    /** @deprecated use packingPricePerBoxOrItem — kept for older saved JSON */
    packingServicePrice: 55,
    /** £ per box/item when customer requests packing */
    packingPricePerBoxOrItem: 5,
    /** @deprecated use dismantlingPricePerItem */
    dismantlingPrice: 45,
    dismantlingPricePerItem: 45,
    /** @deprecated use reassemblyPricePerItem */
    reassemblyPrice: 45,
    reassemblyPricePerItem: 45,
    /** One-off when fragile items selected */
    fragilePackingSurcharge: 25,
    /** One-off when packing materials required */
    packingMaterialsFee: 35,
    stairsChargePerFlight: 15,
    heavyItemHandlingCharge: 25,
    /** Premium when customer chooses exact arrival hour (Step 1 wizard) */
    exactArrivalPremiumGbp: 20,
    customSizeM3: {
      small: 0.1,
      medium: 0.35,
      large: 0.8,
      heavy: 1.2,
    },
    fuelSurchargeEnabled: false,
    fuelSurchargePerMile: 0,
    yesLiftChargePerEnd: 0,
    packingMaterialPerItemEnabled: false,
    /** Legacy single box price — maps to medium when per-size prices are unset */
    packingMaterialPriceBoxes: 0,
    packingMaterialPriceSmallBoxes: 0,
    packingMaterialPriceMediumBoxes: 0,
    packingMaterialPriceLargeBoxes: 0,
    packingMaterialPriceExtraLargeBoxes: 0,
    packingMaterialPriceBubble: 0,
    packingMaterialPricePaper: 0,
    packingMaterialPriceTape: 0,
    packingMaterialPriceMattress: 0,
    depositAmount: 50,
    promoCodesEnabled: false,
    promoCodes: [],
  }
}
