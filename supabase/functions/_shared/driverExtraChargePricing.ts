/**
 * Driver app extra-charge rates — synced with main Pricing Engine by default.
 * Custom overrides: pricing_settings.data.driverAppExtraCharges when mode = custom.
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
  'volumeMultiplier0To3M3',
  'volumeMultiplier3To8M3',
  'volumeMultiplier8To15M3',
  'volumeMultiplier15To25M3',
  'volumeMultiplier25PlusM3',
] as const

const FALLBACK_DEFAULTS: Record<string, number> = {
  pricePerCubicMetre: 14,
  heavyItemHandlingCharge: 32,
  floorChargePerFloor: 13,
  noLiftCharge: 30,
  yesLiftChargePerEnd: 0,
  stairsChargePerFlight: 14,
  longWalkingDistanceCharge: 28,
  parkingCharge: 15,
  waitingTimePricePerHour: 40,
  dismantlingPricePerItem: 42,
  reassemblyPricePerItem: 42,
  extraHelperPrice: 40,
  volumeMultiplier0To3M3: 1,
  volumeMultiplier3To8M3: 1.1,
  volumeMultiplier8To15M3: 1.2,
  volumeMultiplier15To25M3: 1.35,
  volumeMultiplier25PlusM3: 1.5,
}

export function mergeDriverAppExtraChargePricing(
  raw: Record<string, unknown> | null | undefined,
): Record<string, number> {
  const merged = { ...FALLBACK_DEFAULTS }
  if (!raw || typeof raw !== 'object') return merged
  for (const key of DRIVER_APP_EXTRA_CHARGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue
    const n = Number(raw[key])
    if (Number.isFinite(n)) {
      merged[key] = key.startsWith('volumeMultiplier') && n <= 0 ? 1 : n
    }
  }
  return merged
}

export function copyWebsiteRatesToDriverAppExtraCharge(
  data: Record<string, unknown> | null | undefined,
): Record<string, number> {
  const src = data && typeof data === 'object' ? data : {}
  const pick: Record<string, unknown> = {}
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

export function getDriverAppExtraChargeMode(
  data: Record<string, unknown> | null | undefined,
): 'website' | 'custom' {
  const enabled = data?.driverAppExtraChargesCustomEnabled === true
  const mode = String(data?.driverAppExtraChargeMode || 'website').toLowerCase()
  if (enabled && mode === 'custom') return 'custom'
  return 'website'
}

/**
 * Driver app always uses live main Pricing Engine fields (Access charges, £/m³, etc.).
 * The driverAppExtraCharges block is a saved snapshot for admin preview only — not applied
 * on mobile, so stale custom values (e.g. £1/floor) cannot override the main engine.
 */
export function resolveDriverExtraChargePricing(
  pricingSettingsData: Record<string, unknown> | null | undefined,
): Record<string, number> {
  return copyWebsiteRatesToDriverAppExtraCharge(pricingSettingsData)
}

export function getDriverRatesDebugSnapshot(
  rates: Record<string, number>,
  pricingData?: Record<string, unknown> | null,
) {
  const mainFloor = Number(pricingData?.floorChargePerFloor)
  const blockFloor = Number(
    (pricingData?.driverAppExtraCharges as Record<string, unknown> | undefined)?.floorChargePerFloor,
  )
  return {
    price_per_m3: rates.pricePerCubicMetre,
    waiting_per_hour: rates.waitingTimePricePerHour,
    floor_per_floor: rates.floorChargePerFloor,
    no_lift: rates.noLiftCharge,
    main_engine_floor_per_floor: Number.isFinite(mainFloor) ? mainFloor : null,
    driver_block_floor_per_floor: Number.isFinite(blockFloor) ? blockFloor : null,
  }
}
