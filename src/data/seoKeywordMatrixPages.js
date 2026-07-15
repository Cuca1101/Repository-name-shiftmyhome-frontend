/**
 * High-intent keyword × city SEO pages for Scotland priority towns.
 * Merged after service matrix — skips paths already registered.
 */

import { cityToSlug } from '../lib/citySlug.js'
import { buildNearbyLocationLinks } from '../lib/seoNearbyAreas.js'
import {
  buildBodySections,
  buildKeywordSentence,
  pickContentVariant,
  SEO_KEYWORD_PHRASES,
} from '../lib/seoPageBodyContent.js'
import {
  finalizeMetaDescription,
  shortenSeoTitle,
  buildIntentSeoTitle,
} from '../lib/seo/seoKeywordHelpers.js'
import { PRIORITY_SEO_CITIES, getLocationRegion } from '../lib/seo/locations.js'

/** @typedef {import('./seoPages.js').SeoPageConfig} SeoPageConfig */

/**
 * @typedef {object} KeywordMatrixDef
 * @property {string} key
 * @property {string} serviceType
 * @property {string} label
 * @property {(slug: string) => string} path
 * @property {(city: string) => string} h1
 * @property {(city: string) => string} heroTeaser
 * @property {string[]} bullets
 * @property {string[]} cities
 */

/** @type {KeywordMatrixDef[]} */
const KEYWORD_MATRIX = [
  {
    key: 'cheap-removals',
    serviceType: 'House Removals',
    label: 'cheap removals',
    path: (slug) => `/cheap-removals-${slug}`,
    cities: PRIORITY_SEO_CITIES,
    h1: (city) => `Cheap Removals in ${city}`,
    heroTeaser: (city) => `Affordable ${city} removals with clear online pricing.`,
    bullets: [
      'Transparent quotes from your real inventory',
      'House, flat and partial-load removals',
      'Local Scotland routes and UK delivery',
    ],
  },
  {
    key: 'affordable-removals',
    serviceType: 'House Removals',
    label: 'affordable removals',
    path: (slug) => `/affordable-removals-${slug}`,
    cities: PRIORITY_SEO_CITIES,
    h1: (city) => `Affordable Removals in ${city}`,
    heroTeaser: (city) => `Fair-priced house and flat removals in ${city}.`,
    bullets: [
      'Online price before you book',
      'Insured crews for homes and flats',
      'Man and van options for smaller loads',
    ],
  },
  {
    key: 'flat-removals',
    serviceType: 'House Removals',
    label: 'flat removals',
    path: (slug) => `/flat-removals-${slug}`,
    cities: PRIORITY_SEO_CITIES,
    h1: (city) => `Flat Removals in ${city}`,
    heroTeaser: (city) => `Flat and apartment moves across ${city}.`,
    bullets: [
      'Stairs, lifts and tight access planning',
      'Studio to multi-bed flat moves',
      'Packing help available in your quote',
    ],
  },
  {
    key: 'house-movers',
    serviceType: 'House Removals',
    label: 'house movers',
    path: (slug) => `/house-movers-${slug}`,
    cities: PRIORITY_SEO_CITIES,
    h1: (city) => `House Movers in ${city}`,
    heroTeaser: (city) => `Local house movers for ${city} and Scotland routes.`,
    bullets: [
      'Full and partial house moves',
      'Careful loading and furniture protection',
      'Clear pricing from addresses and inventory',
    ],
  },
  {
    key: 'moving-company',
    serviceType: 'House Removals',
    label: 'moving company',
    path: (slug) => `/moving-company-${slug}`,
    cities: PRIORITY_SEO_CITIES,
    h1: (city) => `Moving Company in ${city}`,
    heroTeaser: (city) => `A local moving company for ${city} homes and flats.`,
    bullets: [
      'House removals, man and van and furniture delivery',
      'Scotland-wide and UK routes',
      'Instant online quotes',
    ],
  },
  {
    key: 'local-removers',
    serviceType: 'House Removals',
    label: 'local removers',
    path: (slug) => `/local-removers-${slug}`,
    cities: PRIORITY_SEO_CITIES,
    h1: (city) => `Local Removers in ${city}`,
    heroTeaser: (city) => `Local removers who know ${city} access and parking.`,
    bullets: [
      'Local knowledge of streets and access',
      'House moves and man and van hire',
      'Insured transport on booked jobs',
    ],
  },
  {
    key: 'small-removals',
    serviceType: 'House Removals',
    label: 'small removals',
    path: (slug) => `/small-removals-${slug}`,
    cities: PRIORITY_SEO_CITIES,
    h1: (city) => `Small Removals in ${city}`,
    heroTeaser: (city) => `Small removals and part-loads in ${city}.`,
    bullets: [
      'Ideal for single rooms and partial moves',
      'Man and van sized crews when suitable',
      'Pay for the job you list, not a full-house rate',
    ],
  },
  {
    key: 'same-day-removals',
    serviceType: 'House Removals',
    label: 'same day removals',
    path: (slug) => `/same-day-removals-${slug}`,
    cities: PRIORITY_SEO_CITIES,
    h1: (city) => `Same Day Removals in ${city}`,
    heroTeaser: (city) => `Same day removals in ${city} when crews are available.`,
    bullets: [
      'Quote with today’s date for live availability',
      'Urgent flat and house moves',
      'Honest confirmation if we can help',
    ],
  },
  {
    key: 'sofa-delivery',
    serviceType: 'Furniture Delivery',
    label: 'sofa delivery',
    path: (slug) => `/sofa-delivery-${slug}`,
    cities: PRIORITY_SEO_CITIES,
    h1: (city) => `Sofa Delivery in ${city}`,
    heroTeaser: (city) => `Two-person sofa delivery across ${city}.`,
    bullets: [
      'Shop and private seller collections',
      'Stairs and tight access handling',
      'Sofas, corner units and bulky seating',
    ],
  },
  {
    key: 'furniture-movers',
    serviceType: 'Furniture Delivery',
    label: 'furniture movers',
    path: (slug) => `/furniture-movers-${slug}`,
    cities: PRIORITY_SEO_CITIES,
    h1: (city) => `Furniture Movers in ${city}`,
    heroTeaser: (city) => `Furniture movers for sofas, beds and bulky items in ${city}.`,
    bullets: [
      'Single items through to multi-room loads',
      'Blankets, straps and two-person teams',
      'Marketplace and retailer collections',
    ],
  },
  {
    key: 'cheap-man-with-van',
    serviceType: 'Man with Van',
    label: 'cheap man with van',
    path: (slug) => `/cheap-man-with-van-${slug}`,
    cities: PRIORITY_SEO_CITIES,
    h1: (city) => `Cheap Man and Van in ${city}`,
    heroTeaser: (city) => `Affordable man and van hire in ${city}.`,
    bullets: [
      'Small moves and single-item deliveries',
      'Clear online pricing',
      'Local Scotland and short UK runs',
    ],
  },
  {
    key: 'local-man-with-van',
    serviceType: 'Man with Van',
    label: 'local man with van',
    path: (slug) => `/local-man-with-van-${slug}`,
    cities: PRIORITY_SEO_CITIES,
    h1: (city) => `Local Man and Van in ${city}`,
    heroTeaser: (city) => `Local man and van near you in ${city}.`,
    bullets: [
      'Nearby crews for local delivery',
      'Flat moves and furniture collections',
      'Same day when schedules allow',
    ],
  },
  {
    key: 'emergency-man-with-van',
    serviceType: 'Man with Van',
    label: 'emergency man with van',
    path: (slug) => `/emergency-man-with-van-${slug}`,
    cities: PRIORITY_SEO_CITIES,
    h1: (city) => `Emergency Man and Van in ${city}`,
    heroTeaser: (city) => `Short-notice man and van help in ${city}.`,
    bullets: [
      'Urgent collections and deliveries',
      'We confirm honestly if we can attend',
      'Quote online with your preferred time',
    ],
  },
  {
    key: 'ikea-delivery',
    serviceType: 'Furniture Delivery',
    label: 'IKEA delivery',
    path: (slug) => `/ikea-delivery-${slug}`,
    cities: PRIORITY_SEO_CITIES,
    h1: (city) => `IKEA Delivery in ${city}`,
    heroTeaser: (city) => `Independent IKEA collection and delivery in ${city}.`,
    bullets: [
      'Not an official IKEA partner — independent movers',
      'Flat-pack and bulky IKEA items',
      'Two-person delivery where needed',
    ],
  },
]

/** @param {string} cityName */
function getRegion(cityName) {
  return getLocationRegion(cityName)
}

/**
 * @param {string} path
 * @param {Set<string>} existingPaths
 */
function pathIsFree(path, existingPaths) {
  return !existingPaths.has(path)
}

/** @param {string} cityName @param {KeywordMatrixDef} def */
function buildFaqs(cityName, def) {
  const region = getRegion(cityName)
  return [
    {
      q: `How much do ${def.label} cost in ${cityName}?`,
      a: `Price depends on volume, distance, access and date. Use the quote wizard with your ${cityName} addresses for a live Scotland estimate.`,
    },
    {
      q: `Do you cover areas around ${cityName}?`,
      a: `Yes — we serve ${region.areaPhrase} and quote moves across Scotland and the UK.`,
    },
    {
      q: 'Are jobs insured?',
      a: 'Goods-in-transit cover applies on booked jobs. List fragile or high-value items in your quote.',
    },
    {
      q: `Can I get ${def.label} at short notice in ${cityName}?`,
      a: 'Quote with your preferred date — we confirm honestly if a crew is available.',
    },
  ]
}

/** @param {string} cityName @param {string} citySlug @param {KeywordMatrixDef} def @param {string} path */
function buildRelatedLinks(cityName, citySlug, def, path) {
  /** @type {{ href: string, label: string }[]} */
  const links = []
  const add = (href, label) => {
    if (href !== path && !links.some((l) => l.href === href)) links.push({ href, label })
  }
  add(`/${citySlug}-removals`, `${cityName} removals`)
  add(`/man-with-van-${citySlug}`, `Man and van ${cityName}`)
  add(`/cheap-removals-${citySlug}`, `Cheap removals ${cityName}`)
  add(`/flat-removals-${citySlug}`, `Flat removals ${cityName}`)
  add(`/sofa-delivery-${citySlug}`, `Sofa delivery ${cityName}`)
  add(`/furniture-delivery-${citySlug}`, `Furniture delivery ${cityName}`)
  add(`/same-day-removals-${citySlug}`, `Same day removals ${cityName}`)
  add('/house-removals', 'House removals Scotland')
  add('/man-with-van', 'Man and van Scotland')
  add('/removals-scotland', 'Removals Scotland')
  add('/coverage', 'Coverage map')
  return links.slice(0, 10)
}

/** @param {string} cityName @param {KeywordMatrixDef} def @param {ReturnType<typeof getRegion>} region @param {number} variant */
function buildIntro(cityName, def, region, variant) {
  const ikeaNote =
    def.key === 'ikea-delivery'
      ? ' We are an independent removal company — not affiliated with or authorised by IKEA.'
      : ''
  const intros = [
    `Looking for ${def.label} in ${cityName}? Local Scotland movers covering ${region.areaPhrase} with clear online pricing for house moves, man and van and furniture delivery.${ikeaNote}`,
    `Book ${def.label} in ${cityName} online. We plan access, parking and loading for ${region.moveContext} across ${region.label} and wider Scotland routes.${ikeaNote}`,
    `${cityName} ${def.label} from a Glasgow-based Scotland removal company. Quote from your real addresses and inventory — no vague phone estimates.${ikeaNote}`,
  ]
  return intros[variant % intros.length]
}

/** @param {string} cityName @param {string} regionLabel @param {number} variant */
function buildIntroSecondary(cityName, regionLabel, variant) {
  const lines = [
    `We combine Scotland-wide coverage with local knowledge of ${regionLabel}. Tell us about stairs, parking or fragile items so your ${cityName} crew arrives prepared.`,
    `Compare a transparent online price for ${cityName} — house removals, man and van or furniture delivery sized to what you list.`,
    `Same day help depends on crew availability. Quote with your preferred date across ${regionLabel} and we confirm honestly.`,
  ]
  return lines[variant % lines.length]
}

/**
 * @param {Set<string>} existingPaths
 * @returns {SeoPageConfig[]}
 */
export function buildKeywordMatrixPages(existingPaths) {
  /** @type {SeoPageConfig[]} */
  const pages = []

  for (const def of KEYWORD_MATRIX) {
    for (const cityName of def.cities) {
      const citySlug = cityToSlug(cityName)
      const path = def.path(citySlug)
      if (!pathIsFree(path, existingPaths)) continue

      const region = getRegion(cityName)
      const variant = pickContentVariant(cityName, def.key.length * 17)
      const h1 = def.h1(cityName)
      const title = shortenSeoTitle(buildIntentSeoTitle(h1, def.serviceType, variant))
      const area = String(region.label || '').length <= 32 ? region.label : cityName
      const metaDescription = finalizeMetaDescription(
        `${h1} — local Scotland movers for ${area}. ${def.label}, house removals and man and van. Instant online quote.`,
      )
      const linkKind = def.serviceType === 'Man with Van' ? 'man-with-van' : 'removals'

      pages.push({
        path,
        slug: path.slice(1),
        kind: 'intent',
        cityName,
        citySlug,
        regionKey: region.key,
        regionLabel: region.label,
        title,
        metaDescription,
        h1,
        intro: buildIntro(cityName, def, region, variant),
        introSecondary: buildIntroSecondary(cityName, region.label, variant + 1),
        serviceType: def.serviceType,
        heroTeaser: def.heroTeaser(cityName),
        serviceBullets: def.bullets,
        bodySections: buildBodySections(def.label, cityName, region, variant),
        keywordPhrases: SEO_KEYWORD_PHRASES,
        keywordSentence: buildKeywordSentence(cityName, def.label),
        faqs: buildFaqs(cityName, def),
        relatedLinks: buildRelatedLinks(cityName, citySlug, def, path),
        nearbyLocations: buildNearbyLocationLinks(cityName, region.key, linkKind),
      })
      existingPaths.add(path)
    }
  }

  return pages
}
