/**
 * SEO keyword and metadata helpers for Scotland location pages.
 */

const SEO_SITE_ORIGIN = 'https://www.shiftmyhome.co.uk'
const META_DESCRIPTION_MAX = 160
const META_DESCRIPTION_MIN = 120
const SEO_TITLE_MAX = 60
const BRAND_SUFFIX = ' | ShiftMyHome'

/** Trim to a complete sentence within Google's snippet length. */
export function clampMetaDescription(text, max = META_DESCRIPTION_MAX) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) return normalized
  const slice = normalized.slice(0, max)
  const lastSpace = slice.lastIndexOf(' ')
  const trimmed = (lastSpace > 80 ? slice.slice(0, lastSpace) : slice).replace(/[.,;:\s]+$/, '')
  return `${trimmed}.`
}

/**
 * Enforce 120–160 char meta descriptions with CTA when too short.
 * @param {string} text
 */
export function finalizeMetaDescription(text) {
  let d = String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/ & /g, ' and ')
    .trim()
  d = clampMetaDescription(d, META_DESCRIPTION_MAX)
  if (d.length < META_DESCRIPTION_MIN) {
    d = clampMetaDescription(`${d} Get a quote today.`, META_DESCRIPTION_MAX)
  }
  if (d.length < META_DESCRIPTION_MIN) {
    d = clampMetaDescription(`${d} Book online with ShiftMyHome.`, META_DESCRIPTION_MAX)
  }
  if (d.length > META_DESCRIPTION_MAX) {
    d = clampMetaDescription(d, META_DESCRIPTION_MAX)
  }
  return d
}

/**
 * @param {string} title
 * @param {number} [max]
 */
export function shortenSeoTitle(title, max = SEO_TITLE_MAX) {
  const t = String(title || '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  if (t.endsWith(BRAND_SUFFIX)) {
    const core = t.slice(0, -BRAND_SUFFIX.length).trim()
    const room = max - BRAND_SUFFIX.length
    if (room > 12) return `${core.slice(0, room).replace(/[|\s-]+$/, '').trim()}${BRAND_SUFFIX}`
  }
  return t.slice(0, max).replace(/[|\s-]+$/, '').trim()
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
  const short = `${cityName} Removals${BRAND_SUFFIX}`
  const long = `${cityName} Removals & Man With Van${BRAND_SUFFIX}`
  const useLong = variant % 2 === 1 && long.length <= SEO_TITLE_MAX
  return shortenSeoTitle(useLong ? long : short)
}

/**
 * @param {string} cityName
 * @param {{ areaPhrase: string, label: string, moveContext?: string }} region
 * @param {number} variant
 */
export function buildLocationMetaDescription(cityName, region, variant = 0) {
  const area =
    String(region.label || '').length <= 32 ? region.label : cityName
  const templates = [
    `Book trusted ${cityName} removals with ShiftMyHome. House moves, furniture delivery and man with van across ${area}. Get a quote today.`,
    `${cityName} removals from a local removal company — house moves, man with van and furniture delivery in ${area}. Insured crews. Quote online.`,
    `Need ${cityName} removals? ShiftMyHome offers house removals, local movers and man with van in ${area}. Clear pricing. Get your quote today.`,
    `Professional ${cityName} removals — house moves, furniture delivery and removal company crews serving ${area}. Book your move online today.`,
    `House removals ${cityName} with ShiftMyHome. Local movers, man with van and furniture delivery across ${area}. Instant online quote today.`,
    `Trusted ${cityName} removal company for homes and flats. House removals, man with van ${cityName} and furniture delivery. Get a quote today.`,
    `Local movers ${cityName} — ${cityName} removals, house moves and furniture delivery across ${area}. ShiftMyHome. Get your quote today.`,
    `Moving company ${cityName} for local and UK routes. House removals, man with van and furniture delivery in ${area}. Quote online today.`,
  ]
  return finalizeMetaDescription(templates[variant % templates.length])
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
