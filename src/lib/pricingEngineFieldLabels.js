/** Human labels for pricing_settings keys (admin banners & audits). */

/** @type {Record<string, string>} */
export const PRICING_SETTING_FIELD_LABELS = {
  basePriceByService: 'Minimum service threshold (per service)',
  pricePerMile: 'Price per mile',
  pricePerCubicMetre: 'Price per cubic metre',
  minimumJobPrice: 'Minimum job price (fallback)',
  minimumJobPriceOneMan: 'Minimum — 1 Man',
  minimumJobPriceTwoMen: 'Minimum — 2 Men',
  minimumJobPriceThreeMen: 'Minimum — 3+ Men',
  floorChargePerFloor: 'Floor charge per floor',
  noLiftCharge: 'No lift charge',
  yesLiftChargePerEnd: 'Yes lift charge per end',
  fuelSurchargeEnabled: 'Fuel surcharge enabled',
  fuelSurchargePerMile: 'Fuel surcharge per mile',
  volumeMultiplier0To3M3: 'Volume multiplier 0–3 m³',
  volumeMultiplier3To8M3: 'Volume multiplier 3–8 m³',
  volumeMultiplier8To15M3: 'Volume multiplier 8–15 m³',
  volumeMultiplier15To25M3: 'Volume multiplier 15–25 m³',
  volumeMultiplier25PlusM3: 'Volume multiplier 25 m³+',
  sameDaySurchargePercent: 'Same day booking surcharge (%)',
  weekendSurchargePercent: 'Weekend surcharge (%) — legacy',
  saturdaySurchargePercent: 'Saturday surcharge (%)',
  sundaySurchargePercent: 'Sunday surcharge (%)',
  bankHolidaySurchargePercent: 'Bank holiday surcharge (%)',
  longWalkingDistanceCharge: 'Long walking distance',
  parkingCharge: 'Parking charge',
  stairsChargePerFlight: 'Stairs charge per flight',
  heavyItemHandlingCharge: 'Heavy item handling',
  waitingTimePricePerHour: 'Waiting time (per hour)',
  extraHelperPrice: 'Extra helper',
  packingPricePerBoxOrItem: 'Packing per box/item',
  dismantlingPricePerItem: 'Dismantling per item',
  reassemblyPricePerItem: 'Reassembly per item',
  fragilePackingSurcharge: 'Fragile packing surcharge',
  packingMaterialsFee: 'Packing materials fee',
  exactArrivalPremiumGbp: 'Exact arrival premium',
  depositAmount: 'Reservation fee',
  fallbackSpeedMph: 'Fallback speed (mph)',
  firstManBaseFee: 'First man base fee',
  firstManHourlyRate: 'First man hourly rate',
  secondManBaseFee: 'Second man base fee',
  secondManHourlyRate: 'Second man hourly rate',
  thirdManBaseFee: 'Third man base fee',
  thirdManHourlyRate: 'Third man hourly rate',
  fourthManBaseFee: 'Fourth man base fee',
  fourthManHourlyRate: 'Fourth man hourly rate',
}

/**
 * @param {string} key
 */
export function labelForPricingSettingKey(key) {
  return PRICING_SETTING_FIELD_LABELS[key] || key
}
