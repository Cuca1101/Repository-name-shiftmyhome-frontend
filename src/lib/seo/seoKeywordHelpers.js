/**
 * SEO keyword and metadata helpers for Scotland location pages.
 */

import { buildPublicPageUrl } from '../normalizePublicPath.js'

const SEO_SITE_ORIGIN = 'https://www.shiftmyhome.co.uk'
const META_DESCRIPTION_MAX = 160
const META_DESCRIPTION_MIN = 120
const SEO_TITLE_MAX = 60
/** Legacy brand suffix stripped from SEO landing titles only (via stripSeoTitleBrand). */
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
 * Remove trailing `| ShiftMyHome` from SEO landing page titles.
 * @param {string} title
 */
export function stripSeoTitleBrand(title) {
  const t = String(title || '').replace(/\s+/g, ' ').trim()
  if (t.endsWith(BRAND_SUFFIX)) return t.slice(0, -BRAND_SUFFIX.length).trim()
  return t
}

/**
 * @param {string} title
 * @param {number} [max]
 */
export function shortenSeoTitle(title, max = SEO_TITLE_MAX) {
  const t = String(title || '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return t.slice(0, max).replace(/[|\s-]+$/, '').trim()
}

/** @param {string} cityName */
export function buildLocationH1(cityName) {
  return `${cityName} Removals`
}

/**
 * Rotating query-led H1 for city removals pages (matches search + title language).
 * @param {string} cityName
 * @param {number} [variant]
 */
export function buildLocationSeoH1(cityName, variant = 0) {
  const options = [
    `${cityName} Removals`,
    `House Removals in ${cityName}`,
    `${cityName} House Removals`,
    `Local Removals in ${cityName}`,
  ]
  return options[variant % options.length]
}

/**
 * Pick a template that fits max length; fall back to shorter options.
 * @param {string[]} templates
 * @param {number} variant
 * @param {number} [max]
 */
function pickFittingTitle(templates, variant, max = SEO_TITLE_MAX) {
  if (!templates.length) return ''
  const start = ((variant % templates.length) + templates.length) % templates.length
  for (let i = 0; i < templates.length; i++) {
    const t = templates[(start + i) % templates.length]
    if (t.length <= max) return t
  }
  return shortenSeoTitle(templates[start], max)
}

/**
 * Query-first titles Google can match to searches like "{city} removals", "house removals {city}".
 * Front half = main query; after | = related searchable phrases (not marketing fluff).
 * @param {string} cityName
 * @param {number} [variant]
 */
export function buildLocationSeoTitle(cityName, variant = 0) {
  return pickFittingTitle(
    [
      `${cityName} Removals | House Movers Scotland`,
      `House Removals ${cityName} | Local Movers`,
      `${cityName} House Removals | Man and Van`,
      `Removals ${cityName} | Flat & House Movers`,
      `${cityName} Moving Company | Scotland Removals`,
      `House Movers ${cityName} | Removals Near Me`,
      `Local Removals ${cityName} | Man with Van`,
      `${cityName} Removals | Cheap Local Movers`,
    ],
    variant,
  )
}

/**
 * Query-first titles for service × city pages (match how people search in Google).
 * @param {string} kind
 * @param {string} cityName
 * @param {number} [variant]
 */
export function buildServiceCitySeoTitle(kind, cityName, variant = 0) {
  switch (kind) {
    case 'man-with-van':
      return pickFittingTitle(
        [
          `Man and Van ${cityName} | Local Hire Near Me`,
          `Man with Van ${cityName} | Cheap Local Delivery`,
          `Man and Van Hire ${cityName} | Same Day`,
          `${cityName} Man and Van | Scotland Movers`,
          `Man And Van in ${cityName} | Local Delivery`,
          `Local Man and Van ${cityName} | Hire Near Me`,
        ],
        variant,
      )
    case 'office-removals':
      return pickFittingTitle(
        [
          `Office Removals ${cityName} | Business Movers`,
          `Office Movers ${cityName} | Business Relocation`,
          `Business Relocation ${cityName} | Office Removals`,
          `${cityName} Office Moves | Scotland Removals`,
        ],
        variant,
      )
    case 'student-moves':
      return pickFittingTitle(
        [
          `Student Moves ${cityName} | Cheap Man and Van`,
          `Student Removals ${cityName} | Affordable Movers`,
          `${cityName} Student Movers | Halls & Flat Moves`,
          `Student Man and Van ${cityName} | Local Hire`,
        ],
        variant,
      )
    case 'furniture-delivery':
      return pickFittingTitle(
        [
          `Furniture Delivery ${cityName} | Sofa Delivery`,
          `Sofa Delivery ${cityName} | Furniture Movers`,
          `${cityName} Furniture Delivery | Man and Van`,
          `Furniture Collection ${cityName} | Local Delivery`,
        ],
        variant,
      )
    case 'furniture-removals':
      return pickFittingTitle(
        [
          `Furniture Removals ${cityName} | Sofa Movers`,
          `${cityName} Furniture Movers | Single Item Removals`,
          `Furniture Moving ${cityName} | Man and Van`,
          `Single Item Removals ${cityName} | Furniture Delivery`,
        ],
        variant,
      )
    case 'same-day-delivery':
      return pickFittingTitle(
        [
          `Same Day Delivery ${cityName} | Man and Van`,
          `${cityName} Same Day Delivery | Local Movers`,
          `Same Day Furniture Delivery ${cityName}`,
          `Urgent Delivery ${cityName} | Same Day Man and Van`,
        ],
        variant,
      )
    case 'long-distance-removals':
      return pickFittingTitle(
        [
          `Long Distance Removals ${cityName} | UK & Scotland`,
          `${cityName} Long Distance Removals | House Movers`,
          `Long Distance Movers ${cityName} | UK Removals`,
          `UK Removals from ${cityName} | Long Distance`,
        ],
        variant,
      )
    case 'urgent-removals':
      return pickFittingTitle(
        [
          `Urgent Removals ${cityName} | Same Day Movers`,
          `Last Minute Removals ${cityName} | Man and Van`,
          `${cityName} Emergency Removals | Same Day`,
          `Short Notice Removals ${cityName} | Local Movers`,
        ],
        variant,
      )
    default:
      return buildLocationSeoTitle(cityName, variant)
  }
}

/**
 * Intent pages: H1 is already the search query — keep it primary; add a short related query.
 * @param {string} h1
 * @param {string} serviceType
 * @param {number} [variant]
 */
export function buildIntentSeoTitle(h1, serviceType, variant = 0) {
  const type = String(serviceType || '').toLowerCase()
  const core = String(h1 || '').replace(/\s+/g, ' ').trim()

  /** @type {string[]} */
  let tails = ['Local Movers', 'House Removals', 'Man with Van', 'Near Me']
  if (type.includes('man with van') || type.includes('man and van')) {
    tails = ['Local Hire Near Me', 'Same Day Delivery', 'Local Movers', 'Van Hire']
  } else if (type.includes('furniture')) {
    tails = ['Sofa Delivery', 'Two Man Delivery', 'Local Collection', 'Item Delivery']
  } else if (type.includes('office') || type.includes('business')) {
    tails = ['Office Movers', 'Business Relocation', 'Local Removals', 'Office Moves']
  } else if (type.includes('student')) {
    tails = ['Cheap Man and Van', 'Affordable Movers', 'Halls & Flat Moves', 'Student Removals']
  } else if (type.includes('clearance')) {
    tails = ['House Clearance', 'Local Clearance', 'Same Day Help', 'Rubbish Clearance']
  }

  // Prefer exact query alone when already long; otherwise query + related term.
  const templates = [
    core,
    ...tails.map((t) => `${core} | ${t}`),
  ]
  return pickFittingTitle(templates, variant)
}

/**
 * Fallback slug metadata: primary search query first.
 * @param {string} service
 * @param {string} location
 * @param {number} [variant]
 */
export function buildSlugFallbackSeoTitle(service, location, variant = 0) {
  if (location === 'Scotland') {
    return pickFittingTitle(
      [
        `${service} Scotland | Local Movers`,
        `Scotland ${service} | House Removals`,
        `${service} in Scotland | Man with Van`,
        `${service} Scotland | Near Me`,
      ],
      variant,
    )
  }
  const kindMap = {
    'House Removals': 'removals',
    'Man and Van': 'man-with-van',
    'Student Moves': 'student-moves',
    'Furniture Delivery': 'furniture-delivery',
    'Same Day Removals': 'urgent-removals',
    Clearance: 'removals',
    Removals: 'removals',
  }
  return buildServiceCitySeoTitle(kindMap[service] || 'removals', location, variant)
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
    `${cityName} removals — house removals, man and van and furniture delivery across ${area}, Scotland. Instant online quote from local movers.`,
    `Book house removals ${cityName} with local movers. Man with van, flat removals and furniture delivery in ${area}. Clear Scotland pricing. Quote online.`,
    `Looking for ${cityName} removals or a removal company near you? House movers, man and van hire and sofa delivery across ${area}. Get a quote today.`,
    `Local movers ${cityName} for house removals, man and van and furniture moving in ${area}. Scotland-wide and UK routes. Instant online quote.`,
    `House removals ${cityName} — flat moves, cheap partial loads and man with van across ${area}. Insured Scotland crews. Get your quote today.`,
    `${cityName} house movers and removal company for homes and flats. Removals, furniture delivery and man and van in ${area}. Quote online today.`,
    `Cheap local removals ${cityName}? Compare a transparent price for house moves, man and van and furniture delivery in ${area}, Scotland.`,
    `Moving company ${cityName} — ${cityName} removals, house movers and man with van across ${area} and Scotland. Book online today.`,
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
    `${cityName} removals — house movers, man and van and furniture delivery across ${region.areaPhrase}, Scotland.`,
    `Removal company ${cityName}: local house removals, flat moves and man with van hire.`,
    `House removals and man and van ${cityName} — instant quotes from Scotland local movers.`,
    `Local movers ${cityName} for removals, sofa delivery and Scotland-wide routes from ${region.areaPhrase}.`,
    `${cityName} removal company — house removals, cheap man and van loads and furniture delivery.`,
    `Moving company ${cityName} — local removals, house movers and same day man and van when available.`,
  ]
  return teasers[variant % teasers.length]
}

/**
 * Canonical URL (trailing slash on directory routes — matches live 200 response).
 * @param {string} path
 */
export function buildCanonicalUrl(path) {
  return buildPublicPageUrl(SEO_SITE_ORIGIN, path)
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
    `house removals ${cityName}`,
    `man and van ${cityName}`,
    `man with van ${cityName}`,
    `local movers ${cityName}`,
    `removal company ${cityName}`,
    `moving company ${cityName}`,
    `furniture delivery ${cityName}`,
    `furniture removals ${cityName}`,
    `flat removals ${cityName}`,
    `sofa delivery ${cityName}`,
    `cheap removals ${cityName}`,
    `same day removals ${cityName}`,
    `office removals ${cityName}`,
    `student moves ${cityName}`,
    `Scotland removals`,
    `local removals Scotland`,
  ]
}

/**
 * @param {string} cityName
 * @param {number} variant
 */
export function buildLocationKeywordSentence(cityName, variant = 0) {
  const phrases = buildLocationKeywordPhrases(cityName)
  const picks = phrases.filter((_, i) => (i + variant) % 2 === 0).slice(0, 6)
  const templates = [
    `People searching Scotland for ${picks.join(', ')}, and similar local moving help get one clear online quote covering house removals, man and van and furniture delivery.`,
    `Whether you need ${picks.slice(0, 4).join(', ')}, or a longer Scotland or UK route from ${cityName}, price from your real addresses and inventory online.`,
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
