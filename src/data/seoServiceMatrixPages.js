/**
 * Additional service × city SEO pages (primary Scottish cities).
 * Merged in seoPages.js — does not register routes directly.
 */

import { cityToSlug } from '../lib/citySlug.js'
import { buildNearbyLocationLinks } from '../lib/seoNearbyAreas.js'
import {
  buildBodySections,
  buildKeywordSentence,
  pickContentVariant,
  SEO_KEYWORD_PHRASES,
} from '../lib/seoPageBodyContent.js'

/** @typedef {import('./seoPages.js').SeoPageConfig} SeoPageConfig */

export const PRIMARY_SEO_CITIES = [
  'Glasgow',
  'Edinburgh',
  'Aberdeen',
  'Dundee',
  'Inverness',
  'Stirling',
  'Perth',
]

/** @type {Record<string, { key: string, label: string, areaPhrase: string, moveContext: string }>} */
const REGION_BY_CITY = {
  Glasgow: { key: 'greater-glasgow', label: 'Greater Glasgow', areaPhrase: 'Glasgow and surrounding towns', moveContext: 'tenements, flats, and family homes' },
  Edinburgh: { key: 'edinburgh-lothians', label: 'Edinburgh & the Lothians', areaPhrase: 'Edinburgh, Leith, and the Lothians', moveContext: 'city flats and suburban homes' },
  Aberdeen: { key: 'north-east', label: 'North East Scotland', areaPhrase: 'Aberdeen and Aberdeenshire', moveContext: 'granite properties and coastal flats' },
  Dundee: { key: 'tayside', label: 'Tayside', areaPhrase: 'Dundee and the Tay cities', moveContext: 'riverside flats and family moves' },
  Inverness: { key: 'highlands', label: 'The Highlands', areaPhrase: 'Inverness and the wider Highlands', moveContext: 'longer access routes and rural properties' },
  Stirling: { key: 'central', label: 'Central Scotland', areaPhrase: 'Stirling and the Forth Valley', moveContext: 'commuter moves and town centre properties' },
  Perth: { key: 'central', label: 'Central Scotland', areaPhrase: 'Perth and Perthshire', moveContext: 'market town homes and rural outskirts' },
}

const DEFAULT_REGION = {
  key: 'scotland',
  label: 'Scotland',
  areaPhrase: 'towns across Scotland',
  moveContext: 'homes and local business moves',
}

/** @param {string} cityName */
function getRegion(cityName) {
  return REGION_BY_CITY[cityName] ?? DEFAULT_REGION
}

/**
 * @param {string} path
 * @param {Set<string>} existingPaths
 */
function pathIsFree(path, existingPaths) {
  return !existingPaths.has(path)
}

/**
 * @typedef {object} MatrixServiceDef
 * @property {string} key
 * @property {string} serviceType
 * @property {string} label
 * @property {(city: string) => string} h1
 * @property {(city: string) => string} heroTeaser
 * @property {(slug: string) => string} path
 * @property {string[]} cities
 * @property {string[]} bullets
 */

/** @type {MatrixServiceDef[]} */
const MATRIX_SERVICES = [
  {
    key: 'office-removals',
    serviceType: 'Office Moves',
    label: 'office relocations',
    path: (slug) => `/office-removals-${slug}`,
    cities: ['Aberdeen', 'Dundee', 'Inverness', 'Stirling', 'Perth'],
    h1: (city) => `Office Relocations in ${city}`,
    heroTeaser: (city) => `Business moves and office relocations in ${city}.`,
    bullets: [
      'Desks, IT, filing, and meeting room furniture',
      'Out-of-hours moves where availability allows',
      'Labelled packing for faster setup at the new site',
    ],
  },
  {
    key: 'student-moves',
    serviceType: 'Student Moves',
    label: 'student moves',
    path: (slug) => `/student-moves-${slug}`,
    cities: ['Aberdeen', 'Dundee', 'Inverness', 'Stirling', 'Perth'],
    h1: (city) => `Student Moves in ${city}`,
    heroTeaser: (city) => `Term-time moves for students in ${city}.`,
    bullets: [
      'Halls, shared flats, and term storage runs',
      'Smaller vans for budget-friendly student loads',
      'Flexible timing around term dates',
    ],
  },
  {
    key: 'furniture-delivery',
    serviceType: 'Furniture Delivery',
    label: 'furniture delivery',
    path: (slug) => `/furniture-delivery-${slug}`,
    cities: ['Aberdeen', 'Dundee', 'Inverness', 'Stirling', 'Perth'],
    h1: (city) => `Furniture Delivery in ${city}`,
    heroTeaser: (city) => `Sofas, beds, and bulky furniture in ${city}.`,
    bullets: [
      'Two-person delivery with straps and blankets',
      'Assembly or disassembly where agreed',
      'Shop collections and private marketplace buys',
    ],
  },
  {
    key: 'furniture-removals',
    serviceType: 'Furniture Delivery',
    label: 'furniture removals',
    path: (slug) => `/furniture-removals-${slug}`,
    cities: ['Aberdeen', 'Dundee', 'Inverness', 'Stirling', 'Perth'],
    h1: (city) => `Furniture Removals in ${city}`,
    heroTeaser: (city) => `Careful furniture removals across ${city}.`,
    bullets: [
      'Single items through to multi-room furniture loads',
      'Wrapping and protection for sofas, beds, and tables',
      'Local collections and UK furniture routes',
    ],
  },
  {
    key: 'same-day-delivery',
    serviceType: 'Furniture Delivery',
    label: 'same day delivery',
    path: (slug) => `/same-day-delivery-${slug}`,
    cities: PRIMARY_SEO_CITIES,
    h1: (city) => `Same Day Delivery in ${city}`,
    heroTeaser: (city) => `Urgent same-day delivery when crews are available in ${city}.`,
    bullets: [
      'Marketplace collections and room-to-room moves',
      'Smaller loads often suit man-with-van crews',
      'Quote with today’s date for live availability',
    ],
  },
  {
    key: 'long-distance-removals',
    serviceType: 'House Removals',
    label: 'long distance removals',
    path: (slug) => `/long-distance-removals-${slug}`,
    cities: PRIMARY_SEO_CITIES,
    h1: (city) => `Long Distance Removals from ${city}`,
    heroTeaser: (city) => `Scotland and UK routes from ${city}.`,
    bullets: [
      'Inter-city and UK-wide house removals',
      'Volume-based pricing with clear online quotes',
      'Careful loading for longer transit times',
    ],
  },
  {
    key: 'urgent-removals',
    serviceType: 'House Removals',
    label: 'urgent removals',
    path: (slug) => `/urgent-removals-${slug}`,
    cities: PRIMARY_SEO_CITIES,
    h1: (city) => `Urgent Removals in ${city}`,
    heroTeaser: (city) => `Short-notice removals in ${city} when schedules allow.`,
    bullets: [
      'Emergency flat and house moves',
      'Honest availability — we confirm if we can help',
      'Man with van option for smaller urgent loads',
    ],
  },
]

/** @param {string} cityName @param {string} citySlug @param {MatrixServiceDef} def @param {string} path */
function buildFaqs(cityName, citySlug, def, path) {
  const region = getRegion(cityName)
  return [
    {
      q: `How much do ${def.label} cost in ${cityName}?`,
      a: `Pricing depends on volume, distance, access, and date. Use our quote wizard with your ${cityName} addresses for a live estimate.`,
    },
    {
      q: `Do you cover areas around ${cityName}?`,
      a: `Yes — we serve ${region.areaPhrase} and can quote moves to other Scottish cities or UK destinations.`,
    },
    {
      q: 'Are moves insured?',
      a: 'Goods-in-transit cover applies on booked jobs. Share fragile or high-value items in your quote.',
    },
    {
      q: `Can I book ${def.label} at short notice in ${cityName}?`,
      a: 'Availability depends on the date and crew schedules. Quote online and we confirm honestly if we can help.',
    },
    {
      q: `How do I get a quote for ${cityName}?`,
      a: 'Use the instant quote form on this page with pickup, delivery, and your inventory list.',
    },
  ]
}

/** @param {string} cityName @param {string} citySlug @param {MatrixServiceDef} def @param {string} path */
function buildRelatedLinks(cityName, citySlug, def, path) {
  /** @type {{ href: string, label: string }[]} */
  const links = []
  const add = (href, label) => {
    if (href !== path && !links.some((l) => l.href === href)) links.push({ href, label })
  }
  add(`/${citySlug}-removals`, `${cityName} removals`)
  add(`/man-with-van-${citySlug}`, `Man with van ${cityName}`)
  add(`/long-distance-removals-${citySlug}`, `Long distance ${cityName}`)
  add(`/urgent-removals-${citySlug}`, `Urgent removals ${cityName}`)
  add(`/same-day-delivery-${citySlug}`, `Same day delivery ${cityName}`)
  if (def.key !== 'office-removals') add(`/office-removals-${citySlug}`, `Office removals ${cityName}`)
  if (def.key !== 'student-moves') add(`/student-moves-${citySlug}`, `Student moves ${cityName}`)
  if (def.key !== 'furniture-delivery') add(`/furniture-delivery-${citySlug}`, `Furniture delivery ${cityName}`)
  if (def.key !== 'furniture-removals') add(`/furniture-removals-${citySlug}`, `Furniture removals ${cityName}`)
  add('/house-removals', 'House removals')
  add('/man-with-van', 'Man with van')
  add('/removals-scotland', 'Removals Scotland')
  add('/coverage', 'Coverage map')
  return links.slice(0, 10)
}

/** @param {string} cityName @param {MatrixServiceDef} def @param {ReturnType<typeof getRegion>} region @param {number} variant */
function buildIntro(cityName, def, region, variant) {
  const intros = [
    `ShiftMyHome provides professional ${def.label} in ${cityName}, with crews who understand ${region.areaPhrase}. Whether you are moving within the city or relocating further afield, we plan access, parking, and loading so your ${region.moveContext} are handled properly.`,
    `Looking for dependable ${def.label} in ${cityName}? We support jobs across ${region.label} with clear online pricing and experienced movers. Vehicle size, crew, and timing are confirmed before move day.`,
    `From ${cityName} to anywhere in Scotland or the UK, ShiftMyHome delivers structured ${def.label} with straightforward communication. We work regularly in ${region.areaPhrase} and know the practical details that matter locally.`,
  ]
  return intros[variant % intros.length]
}

/** @param {string} cityName @param {string} regionLabel @param {number} variant */
function buildIntroSecondary(cityName, regionLabel, variant) {
  const lines = [
    `Based in Glasgow, we combine Scotland-wide coverage with local knowledge of ${regionLabel}. Book online in minutes — removals from competitive rates when the scope is smaller or local.`,
    `Tell us about stairs, parking, fragile items, or a specific arrival window in your quote. Our ${cityName} crews arrive prepared rather than treating every property the same.`,
    `Need packing, extra hands, or dismantling? Add it in the quote wizard and we shape the job around your access and timing.`,
  ]
  return lines[variant % lines.length]
}

/**
 * @param {Set<string>} existingPaths paths already registered in seoPages.js
 * @returns {SeoPageConfig[]}
 */
export function buildServiceMatrixPages(existingPaths) {
  /** @type {SeoPageConfig[]} */
  const pages = []

  for (const def of MATRIX_SERVICES) {
    for (const cityName of def.cities) {
      const citySlug = cityToSlug(cityName)
      const path = def.path(citySlug)
      if (!pathIsFree(path, existingPaths)) continue

      const region = getRegion(cityName)
      const variant = pickContentVariant(cityName, def.key.length * 13)
      const h1 = def.h1(cityName)
      const title = `${h1} | ShiftMyHome`
      const metaDescription = `Book ${def.label} in ${cityName} (${region.label}). Insured crews, instant online quotes, and professional movers from ShiftMyHome — trusted UK movers.`

      const linkKind = def.key === 'man-with-van' ? 'man-with-van' : 'removals'

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
        faqs: buildFaqs(cityName, citySlug, def, path),
        relatedLinks: buildRelatedLinks(cityName, citySlug, def, path),
        nearbyLocations: buildNearbyLocationLinks(cityName, region.key, linkKind),
      })
      existingPaths.add(path)
    }
  }

  return pages
}
