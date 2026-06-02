import { getDefaultPricingSettings } from './defaultPricingSettings'
import { VOLUME_MULTIPLIER_SETTING_KEYS } from './volumePricingMultiplier'

/**
 * Keys used only by driver app extra charges (estimate-extra-charge).
 * Website quote wizard ignores this block.
 */
export const DRIVER_APP_EXTRA_CHARGE_KEYS = [
  'pricePerCubicMetre',
  'heavyItemHandlingCharge',
  'floorChargePerFloor',
  'noLiftCharge',
  'yesLiftChargePerEnd',
  'stairsChargePerFlight',
  'longWalkingDistanceCharge',
  'parkingCharge',
  'waitingTimePricePerHour',
  'dismantlingPricePerItem',
  'reassemblyPricePerItem',
  'extraHelperPrice',
  ...VOLUME_MULTIPLIER_SETTING_KEYS,
]

/**
 * Default rates for driver app — seeded from main defaults on first save, then independent.
 * @returns {Record<string, number>}
 */
export function getDefaultDriverAppExtraChargePricing() {
  const m = getDefaultPricingSettings()
  /** @type {Record<string, number>} */
  const out = {
    pricePerCubicMetre: Number(m.pricePerCubicMetre) || 0,
    heavyItemHandlingCharge: Number(m.heavyItemHandlingCharge) || 0,
    floorChargePerFloor: Number(m.floorChargePerFloor) || 0,
    noLiftCharge: Number(m.noLiftCharge) || 0,
    yesLiftChargePerEnd: Number(m.yesLiftChargePerEnd) || 0,
    stairsChargePerFlight: Number(m.stairsChargePerFlight) || 0,
    longWalkingDistanceCharge: Number(m.longWalkingDistanceCharge) || 0,
    parkingCharge: Number(m.parkingCharge) || 0,
    waitingTimePricePerHour: Number(m.waitingTimePricePerHour) || 0,
    dismantlingPricePerItem: Number(m.dismantlingPricePerItem ?? m.dismantlingPrice) || 0,
    reassemblyPricePerItem: Number(m.reassemblyPricePerItem ?? m.reassemblyPrice) || 0,
    extraHelperPrice: Number(m.extraHelperPrice) || 0,
  }
  for (const key of VOLUME_MULTIPLIER_SETTING_KEYS) {
    const n = Number(m[key])
    out[key] = Number.isFinite(n) && n > 0 ? n : 1
  }
  return out
}
