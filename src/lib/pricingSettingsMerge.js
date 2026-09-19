import { getDefaultPricingSettings } from './defaultPricingSettings'
import {
  copyWebsiteRatesToDriverAppExtraCharge,
  getDriverAppExtraChargeMode,
  mergeDriverAppExtraChargePricing,
} from './driverExtraChargePricingSettings.js'
import {
  detectVolumeMultiplierSources,
  migrateLegacyVolumeMultiplierKeys,
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
  'applyVolumeMultiplierToAccessCharges',
  'withLiftAccessPercentOfNoLift',
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
  const migrated = migrateLegacyVolumeMultiplierKeys(raw && typeof raw === 'object' ? raw : null)
  if (!raw || typeof raw !== 'object') return [...CORE_PRICING_KEYS]
  return CORE_PRICING_KEYS.filter((key) => {
    const value = migrated[key] ?? raw[key]
    if (key === 'basePriceByService') {
      return !value || typeof value !== 'object' || !Object.keys(value).length
    }
    if (key === 'fuelSurchargeEnabled' || key === 'applyVolumeMultiplierToAccessCharges') {
      return value === undefined || value === null
    }
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
  const rawIn = raw && typeof raw === 'object' ? migrateLegacyVolumeMultiplierKeys(raw) : raw
  const missingBeforeMerge = detectMissingPricingSettingKeys(rawIn)
  const base = rawIn?.basePriceByService && typeof rawIn.basePriceByService === 'object'
    ? { ...defaults.basePriceByService, ...rawIn.basePriceByService }
    : defaults.basePriceByService
  const custom =
    rawIn?.customSizeM3 && typeof rawIn.customSizeM3 === 'object'
      ? { ...defaults.customSizeM3, ...rawIn.customSizeM3 }
      : defaults.customSizeM3
  const promoCodes = Array.isArray(rawIn?.promoCodes)
    ? rawIn.promoCodes
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
    ...(rawIn && typeof rawIn === 'object' ? rawIn : {}),
    basePriceByService: base,
    customSizeM3: custom,
    promoCodes,
    driverAppExtraChargeMode:
      rawIn?.driverAppExtraChargesCustomEnabled === true &&
      rawIn?.driverAppExtraChargeMode === 'custom'
        ? 'custom'
        : 'website',
    driverAppExtraChargesCustomEnabled: rawIn?.driverAppExtraChargesCustomEnabled === true,
    driverAppExtraCharges: (() => {
      const mergedMain = {
        ...defaults,
        ...(rawIn && typeof rawIn === 'object' ? rawIn : {}),
        basePriceByService: base,
        customSizeM3: custom,
        driverAppExtraChargeMode:
          rawIn?.driverAppExtraChargesCustomEnabled === true &&
          rawIn?.driverAppExtraChargeMode === 'custom'
            ? 'custom'
            : 'website',
        driverAppExtraChargesCustomEnabled: rawIn?.driverAppExtraChargesCustomEnabled === true,
      }
      if (getDriverAppExtraChargeMode(mergedMain) === 'custom') {
        return {
          ...copyWebsiteRatesToDriverAppExtraCharge(mergedMain),
          ...mergeDriverAppExtraChargePricing(
            rawIn?.driverAppExtraCharges && typeof rawIn.driverAppExtraCharges === 'object'
              ? rawIn.driverAppExtraCharges
              : null,
          ),
        }
      }
      return copyWebsiteRatesToDriverAppExtraCharge(mergedMain)
    })(),
    volumeMultiplierSources: detectVolumeMultiplierSources(rawIn),
  }

  for (const key of VOLUME_MULTIPLIER_SETTING_KEYS) {
    const n = Number(merged[key])
    // Whole-quote underpricing from legacy values like 0.2 — require ≥ 1.
    merged[key] = Number.isFinite(n) && n >= 1 ? n : defaults[key]
  }

  // Service base is always a floor, never × crew.
  merged.basePricePerMan = false
  merged.applyVolumeMultiplierToAccessCharges = Boolean(merged.applyVolumeMultiplierToAccessCharges)
  {
    const pct = Number(merged.withLiftAccessPercentOfNoLift)
    merged.withLiftAccessPercentOfNoLift = Number.isFinite(pct)
      ? Math.max(0, Math.min(100, pct))
      : defaults.withLiftAccessPercentOfNoLift
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
