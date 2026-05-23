import { SERVICE_TYPES } from '../constants/serviceTypes'

/**
 * Offline / fallback pricing when Supabase `pricing_settings` is unavailable.
 * All numeric defaults live here only — the pricing engine must not hardcode prices.
 * Admin Pricing Settings always override these values when present.
 */
export function getDefaultPricingSettings() {
  const basePriceByService = Object.fromEntries(
    SERVICE_TYPES.map((s) => {
      if (s === 'Man with Van') return [s, 72]
      if (s === 'Furniture Delivery') return [s, 58]
      if (s === 'Office Moves') return [s, 145]
      if (s === 'Clearance') return [s, 88]
      if (s === 'Storage Move') return [s, 85]
      if (s === 'Student Moves') return [s, 62]
      if (s === 'House Removals') return [s, 118]
      return [s, 100]
    }),
  )

  return {
    basePriceByService,
    /** Homepage card prices only; empty = use {@link getDefaultServiceCardDisplayPrices} at display time. */
    displayPriceByService: {},
    pricePerMile: 1.3,
    pricePerCubicMetre: 14,
    minimumJobPrice: 85,
    minimumJobPriceOneMan: 85,
    minimumJobPriceTwoMen: 105,
    minimumJobPriceThreeMen: 130,
    floorChargePerFloor: 13,
    noLiftCharge: 30,
    longWalkingDistanceCharge: 28,
    parkingCharge: 15,
    waitingTimePricePerHour: 40,
    sameDaySurchargePercent: 12,
    weekendSurchargePercent: 15,
    extraHelperPrice: 40,
    crewSurchargePerExtraMember: 40,
    /** Used only when live Mapbox route duration is unavailable (legacy key: averageSpeedMph). */
    fallbackSpeedMph: 35,
    averageSpeedMph: 35,
    secondManBaseFee: 15,
    secondManHourlyRate: 18,
    firstManBaseFee: 15,
    firstManHourlyRate: 18,
    firstManLabourFee: 30,
    thirdManBaseFee: 25,
    thirdManHourlyRate: 16,
    fourthManBaseFee: 25,
    fourthManHourlyRate: 16,
    /** Legacy flat fees only if distance crew hourly rates are all zero */
    secondManLabourFee: 30,
    thirdManLabourFee: 38,
    fourthManLabourFee: 38,
    oneManLabourDiscountPercent: 18,
    basePricePerMan: false,
    crewSizeOneEnabled: true,
    crewSizeTwoEnabled: true,
    crewSizeThreeEnabled: true,
    crewSizeFourEnabled: false,
    largeMoveVolumeThresholdM3: 28,
    minimumCrewForLargeMoves: 3,
    packingServicePrice: 55,
    packingPricePerBoxOrItem: 5,
    dismantlingPrice: 45,
    dismantlingPricePerItem: 42,
    reassemblyPrice: 45,
    reassemblyPricePerItem: 42,
    fragilePackingSurcharge: 25,
    packingMaterialsFee: 35,
    stairsChargePerFlight: 14,
    heavyItemHandlingCharge: 32,
    exactArrivalPremiumGbp: 20,
    customSizeM3: {
      small: 0.1,
      medium: 0.35,
      large: 0.8,
      heavy: 1.2,
    },
    fuelSurchargeEnabled: true,
    fuelSurchargePerMile: 0.12,
    yesLiftChargePerEnd: 0,
    packingMaterialPerItemEnabled: false,
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
