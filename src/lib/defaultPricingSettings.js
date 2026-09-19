import { SERVICE_TYPES } from '../constants/serviceTypes'

/**
 * Offline / fallback pricing when Supabase `pricing_settings` is unavailable.
 * Competitive calibrated rates for ShiftMyHome (small jobs competitive, large jobs profitable).
 */
export function getDefaultPricingSettings() {
  const basePriceByService = Object.fromEntries(
    SERVICE_TYPES.map((s) => {
      // Floors only — never hard-added. Keep at/below crew job mins so mins dominate for MWV.
      if (s === 'Man with Van') return [s, 0]
      if (s === 'Furniture Delivery') return [s, 0]
      if (s === 'Office Moves') return [s, 90]
      if (s === 'Clearance') return [s, 60]
      if (s === 'Storage Move') return [s, 55]
      if (s === 'Student Moves') return [s, 0]
      if (s === 'House Removals') return [s, 110]
      return [s, 0]
    }),
  )

  return {
    basePriceByService,
    displayPriceByService: {},
    pricePerMile: 1.3,
    pricePerCubicMetre: 10,
    minimumJobPrice: 50,
    minimumJobPriceOneMan: 50,
    /** £70 keeps a typical small 2-man local job (e.g. fridge / ~6 mi / Sat) in the £65–£75 band. */
    minimumJobPriceTwoMen: 70,
    minimumJobPriceThreeMen: 90,
    floorChargePerFloor: 13,
    noLiftCharge: 30,
    /**
     * When true, floor + no-lift access £ are multiplied by the same volume-band factor
     * as inventory (protects small m³ jobs; scales stairs work on large loads).
     */
    applyVolumeMultiplierToAccessCharges: false,
    /**
     * When volume×access is on: stairs scale by bandMult × max(1, m³ / reference).
     * At reference m³ the extra factor is ×1; above it, stairs grow with cubes
     * (e.g. 16 m³ / 8 = ×2 on top of the volume band).
     */
    accessVolumeReferenceM3: 8,
    /**
     * When lift = Yes above ground: charge this % of the full no-lift stairs stack
     * (floor £ + no-lift £, incl. volume×access if enabled). 50 = half, 40 = 40%.
     * 0 = legacy (floor £ only + optional yesLiftChargePerEnd).
     */
    withLiftAccessPercentOfNoLift: 50,
    longWalkingDistanceCharge: 28,
    parkingCharge: 15,
    waitingTimePricePerHour: 40,
    sameDaySurchargePercent: 10,
    weekendSurchargePercent: 8,
    saturdaySurchargePercent: 8,
    sundaySurchargePercent: 10,
    bankHolidaySurchargePercent: 20,
    extraHelperPrice: 40,
    crewSurchargePerExtraMember: 40,
    fallbackSpeedMph: 30,
    averageSpeedMph: 30,
    secondManBaseFee: 0,
    secondManHourlyRate: 16,
    firstManBaseFee: 0,
    firstManHourlyRate: 12,
    firstManLabourFee: 30,
    thirdManBaseFee: 0,
    thirdManHourlyRate: 18,
    fourthManBaseFee: 0,
    fourthManHourlyRate: 18,
    secondManLabourFee: 30,
    thirdManLabourFee: 38,
    fourthManLabourFee: 38,
    oneManLabourDiscountPercent: 10,
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
    heavyItemHandlingCharge: 35,
    exactArrivalPremiumGbp: 20,
    customSizeM3: {
      small: 0.1,
      medium: 0.35,
      large: 0.8,
      heavy: 1.2,
    },
    fuelSurchargeEnabled: false,
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
    /** Applied to inventory volume £; optionally floors/no-lift when applyVolumeMultiplierToAccessCharges. */
    volumeMultiplier0To3M3: 1,
    volumeMultiplier3To8M3: 1.1,
    volumeMultiplier8To15M3: 1.2,
    volumeMultiplier15To20M3: 1.3,
    volumeMultiplier20To30M3: 1.4,
    volumeMultiplier30PlusM3: 1.4,
  }
}
