/** @typedef {{ oneManAllowed: boolean, minimumCrew: number, message: string }} CrewRestrictions */

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
