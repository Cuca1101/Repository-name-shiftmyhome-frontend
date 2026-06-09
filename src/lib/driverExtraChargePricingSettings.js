import {
  DRIVER_APP_EXTRA_CHARGE_KEYS,
  getDefaultDriverAppExtraChargePricing,
} from './driverExtraChargePricingDefaults'

/** @typedef {'website' | 'custom'} DriverAppExtraChargeMode */

/**
 * @param {Record<string, unknown>|null|undefined} raw
 * @returns {Record<string, number>}
 */
export function mergeDriverAppExtraChargePricing(raw) {
  const defaults = getDefaultDriverAppExtraChargePricing()
  /** @type {Record<string, number>} */
  const merged = { ...defaults }
  if (!raw || typeof raw !== 'object') {
    return merged
  }
  for (const key of DRIVER_APP_EXTRA_CHARGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue
    const v = raw[key]
    if (v === '' || v === null || v === undefined) continue
    const n = Number(v)
    if (Number.isFinite(n)) {
      merged[key] = key.startsWith('volumeMultiplier') && n <= 0 ? 1 : n
    }
  }
  return merged
}

/**
 * Live website pricing engine rates (top-level pricing_settings.data fields).
 * @param {Record<string, unknown>|null|undefined} pricingSettingsData
 * @returns {Record<string, number>}
 */
export function copyWebsiteRatesToDriverAppExtraCharge(pricingSettingsData) {
  /** @type {Record<string, unknown>} */
  const src = pricingSettingsData && typeof pricingSettingsData === 'object' ? pricingSettingsData : {}
  /** @type {Record<string, unknown>} */
  const pick = {}
  for (const key of DRIVER_APP_EXTRA_CHARGE_KEYS) {
    if (key === 'dismantlingPricePerItem') {
      pick[key] = src.dismantlingPricePerItem ?? src.dismantlingPrice
    } else if (key === 'reassemblyPricePerItem') {
      pick[key] = src.reassemblyPricePerItem ?? src.reassemblyPrice
    } else if (Object.prototype.hasOwnProperty.call(src, key)) {
      pick[key] = src[key]
    }
  }
  return mergeDriverAppExtraChargePricing(pick)
}

/**
 * @param {Record<string, unknown>|null|undefined} pricingSettingsData
 * @returns {DriverAppExtraChargeMode}
 */
export function getDriverAppExtraChargeMode(pricingSettingsData) {
  const enabled = pricingSettingsData?.driverAppExtraChargesCustomEnabled === true
  const mode = String(pricingSettingsData?.driverAppExtraChargeMode || 'website').toLowerCase()
  if (enabled && mode === 'custom') return 'custom'
  return 'website'
}

/**
 * Driver app always uses live main Pricing Engine fields (not driverAppExtraCharges snapshot).
 * @param {Record<string, unknown>|null|undefined} pricingSettingsData
 * @returns {Record<string, number>}
 */
export function resolveDriverExtraChargePricing(pricingSettingsData) {
  return copyWebsiteRatesToDriverAppExtraCharge(pricingSettingsData)
}

/** @returns {Record<string, number>} */
export function getDriverRatesDebugSnapshot(rates) {
  return {
    price_per_m3: rates.pricePerCubicMetre,
    waiting_per_hour: rates.waitingTimePricePerHour,
    floor_per_floor: rates.floorChargePerFloor,
    no_lift: rates.noLiftCharge,
  }
}

/**
 * What the driver app uses after the next Save (preview in admin).
 * @param {Record<string, unknown>|null|undefined} pricingSettingsData
 */
export function previewDriverAppRatesForAdmin(pricingSettingsData) {
  return resolveDriverExtraChargePricing(pricingSettingsData)
}

/**
 * Green panel / driver block edits → top-level Pricing Engine fields (what mobile uses).
 * @param {Record<string, unknown>} prev
 * @param {Record<string, unknown>} driverBlock
 * @returns {Record<string, unknown>}
 */
export function syncDriverPanelToMainPricingFields(prev, driverBlock) {
  /** @type {Record<string, unknown>} */
  const next = { ...prev }
  if (!driverBlock || typeof driverBlock !== 'object') return next
  for (const key of DRIVER_APP_EXTRA_CHARGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(driverBlock, key)) continue
    const v = driverBlock[key]
    if (v === '' || v === null || v === undefined) continue
    const n = Number(v)
    if (Number.isFinite(n)) {
      next[key] = key.startsWith('volumeMultiplier') && n <= 0 ? 1 : n
    }
  }
  next.driverAppExtraChargeMode = 'website'
  next.driverAppExtraChargesCustomEnabled = false
  next.driverAppExtraCharges = copyWebsiteRatesToDriverAppExtraCharge(next)
  return next
}

/**
 * Before save: keep driver snapshot aligned with website when not in custom mode.
 * @param {Record<string, unknown>} settings
 * @returns {Record<string, unknown>}
 */
export function preparePricingSettingsForSave(settings) {
  const next = { ...settings }
  // Driver app + payment links read top-level Pricing Engine fields only (see resolveDriverExtraChargePricing).
  // Reset legacy custom mode so admin UI and DB stay aligned; snapshot is for audit/preview only.
  next.driverAppExtraChargeMode = 'website'
  next.driverAppExtraChargesCustomEnabled = false
  next.driverAppExtraCharges = copyWebsiteRatesToDriverAppExtraCharge(next)
  return next
}
