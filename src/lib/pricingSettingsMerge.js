import { getDefaultPricingSettings } from './defaultPricingSettings'
import {
  copyWebsiteRatesToDriverAppExtraCharge,
  getDriverAppExtraChargeMode,
  mergeDriverAppExtraChargePricing,
} from './driverExtraChargePricingSettings.js'
import {
  detectVolumeMultiplierSources,
  VOLUME_MULTIPLIER_SETTING_KEYS,
} from './volumePricingMultiplier'

const CORE_PRICING_KEYS = [
  'pricePerMile',
  'pricePerCubicMetre',
  'minimumJobPrice',
  'minimumJobPriceOneMan',
  'minimumJobPriceTwoMen',
  'minimumJobPriceThreeMen',
  'floorChargePerFloor',
  'noLiftCharge',
  'yesLiftChargePerEnd',
  'fuelSurchargeEnabled',
  'fuelSurchargePerMile',
  'secondManBaseFee',
  'secondManHourlyRate',
  'firstManBaseFee',
  'firstManHourlyRate',
  'fourthManBaseFee',
  'fourthManHourlyRate',
  'basePriceByService',
  'sameDaySurchargePercent',
  'weekendSurchargePercent',
  'saturdaySurchargePercent',
  'sundaySurchargePercent',
  'bankHolidaySurchargePercent',
  'longWalkingDistanceCharge',
  'parkingCharge',
  'stairsChargePerFlight',
  'heavyItemHandlingCharge',
  'waitingTimePricePerHour',
  'extraHelperPrice',
  'packingPricePerBoxOrItem',
  'dismantlingPricePerItem',
  'reassemblyPricePerItem',
  'fragilePackingSurcharge',
  'packingMaterialsFee',
  'exactArrivalPremiumGbp',
  'depositAmount',
  'fallbackSpeedMph',
  'thirdManBaseFee',
  'thirdManHourlyRate',
  ...VOLUME_MULTIPLIER_SETTING_KEYS,
]

/**
 * @param {Record<string, unknown>|null|undefined} raw
 * @returns {string[]}
 */
export function detectMissingPricingSettingKeys(raw) {
  if (!raw || typeof raw !== 'object') return [...CORE_PRICING_KEYS]
  return CORE_PRICING_KEYS.filter((key) => {
    const value = raw[key]
    if (key === 'basePriceByService') {
      return !value || typeof value !== 'object' || !Object.keys(value).length
    }
    if (key === 'fuelSurchargeEnabled') return value === undefined || value === null
    return value === undefined || value === null || value === ''
  })
}

/**
 * Single merge path for admin + fallback defaults.
 * Do not calculate pricing in UI components. Use shared pricing engine only.
 * @param {Record<string, unknown>|null|undefined} raw
 * @param {{ warnOnFallback?: boolean, source?: string }} [opts]
 */
export function mergePricingSettingsWithDefaults(raw, opts = {}) {
  const defaults = getDefaultPricingSettings()
  const missingBeforeMerge = detectMissingPricingSettingKeys(raw)
  const base = raw?.basePriceByService && typeof raw.basePriceByService === 'object'
    ? { ...defaults.basePriceByService, ...raw.basePriceByService }
    : defaults.basePriceByService
  const custom =
    raw?.customSizeM3 && typeof raw.customSizeM3 === 'object'
      ? { ...defaults.customSizeM3, ...raw.customSizeM3 }
      : defaults.customSizeM3
  const promoCodes = Array.isArray(raw?.promoCodes)
    ? raw.promoCodes
        .filter((c) => c && typeof c === 'object')
        .map((c) => ({
          code: String(c.code || '').trim(),
          discountType: c.discountType === 'fixed' ? 'fixed' : 'percentage',
          discountValue: Math.max(0, Number(c.discountValue) || 0),
        }))
        .filter((c) => c.code.length > 0)
    : defaults.promoCodes

  const merged = {
    ...defaults,
    ...(raw && typeof raw === 'object' ? raw : {}),
    basePriceByService: base,
    customSizeM3: custom,
    promoCodes,
    driverAppExtraChargeMode:
      raw?.driverAppExtraChargesCustomEnabled === true &&
      raw?.driverAppExtraChargeMode === 'custom'
        ? 'custom'
        : 'website',
    driverAppExtraChargesCustomEnabled: raw?.driverAppExtraChargesCustomEnabled === true,
    driverAppExtraCharges: (() => {
      const mergedMain = {
        ...defaults,
        ...(raw && typeof raw === 'object' ? raw : {}),
        basePriceByService: base,
        customSizeM3: custom,
        driverAppExtraChargeMode:
          raw?.driverAppExtraChargesCustomEnabled === true &&
          raw?.driverAppExtraChargeMode === 'custom'
            ? 'custom'
            : 'website',
        driverAppExtraChargesCustomEnabled: raw?.driverAppExtraChargesCustomEnabled === true,
      }
      if (getDriverAppExtraChargeMode(mergedMain) === 'custom') {
        return {
          ...copyWebsiteRatesToDriverAppExtraCharge(mergedMain),
          ...mergeDriverAppExtraChargePricing(
            raw?.driverAppExtraCharges && typeof raw.driverAppExtraCharges === 'object'
              ? raw.driverAppExtraCharges
              : null,
          ),
        }
      }
      return copyWebsiteRatesToDriverAppExtraCharge(mergedMain)
    })(),
    volumeMultiplierSources: detectVolumeMultiplierSources(raw),
  }

  for (const key of VOLUME_MULTIPLIER_SETTING_KEYS) {
    const n = Number(merged[key])
    merged[key] = Number.isFinite(n) && n > 0 ? n : defaults[key]
  }

  const legacyWeekendPct = Number(merged.weekendSurchargePercent)
  const legacyWeekend =
    Number.isFinite(legacyWeekendPct) && legacyWeekendPct >= 0 ? legacyWeekendPct : defaults.weekendSurchargePercent
  if (merged.saturdaySurchargePercent == null || merged.saturdaySurchargePercent === '') {
    merged.saturdaySurchargePercent = legacyWeekend
  }
  if (merged.sundaySurchargePercent == null || merged.sundaySurchargePercent === '') {
    merged.sundaySurchargePercent = legacyWeekend
  }

  if (opts.warnOnFallback !== false && missingBeforeMerge.length > 0) {
    console.warn('Pricing fallback used because admin settings were missing', missingBeforeMerge, {
      source: opts.source || 'unknown',
    })
  }

  return merged
}
