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
 * Generic city-keyword title variants (primary: "<City> removals", secondary phrases rotated).
 * @param {string} cityName
 * @param {number} [variant]
 */
export function buildLocationSeoTitle(cityName, variant = 0) {
  const titles = [
    `${cityName} Removals | House Removals & Man With Van | ShiftMyHome`,
    `${cityName} Removal Company | Local Movers | ShiftMyHome`,
    `House Removals ${cityName} | Man With Van | ShiftMyHome`,
    `Removal Company ${cityName} | Instant Online Quote | ShiftMyHome`,
    `${cityName} Removals & Man With Van | Local Movers | ShiftMyHome`,
    `Local Movers ${cityName} | Furniture Delivery | ShiftMyHome`,
    `${cityName} Removals | Furniture Delivery & Van | ShiftMyHome`,
    `Moving Company ${cityName} | House Removals | ShiftMyHome`,
  ]
  return titles[variant % titles.length]
}

/**
 * @param {string} cityName
 * @param {{ areaPhrase: string, label: string, moveContext?: string }} region
 * @param {number} variant
 */
export function buildLocationMetaDescription(cityName, region, variant = 0) {
  const templates = [
    `${cityName} removals — house removals, removal company quotes, man with van and furniture delivery in ${region.areaPhrase}. Instant online pricing.`,
    `Removal company ${cityName} for flats and family homes. Local movers, house removals, man with van ${cityName}, and UK routes. Get a quote in minutes.`,
    `House removals ${cityName} with insured crews. Local movers covering ${region.label} — furniture delivery, man with van, and same-day help when available.`,
    `Man with van ${cityName} and full house removals. Removal company services, furniture delivery, and local movers across ${region.areaPhrase}.`,
    `Local movers in ${cityName} — ${cityName} removals for homes and businesses. House removals, removal company pricing online, serving ${region.areaPhrase}.`,
    `Furniture delivery ${cityName} plus house removals and man with van. Trusted local movers and removal company quotes for ${region.label}.`,
    `Book ${cityName} removals online — removal company, house removals, man with van ${cityName}, and furniture delivery with clear insured pricing.`,
    `Moving company ${cityName}: local removals, house moves, and man with van. Serving ${region.areaPhrase} with professional local movers.`,
    `${cityName} removal company for local and long-distance moves. House removals, furniture delivery, and man with van — quote with your postcodes.`,
    `Affordable ${cityName} removals — local movers for ${region.moveContext || 'homes and flats'}. House removals, man with van, and furniture delivery.`,
    `Need removals in ${cityName}? House removals, removal company crews, man with van ${cityName}, and furniture delivery across ${region.label}.`,
    `Professional local movers ${cityName}. ${cityName} removals, house removals, removal company service, and furniture delivery — instant quote.`,
  ]
  return clampMetaDescription(templates[variant % templates.length])
}

/**
 * @param {string} cityName
 * @param {{ areaPhrase: string }} region
 * @param {number} variant
 */
export function buildLocationHeroTeaser(cityName, region, variant = 0) {
  const teasers = [
    `${cityName} removals — house removals, man with van, and furniture delivery across ${region.areaPhrase}.`,
    `Removal company ${cityName} with local movers for house moves, flats, and furniture delivery.`,
    `House removals and man with van ${cityName} — instant quotes from a trusted local removal company.`,
    `Local movers ${cityName}: removals, furniture delivery, and Scotland-wide routes from ${region.areaPhrase}.`,
    `${cityName} removal company — professional house removals, van loads, and careful furniture delivery.`,
    `Moving company ${cityName} — local removals, house moves, and man with van when you need flexible help.`,
  ]
  return teasers[variant % teasers.length]
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
    `removal company ${cityName}`,
    `house removals ${cityName}`,
    `man with van ${cityName}`,
    `local movers ${cityName}`,
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
