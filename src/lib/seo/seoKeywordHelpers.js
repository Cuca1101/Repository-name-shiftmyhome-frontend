/**
 * SEO keyword and metadata helpers for Scotland location pages.
 */

const SEO_SITE_ORIGIN = 'https://www.shiftmyhome.co.uk'
const META_DESCRIPTION_MAX = 160

/** Trim to a complete sentence within Google's snippet length. */
export function clampMetaDescription(text, max = META_DESCRIPTION_MAX) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) return normalized
  const slice = normalized.slice(0, max)
  const lastSpace = slice.lastIndexOf(' ')
  const trimmed = (lastSpace > 80 ? slice.slice(0, lastSpace) : slice).replace(/[.,;:\s]+$/, '')
  return `${trimmed}.`
}

/** @param {string} cityName */
export function buildLocationH1(cityName) {
  return `${cityName} Removals`
}

/**
 * @param {string} cityName
 * @param {{ titleSuffix?: string }} [opts]
 */
export function buildLocationSeoTitle(cityName, opts = {}) {
  if (opts.titleSuffix) return `${opts.titleSuffix} | ShiftMyHome`
  return `${cityName} Removals | House Removals & Man With Van | ShiftMyHome`
}

/**
 * @param {string} cityName
 * @param {{ areaPhrase: string, label: string }} region
 * @param {number} variant
 */
export function buildLocationMetaDescription(cityName, region, variant = 0) {
  const templates = [
    `Professional ${cityName} removals — house moves, man with van, and furniture delivery. Instant online quotes, insured crews, and local knowledge across ${region.areaPhrase}. ShiftMyHome.`,
    `Book house removals and man with van services in ${cityName}. Transparent pricing, experienced movers, and Scotland-wide routes. Get your ${cityName} moving quote in minutes.`,
    `ShiftMyHome ${cityName} removals for flats, family homes, and local business moves. Serving ${region.areaPhrase} with careful handling and clear communication.`,
    `Looking for a moving company in ${cityName}? We provide local and long-distance removals, furniture delivery, and same-day help when crews are available.`,
  ]
  return clampMetaDescription(templates[variant % templates.length])
}

/**
 * @param {string} path
 */
export function buildCanonicalUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${SEO_SITE_ORIGIN}${p}`
}

/**
 * @param {string} path
 * @param {string} title
 * @param {string} description
 */
export function buildOpenGraphMeta(path, title, description) {
  return {
    ogTitle: title,
    ogDescription: description,
    canonicalUrl: buildCanonicalUrl(path),
    ogType: 'website',
  }
}

/**
 * @param {string} cityName
 */
export function buildLocationKeywordPhrases(cityName) {
  return [
    `${cityName} removals`,
    `removals ${cityName}`,
    `house removals ${cityName}`,
    `man with van ${cityName}`,
    `moving company ${cityName}`,
    `furniture removals ${cityName}`,
    `flat removals ${cityName}`,
    `office removals ${cityName}`,
    `local removals ${cityName}`,
    `moving quotes ${cityName}`,
    `furniture delivery ${cityName}`,
    `same day removals ${cityName}`,
  ]
}

/**
 * @param {string} cityName
 * @param {number} variant
 */
export function buildLocationKeywordSentence(cityName, variant = 0) {
  const phrases = buildLocationKeywordPhrases(cityName)
  const picks = phrases.filter((_, i) => (i + variant) % 2 === 0).slice(0, 5)
  const templates = [
    `Customers in ${cityName} often search for ${picks.join(', ')}, and similar local moving help — ShiftMyHome quotes all of these online with clear pricing.`,
    `Whether you need ${picks.slice(0, 3).join(', ')}, or a longer UK route from ${cityName}, our quote wizard builds a price from your actual addresses and inventory.`,
  ]
  return templates[variant % templates.length]
}

/** @param {string} cityName @param {number} seed */
export function pickSeoContentVariant(cityName, seed = 0) {
  let h = seed
  for (let i = 0; i < cityName.length; i += 1) {
    h = (h + cityName.charCodeAt(i) * (i + 3)) % 997
  }
  return h
}
