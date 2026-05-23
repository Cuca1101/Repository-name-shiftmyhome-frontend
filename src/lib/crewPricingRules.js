/** @typedef {{ oneManAllowed: boolean, minimumCrew: number, message: string }} CrewRestrictions */

import { resolveFallbackSpeedMph } from './pricingSettingValue'

export const HOUSE_REMOVALS_SERVICE = 'House Removals'

/**
 * Minimum crew required for pricing (not customer UI toggles).
 * @param {string} [serviceType]
 * @param {number} [heavyItemCount]
 * @returns {number}
 */
export function getMinimumCrewForQuote(serviceType, heavyItemCount = 0) {
  const heavy = Math.max(0, Number(heavyItemCount) || 0)
  if (serviceType === HOUSE_REMOVALS_SERVICE || heavy > 0) return 2
  return 1
}

/**
 * Whether 1 Man can be selected on the quote.
 * @param {{ serviceType?: string, heavyItemCount?: number }} input
 * @returns {CrewRestrictions}
 */
export function getQuoteCrewRestrictions({ serviceType, heavyItemCount = 0 } = {}) {
  const reasons = []
  if (serviceType === HOUSE_REMOVALS_SERVICE) {
    reasons.push('House removals require at least 2 crew members.')
  }
  const heavy = Math.max(0, Number(heavyItemCount) || 0)
  if (heavy > 0) {
    reasons.push('Heavy items require at least 2 crew members.')
  }
  /** Student moves allow 1 man only when inventory has no heavy items (see heavy count above). */
  const minimumCrew = getMinimumCrewForQuote(serviceType, heavy)
  return {
    oneManAllowed: reasons.length === 0,
    minimumCrew,
    message: reasons.join(' '),
  }
}

/** Access lines that count as labour (eligible for one-man % discount). */
const LABOUR_ACCESS_PREFIXES = [
  'Floor/access',
  'No lift supplement',
  'Lift access charge',
  'Stairs (',
]

/**
 * @param {string} label
 */
export function isLabourAccessLine(label) {
  const t = String(label || '')
  return LABOUR_ACCESS_PREFIXES.some((p) => t.startsWith(p))
}

/**
 * Move summary label: shows crew used in pricing; notes when bumped above selection.
 * @param {number | string | null | undefined} selectedCrew
 * @param {number | null | undefined} crewSizeUsedInPricing
 * @param {import('./pricingCalculator.js').PricingSettings | null | undefined} crewSettings
 */
export function formatMoveSummaryCrewForPricing(selectedCrew, crewSizeUsedInPricing, crewSettings) {
  const used = Number(crewSizeUsedInPricing)
  const selected = Number(selectedCrew)
  const usedLabel =
    used >= 1 && used <= 4
      ? formatCrewSizeLabel(used, crewSettings)
      : ''
  const selectedLabel =
    selected >= 1 && selected <= 4
      ? formatCrewSizeLabel(selected, crewSettings)
      : ''

  if (usedLabel && selectedLabel && used !== selected) {
    return `${usedLabel} (priced — you selected ${selectedLabel})`
  }
  if (usedLabel) return usedLabel
  if (selectedLabel) return selectedLabel
  return ''
}

/**
 * @param {number} crewSize
 * @param {import('./pricingCalculator.js').PricingSettings | null | undefined} crewSettings
 */
export function formatCrewSizeLabel(crewSize, crewSettings) {
  const n = Number(crewSize)
  if (!(n >= 1 && n <= 4)) return ''
  const options = [
    { value: 1, label: '1 Man', enabled: crewSettings?.crewSizeOneEnabled !== false },
    { value: 2, label: '2 Men', enabled: crewSettings?.crewSizeTwoEnabled !== false },
    { value: 3, label: '3 Men', enabled: crewSettings?.crewSizeThreeEnabled !== false },
    { value: 4, label: '4 Men', enabled: Boolean(crewSettings?.crewSizeFourEnabled) },
  ].filter((o) => o.enabled)
  const match = options.find((o) => o.value === n)
  return match?.label ?? `${n} ${n === 1 ? 'Man' : 'Men'}`
}

/**
 * Distance/time-based crew labour (AnyVan-style): travel hours × hourly + base.
 * @param {import('./pricingCalculator.js').PricingSettings} settings
 */
export function usesDistanceBasedCrewLabour(settings) {
  return (
    Number(settings.secondManHourlyRate) > 0 ||
    Number(settings.thirdManHourlyRate) > 0 ||
    Number(settings.secondManBaseFee) > 0 ||
    Number(settings.thirdManBaseFee) > 0 ||
    Number(settings.firstManHourlyRate) > 0 ||
    Number(settings.firstManBaseFee) > 0
  )
}

/** @typedef {'first'|'second'|'third'|'fourth'} CrewRole */

const CREW_ROLES = /** @type {const} */ (['first', 'second', 'third', 'fourth'])
const CREW_BASE_LABELS = {
  first: 'First man',
  second: 'Second man',
  third: 'Third man',
  fourth: 'Fourth man',
}

/**
 * Per-job crew: firstManBase + secondManBase + … (once per job, not × hours/mileage/access).
 * @param {import('./pricingCalculator.js').PricingSettings} settings
 * @param {number} crewSize
 */
export function computeCrewBaseFees(settings, crewSize) {
  const n = Math.max(1, Math.min(4, Math.round(Number(crewSize) || 1)))
  /** @type {{ role: CrewRole, label: string, amount: number }[]} */
  const lines = []
  let total = 0
  for (let i = 0; i < n; i++) {
    const role = CREW_ROLES[i]
    const { baseFee } = resolveCrewLabourDistanceRates(settings, role)
    const amount = Math.round(baseFee * 100) / 100
    if (amount > 0) {
      lines.push({ role, label: `${CREW_BASE_LABELS[role]} base`, amount })
      total += amount
    }
  }
  return {
    lines,
    total: Math.round(total * 100) / 100,
    firstManBase: lines.find((l) => l.role === 'first')?.amount ?? 0,
    secondManBase: lines.find((l) => l.role === 'second')?.amount ?? 0,
    thirdManBase: lines.find((l) => l.role === 'third')?.amount ?? 0,
    fourthManBase: lines.find((l) => l.role === 'fourth')?.amount ?? 0,
  }
}

/**
 * Minimum operational threshold — service base + crew base fees (once per job; not added to subtotal).
 * `basePricePerMan` is ignored here so the admin toggle cannot inflate the threshold.
 * @param {import('./pricingCalculator.js').PricingSettings} settings
 * @param {string} serviceType
 * @param {number} crewSize
 */
export function resolveMinimumBaseThreshold(settings, serviceType, crewSize) {
  const serviceBasePrice = Math.max(0, Number(settings.basePriceByService?.[serviceType]) || 0)
  const crewBaseFees = computeCrewBaseFees(settings, crewSize)
  const minimumBaseThreshold = Math.round((serviceBasePrice + crewBaseFees.total) * 100) / 100
  return { serviceBasePrice, crewBaseFees, minimumBaseThreshold }
}

/**
 * @param {import('./pricingCalculator.js').PricingSettings} settings
 */
export function getFallbackSpeedMph(settings) {
  return resolveFallbackSpeedMph(settings)
}

/**
 * Fallback only — miles ÷ speed when live Mapbox duration is missing.
 * @param {number} distanceMiles
 * @param {import('./pricingCalculator.js').PricingSettings} settings
 */
export function estimateTravelHoursFromDistance(distanceMiles, settings) {
  const miles = Math.max(0, Number(distanceMiles) || 0)
  const speed = getFallbackSpeedMph(settings)
  return miles / speed
}

/**
 * PRIMARY: live Mapbox Directions `routes[0].duration` (seconds) → travel hours.
 * FALLBACK: miles ÷ fallbackSpeedMph only when duration is missing or route failed.
 * @param {import('./pricingCalculator.js').PricingSettings} settings
 * @param {number} distanceMiles
 * @param {number | null | undefined} mapboxRouteDurationSeconds
 * @returns {{ travelHours: number, usedMapboxDuration: boolean, source: 'mapbox' | 'fallback_distance' }}
 */
export function resolveTravelHoursForCrewLabour(settings, distanceMiles, mapboxRouteDurationSeconds) {
  const sec = Number(mapboxRouteDurationSeconds)
  if (Number.isFinite(sec) && sec > 0) {
    return { travelHours: sec / 3600, usedMapboxDuration: true, source: 'mapbox' }
  }
  return {
    travelHours: estimateTravelHoursFromDistance(distanceMiles, settings),
    usedMapboxDuration: false,
    source: 'fallback_distance',
  }
}

/**
 * @param {import('./pricingCalculator.js').PricingSettings} settings
 * @param {'first'|'second'|'third'|'fourth'} role
 */
export function resolveCrewLabourDistanceRates(settings, role) {
  if (role === 'first') {
    return {
      baseFee: Math.max(0, Number(settings.firstManBaseFee ?? settings.secondManBaseFee) || 0),
      hourly: Math.max(0, Number(settings.firstManHourlyRate ?? settings.secondManHourlyRate) || 0),
    }
  }
  if (role === 'second') {
    return {
      baseFee: Math.max(0, Number(settings.secondManBaseFee) || 0),
      hourly: Math.max(0, Number(settings.secondManHourlyRate) || 0),
    }
  }
  if (role === 'third') {
    return {
      baseFee: Math.max(0, Number(settings.thirdManBaseFee) || 0),
      hourly: Math.max(0, Number(settings.thirdManHourlyRate) || 0),
    }
  }
  return {
    baseFee: Math.max(0, Number(settings.fourthManBaseFee ?? settings.thirdManBaseFee) || 0),
    hourly: Math.max(0, Number(settings.fourthManHourlyRate ?? settings.thirdManHourlyRate) || 0),
  }
}

/**
 * @param {import('./pricingCalculator.js').PricingSettings} settings
 * @param {number} distanceMiles
 * @param {number | null | undefined} mapboxRouteDurationSeconds
 * @param {'first'|'second'|'third'|'fourth'} role
 */
/**
 * Hourly crew labour only — excludes per-man base fees (those belong in basePrice).
 * @param {import('./pricingCalculator.js').PricingSettings} settings
 * @param {number} distanceMiles
 * @param {number | null | undefined} mapboxRouteDurationSeconds
 * @param {CrewRole} role
 */
export function calculateDistanceBasedCrewHourlyLabourFee(
  settings,
  distanceMiles,
  mapboxRouteDurationSeconds,
  role,
) {
  const { travelHours: hours } = resolveTravelHoursForCrewLabour(
    settings,
    distanceMiles,
    mapboxRouteDurationSeconds,
  )
  const { hourly } = resolveCrewLabourDistanceRates(settings, role)
  return hours * hourly
}

export function calculateDistanceBasedCrewLabourFee(
  settings,
  distanceMiles,
  mapboxRouteDurationSeconds,
  role,
) {
  const { baseFee } = resolveCrewLabourDistanceRates(settings, role)
  return (
    baseFee +
    calculateDistanceBasedCrewHourlyLabourFee(
      settings,
      distanceMiles,
      mapboxRouteDurationSeconds,
      role,
    )
  )
}

/**
 * Flat labour fees for 2nd/3rd/4th crew when distance-based settings are off.
 * @param {import('./pricingCalculator.js').PricingSettings} settings
 */
export function resolveCrewLabourFees(settings) {
  const legacy = Number(settings.crewSurchargePerExtraMember ?? settings.extraHelperPrice) || 0
  const firstRaw = Number(settings.firstManLabourFee ?? settings.secondManLabourFee)
  const secondRaw = Number(settings.secondManLabourFee)
  const thirdRaw = Number(settings.thirdManLabourFee)
  const fourthRaw = Number(settings.fourthManLabourFee)
  const first = firstRaw > 0 ? firstRaw : legacy
  const second = secondRaw > 0 ? secondRaw : legacy
  const third = thirdRaw > 0 ? thirdRaw : legacy
  const fourth = fourthRaw > 0 ? fourthRaw : third
  return { first, second, third, fourth }
}

/**
 * @param {number} distanceMiles
 * @param {number} hours
 * @param {boolean} [usedMapboxDuration]
 */
/**
 * @param {number} hours
 * @param {number} [durationSeconds]
 */
export function formatLiveRouteDurationLabel(hours, durationSeconds) {
  const h = Math.max(0, Number(hours) || 0)
  const sec = Number(durationSeconds)
  if (Number.isFinite(sec) && sec > 0) {
    const mins = Math.round(sec / 60)
    if (mins < 60) return `${mins} min live route`
    return `~${h.toFixed(1)} hr live route (${mins} min)`
  }
  if (h < 1) return `${Math.round(h * 60)} min`
  return `~${h.toFixed(1)} hr`
}

export function formatCrewLabourTravelHint(distanceMiles, hours, usedMapboxDuration = false) {
  const mi = Math.max(0, Number(distanceMiles) || 0)
  const h = Math.max(0, Number(hours) || 0)
  if (mi <= 0 && h <= 0) return ''
  const hrLabel = h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} hr`
  const miPart = mi > 0 ? `${mi.toFixed(1)} mi, ` : ''
  const source = usedMapboxDuration ? 'live Mapbox travel time' : 'fallback miles ÷ speed'
  return ` — ${miPart}${hrLabel} (${source})`
}

/**
 * @param {string} label
 */
export function isCrewLabourExtraLine(label) {
  return String(label || '').includes('crew member (labour)')
}

/**
 * Minimum job price for the crew size used in pricing (falls back to `minimumJobPrice`).
 * @param {import('./pricingCalculator.js').PricingSettings} settings
 * @param {number} crewSize
 */
export function resolveMinimumJobPriceForCrew(settings, crewSize) {
  const fallback = Math.max(0, Number(settings.minimumJobPrice) || 0)
  const n = Math.max(1, Math.min(4, Math.round(Number(crewSize) || 1)))
  if (n === 1) {
    const v = Number(settings.minimumJobPriceOneMan)
    return v > 0 ? v : fallback
  }
  if (n === 2) {
    const v = Number(settings.minimumJobPriceTwoMen)
    return v > 0 ? v : fallback
  }
  const v = Number(settings.minimumJobPriceThreeMen)
  return v > 0 ? v : fallback
}

/**
 * @param {import('./pricingCalculator.js').BreakdownLine[]} extrasLines
 * @param {import('./pricingCalculator.js').PricingSettings} settings
 * @param {number} effectiveCrewSize
 * @param {number} distanceMiles
 * @param {number | null | undefined} mapboxRouteDurationSeconds
 * @param {(n: number) => number} roundMoney
 */
export function appendCrewLabourFeeLines(
  extrasLines,
  settings,
  effectiveCrewSize,
  distanceMiles,
  mapboxRouteDurationSeconds,
  roundMoney,
  opts = {},
) {
  const { hourlyOnly = false } = opts
  const distanceBased = usesDistanceBasedCrewLabour(settings)
  const travelResolve = distanceBased
    ? resolveTravelHoursForCrewLabour(settings, distanceMiles, mapboxRouteDurationSeconds)
    : null
  const travelHint = travelResolve
    ? formatCrewLabourTravelHint(
        distanceMiles,
        travelResolve.travelHours,
        travelResolve.usedMapboxDuration,
      )
    : ''

  const crewRoles = [
    { minCrew: 1, role: 'first', label: 'First' },
    { minCrew: 2, role: 'second', label: 'Second' },
    { minCrew: 3, role: 'third', label: 'Third' },
    { minCrew: 4, role: 'fourth', label: 'Fourth' },
  ]

  for (const { minCrew, role, label } of crewRoles) {
    if (effectiveCrewSize < minCrew) continue
    let amt = 0
    if (distanceBased) {
      amt = hourlyOnly
        ? calculateDistanceBasedCrewHourlyLabourFee(
            settings,
            distanceMiles,
            mapboxRouteDurationSeconds,
            role,
          )
        : calculateDistanceBasedCrewLabourFee(
            settings,
            distanceMiles,
            mapboxRouteDurationSeconds,
            role,
          )
    } else {
      amt = resolveCrewLabourFees(settings)[role]
    }
    if (amt > 0) {
      const suffix = hourlyOnly ? ' (hourly)' : ''
      extrasLines.push({
        label: `${label} crew member (labour)${suffix}${travelHint}`,
        amount: roundMoney(amt),
      })
    }
  }
}
