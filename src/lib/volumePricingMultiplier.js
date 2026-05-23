/**
 * Volume scaling multipliers — admin settings are the single source of truth.
 * Defaults live in defaultPricingSettings.js only.
 */

import { getDefaultPricingSettings } from './defaultPricingSettings'

/** @typedef {'volumeMultiplier0To3M3'|'volumeMultiplier3To8M3'|'volumeMultiplier8To15M3'|'volumeMultiplier15To25M3'|'volumeMultiplier25PlusM3'} VolumeMultiplierSettingKey */

export const VOLUME_MULTIPLIER_SETTING_KEYS = /** @type {const} */ ([
  'volumeMultiplier0To3M3',
  'volumeMultiplier3To8M3',
  'volumeMultiplier8To15M3',
  'volumeMultiplier15To25M3',
  'volumeMultiplier25PlusM3',
])

/** @type {{ key: VolumeMultiplierSettingKey, bandLabel: string, minM3: number }[]} */
export const VOLUME_MULTIPLIER_BANDS = [
  { key: 'volumeMultiplier25PlusM3', bandLabel: '25 m³+', minM3: 25 },
  { key: 'volumeMultiplier15To25M3', bandLabel: '15–25 m³', minM3: 15 },
  { key: 'volumeMultiplier8To15M3', bandLabel: '8–15 m³', minM3: 8 },
  { key: 'volumeMultiplier3To8M3', bandLabel: '3–8 m³', minM3: 3 },
  { key: 'volumeMultiplier0To3M3', bandLabel: '0–3 m³', minM3: 0 },
]

/**
 * @returns {Record<VolumeMultiplierSettingKey, number>}
 */
export function getDefaultVolumeScalingMultipliers() {
  const d = getDefaultPricingSettings()
  return {
    volumeMultiplier0To3M3: Number(d.volumeMultiplier0To3M3) || 1,
    volumeMultiplier3To8M3: Number(d.volumeMultiplier3To8M3) || 1.1,
    volumeMultiplier8To15M3: Number(d.volumeMultiplier8To15M3) || 1.2,
    volumeMultiplier15To25M3: Number(d.volumeMultiplier15To25M3) || 1.35,
    volumeMultiplier25PlusM3: Number(d.volumeMultiplier25PlusM3) || 1.5,
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} raw
 * @returns {Record<VolumeMultiplierSettingKey, 'admin'|'defaults'>}
 */
export function detectVolumeMultiplierSources(raw) {
  /** @type {Record<VolumeMultiplierSettingKey, 'admin'|'defaults'>} */
  const out = {}
  for (const key of VOLUME_MULTIPLIER_SETTING_KEYS) {
    const rawVal = raw?.[key]
    const n = Number(rawVal)
    out[key] =
      rawVal != null && rawVal !== '' && Number.isFinite(n) && n > 0 ? 'admin' : 'defaults'
  }
  return out
}

/**
 * @param {import('./pricingCalculator.js').PricingSettings | null | undefined} settings
 * @returns {Record<VolumeMultiplierSettingKey, number>}
 */
export function resolveVolumeScalingMultipliersFromSettings(settings) {
  const defaults = getDefaultVolumeScalingMultipliers()
  /** @type {Record<VolumeMultiplierSettingKey, number>} */
  const resolved = { ...defaults }
  if (!settings) return resolved
  for (const key of VOLUME_MULTIPLIER_SETTING_KEYS) {
    const n = Number(settings[key])
    if (Number.isFinite(n) && n > 0) resolved[key] = n
  }
  return resolved
}

/**
 * @param {import('./pricingCalculator.js').PricingSettings | null | undefined} settings
 * @param {number} totalCubicMetres
 */
export function resolveVolumePricingMultiplier(settings, totalCubicMetres) {
  const v = Math.max(0, Number(totalCubicMetres) || 0)
  const multipliers = resolveVolumeScalingMultipliersFromSettings(settings)
  const sources =
    settings?.volumeMultiplierSources && typeof settings.volumeMultiplierSources === 'object'
      ? settings.volumeMultiplierSources
      : detectVolumeMultiplierSources(settings)

  for (const band of VOLUME_MULTIPLIER_BANDS) {
    if (v >= band.minM3) {
      return {
        multiplier: multipliers[band.key],
        bandLabel: band.bandLabel,
        bandKey: band.key,
        multiplierSource: sources[band.key] === 'admin' ? 'admin' : 'defaults',
        multipliersUsed: multipliers,
        multiplierSources: sources,
      }
    }
  }

  const key = 'volumeMultiplier0To3M3'
  return {
    multiplier: multipliers[key],
    bandLabel: '0–3 m³',
    bandKey: key,
    multiplierSource: sources[key] === 'admin' ? 'admin' : 'defaults',
    multipliersUsed: multipliers,
    multiplierSources: sources,
  }
}
