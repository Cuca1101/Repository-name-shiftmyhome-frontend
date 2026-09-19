/**
 * Volume scaling multipliers — applied to inventory volume £ (and optionally floors/no-lift).
 * Never scales the whole quote.
 * Below 15 m³: smooth piecewise-linear interpolation between anchors.
 * From 15 m³ up: flat bands — 15–20 (under 20), 20–30, 30+.
 */

import { getDefaultPricingSettings } from './defaultPricingSettings'

/** @typedef {'volumeMultiplier0To3M3'|'volumeMultiplier3To8M3'|'volumeMultiplier8To15M3'|'volumeMultiplier15To20M3'|'volumeMultiplier20To30M3'|'volumeMultiplier30PlusM3'} VolumeMultiplierSettingKey */

export const VOLUME_MULTIPLIER_SETTING_KEYS = /** @type {const} */ ([
  'volumeMultiplier0To3M3',
  'volumeMultiplier3To8M3',
  'volumeMultiplier8To15M3',
  'volumeMultiplier15To20M3',
  'volumeMultiplier20To30M3',
  'volumeMultiplier30PlusM3',
])

/** @type {{ key: VolumeMultiplierSettingKey, bandLabel: string, minM3: number }[]} */
export const VOLUME_MULTIPLIER_BANDS = [
  { key: 'volumeMultiplier30PlusM3', bandLabel: '30 m³+', minM3: 30 },
  { key: 'volumeMultiplier20To30M3', bandLabel: '20–30 m³', minM3: 20 },
  { key: 'volumeMultiplier15To20M3', bandLabel: '15–20 m³', minM3: 15 },
  { key: 'volumeMultiplier8To15M3', bandLabel: '8–15 m³', minM3: 8 },
  { key: 'volumeMultiplier3To8M3', bandLabel: '3–8 m³', minM3: 3 },
  { key: 'volumeMultiplier0To3M3', bandLabel: '0–3 m³', minM3: 0 },
]

/**
 * Map legacy 15–25 / 25+ keys onto the new 15–20 / 20–30 / 30+ keys.
 * @param {Record<string, unknown> | null | undefined} raw
 * @returns {Record<string, unknown>}
 */
export function migrateLegacyVolumeMultiplierKeys(raw) {
  if (!raw || typeof raw !== 'object') return {}
  /** @type {Record<string, unknown>} */
  const next = { ...raw }
  const legacy15 = Number(raw.volumeMultiplier15To25M3)
  const legacy25 = Number(raw.volumeMultiplier25PlusM3)
  if (
    (next.volumeMultiplier15To20M3 == null || next.volumeMultiplier15To20M3 === '') &&
    Number.isFinite(legacy15) &&
    legacy15 > 0
  ) {
    next.volumeMultiplier15To20M3 = legacy15
  }
  if (
    (next.volumeMultiplier20To30M3 == null || next.volumeMultiplier20To30M3 === '') &&
    Number.isFinite(legacy25) &&
    legacy25 > 0
  ) {
    next.volumeMultiplier20To30M3 = legacy25
  }
  if (
    (next.volumeMultiplier30PlusM3 == null || next.volumeMultiplier30PlusM3 === '') &&
    Number.isFinite(legacy25) &&
    legacy25 > 0
  ) {
    next.volumeMultiplier30PlusM3 = legacy25
  }
  return next
}

/**
 * @returns {Record<VolumeMultiplierSettingKey, number>}
 */
export function getDefaultVolumeScalingMultipliers() {
  const d = getDefaultPricingSettings()
  return {
    volumeMultiplier0To3M3: Number(d.volumeMultiplier0To3M3) || 1,
    volumeMultiplier3To8M3: Number(d.volumeMultiplier3To8M3) || 1.1,
    volumeMultiplier8To15M3: Number(d.volumeMultiplier8To15M3) || 1.2,
    volumeMultiplier15To20M3: Number(d.volumeMultiplier15To20M3) || 1.3,
    volumeMultiplier20To30M3: Number(d.volumeMultiplier20To30M3) || 1.4,
    volumeMultiplier30PlusM3: Number(d.volumeMultiplier30PlusM3) || 1.4,
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} raw
 * @returns {Record<VolumeMultiplierSettingKey, 'admin'|'defaults'>}
 */
export function detectVolumeMultiplierSources(raw) {
  const migrated = migrateLegacyVolumeMultiplierKeys(raw)
  /** @type {Record<VolumeMultiplierSettingKey, 'admin'|'defaults'>} */
  const out = {}
  for (const key of VOLUME_MULTIPLIER_SETTING_KEYS) {
    const rawVal = migrated?.[key]
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
  const migrated = migrateLegacyVolumeMultiplierKeys(settings)
  for (const key of VOLUME_MULTIPLIER_SETTING_KEYS) {
    const n = Number(migrated[key])
    if (Number.isFinite(n) && n >= 1) resolved[key] = n
  }
  return resolved
}

/**
 * @param {Record<VolumeMultiplierSettingKey, number>} multipliers
 * @param {number} totalCubicMetres
 */
export function interpolateVolumeMultiplier(multipliers, totalCubicMetres) {
  const v = Math.max(0, Number(totalCubicMetres) || 0)

  if (v > 30) {
    return {
      multiplier: multipliers.volumeMultiplier30PlusM3,
      bandLabel: '30 m³+',
      bandKey: /** @type {VolumeMultiplierSettingKey} */ ('volumeMultiplier30PlusM3'),
      interpolated: false,
    }
  }
  if (v >= 20) {
    return {
      multiplier: multipliers.volumeMultiplier20To30M3,
      bandLabel: '20–30 m³',
      bandKey: /** @type {VolumeMultiplierSettingKey} */ ('volumeMultiplier20To30M3'),
      interpolated: false,
    }
  }
  if (v >= 15) {
    return {
      multiplier: multipliers.volumeMultiplier15To20M3,
      bandLabel: '15–20 m³',
      bandKey: /** @type {VolumeMultiplierSettingKey} */ ('volumeMultiplier15To20M3'),
      interpolated: false,
    }
  }

  /** Smooth below 15 m³ only. */
  /** @type {{ m3: number, mult: number, key: VolumeMultiplierSettingKey, label: string }[]} */
  const anchors = [
    { m3: 0, mult: multipliers.volumeMultiplier0To3M3, key: 'volumeMultiplier0To3M3', label: '0–3 m³' },
    { m3: 3, mult: multipliers.volumeMultiplier3To8M3, key: 'volumeMultiplier3To8M3', label: '3–8 m³' },
    { m3: 8, mult: multipliers.volumeMultiplier8To15M3, key: 'volumeMultiplier8To15M3', label: '8–15 m³' },
    { m3: 15, mult: multipliers.volumeMultiplier15To20M3, key: 'volumeMultiplier15To20M3', label: '15–20 m³' },
  ]

  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i]
    const b = anchors[i + 1]
    if (v >= a.m3 && v < b.m3) {
      const t = (v - a.m3) / (b.m3 - a.m3)
      const multiplier = Math.round((a.mult + (b.mult - a.mult) * t) * 10000) / 10000
      const atAnchor = Math.abs(v - a.m3) < 0.0001
      return {
        multiplier,
        bandLabel: atAnchor ? a.label : `${a.label} → ${b.label} (smooth)`,
        bandKey: a.key,
        interpolated: !atAnchor && Math.abs(a.mult - b.mult) > 0.0001,
      }
    }
  }

  const first = anchors[0]
  return {
    multiplier: first.mult,
    bandLabel: first.label,
    bandKey: first.key,
    interpolated: false,
  }
}

/**
 * @param {import('./pricingCalculator.js').PricingSettings | null | undefined} settings
 * @param {number} totalCubicMetres
 */
export function resolveVolumePricingMultiplier(settings, totalCubicMetres) {
  const multipliers = resolveVolumeScalingMultipliersFromSettings(settings)
  const sources =
    settings?.volumeMultiplierSources && typeof settings.volumeMultiplierSources === 'object'
      ? settings.volumeMultiplierSources
      : detectVolumeMultiplierSources(settings)

  const smooth = interpolateVolumeMultiplier(multipliers, totalCubicMetres)
  return {
    multiplier: smooth.multiplier,
    bandLabel: smooth.bandLabel,
    bandKey: smooth.bandKey,
    multiplierSource: sources[smooth.bandKey] === 'admin' ? 'admin' : 'defaults',
    multipliersUsed: multipliers,
    multiplierSources: sources,
    interpolated: smooth.interpolated,
  }
}
