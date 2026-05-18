import scotlandCities from './scotlandCities.json' with { type: 'json' }
import { cityToSlug } from '../lib/citySlug.js'
import { INTENT_PAGE_DEFINITIONS } from './seoIntentPages.js'

export const SEO_SITE_ORIGIN = 'https://www.shiftmyhome.co.uk'

/** @typedef {'removals' | 'man-with-van' | 'office-removals' | 'student-moves' | 'furniture-delivery' | 'intent'} SeoPageKind */

/**
 * @typedef {object} SeoFaqItem
 * @property {string} q
 * @property {string} a
 */

/**
 * @typedef {object} SeoRelatedLink
 * @property {string} href
 * @property {string} label
 */

/**
 * @typedef {object} SeoPageConfig
 * @property {string} path
 * @property {string} slug
 * @property {SeoPageKind} kind
 * @property {string} cityName
 * @property {string} citySlug
 * @property {string} regionKey
 * @property {string} regionLabel
 * @property {string} title
 * @property {string} metaDescription
 * @property {string} h1
 * @property {string} intro
 * @property {string} introSecondary
 * @property {string} serviceType
 * @property {string} heroTeaser
 * @property {string[]} serviceBullets
 * @property {SeoFaqItem[]} faqs
 * @property {SeoRelatedLink[]} relatedLinks
 */

const MAN_WITH_VAN_CITIES = [
  'Glasgow',
  'Edinburgh',
  'Aberdeen',
  'Dundee',
  'Inverness',
  'Stirling',
  'Perth',
  'Paisley',
  'Falkirk',
  'Livingston',
]

const SERVICE_CITY_ROUTES = [
  { kind: 'office-removals', cities: ['Glasgow', 'Edinburgh'], serviceType: 'Office Moves', label: 'Office removals' },
  { kind: 'student-moves', cities: ['Glasgow', 'Edinburgh'], serviceType: 'Student Moves', label: 'Student moves' },
  { kind: 'furniture-delivery', cities: ['Glasgow', 'Edinburgh'], serviceType: 'Furniture Delivery', label: 'Furniture delivery' },
]

/** @type {Record<string, { key: string, label: string, areaPhrase: string, moveContext: string }>} */
const REGION_BY_CITY = {
  Glasgow: { key: 'greater-glasgow', label: 'Greater Glasgow', areaPhrase: 'Glasgow and the surrounding towns', moveContext: 'tenements, flats, and family homes' },
  Edinburgh: { key: 'edinburgh-lothians', label: 'Edinburgh & the Lothians', areaPhrase: 'Edinburgh, Leith, and the Lothians', moveContext: 'city flats, New Town properties, and suburban family homes' },
  Aberdeen: { key: 'north-east', label: 'North East Scotland', areaPhrase: 'Aberdeen and Aberdeenshire', moveContext: 'granite properties, coastal flats, and rural relocations' },
  Dundee: { key: 'tayside', label: 'Tayside', areaPhrase: 'Dundee and the Tay cities', moveContext: 'riverside flats, student lets, and family moves' },
  Inverness: { key: 'highlands', label: 'The Highlands', areaPhrase: 'Inverness and the wider Highlands', moveContext: 'longer access routes, rural properties, and careful scheduling' },
  Stirling: { key: 'central', label: 'Central Scotland', areaPhrase: 'Stirling and the Forth Valley', moveContext: 'commuter moves and historic town centre properties' },
  Perth: { key: 'central', label: 'Central Scotland', areaPhrase: 'Perth and Perthshire', moveContext: 'market town homes and rural outskirts' },
  Paisley: { key: 'greater-glasgow', label: 'Greater Glasgow', areaPhrase: 'Paisley and Renfrewshire', moveContext: 'Renfrewshire flats and family homes' },
  Greenock: { key: 'inverclyde', label: 'Inverclyde', areaPhrase: 'Greenock and the Clyde coast', moveContext: 'coastal flats and hillside streets' },
  Motherwell: { key: 'lanarkshire', label: 'Lanarkshire', areaPhrase: 'Motherwell and North Lanarkshire', moveContext: 'terraced homes and new-build estates' },
  Falkirk: { key: 'central', label: 'Central Scotland', areaPhrase: 'Falkirk and the Forth Valley', moveContext: 'commuter moves between Edinburgh and Glasgow' },
  Ayr: { key: 'ayrshire', label: 'Ayrshire', areaPhrase: 'Ayr and the Ayrshire coast', moveContext: 'seaside properties and town centre flats' },
  Kilmarnock: { key: 'ayrshire', label: 'Ayrshire', areaPhrase: 'Kilmarnock and East Ayrshire', moveContext: 'family homes and bungalow moves' },
  Hamilton: { key: 'lanarkshire', label: 'Lanarkshire', areaPhrase: 'Hamilton and South Lanarkshire', moveContext: 'estate moves and local downsizing' },
  'East Kilbride': { key: 'lanarkshire', label: 'Lanarkshire', areaPhrase: 'East Kilbride and South Lanarkshire', moveContext: 'new-build homes and multi-level properties' },
  Cumbernauld: { key: 'lanarkshire', label: 'Lanarkshire', areaPhrase: 'Cumbernauld and North Lanarkshire', moveContext: 'planned-town flats and family housing' },
  Livingston: { key: 'lothians', label: 'West Lothian', areaPhrase: 'Livingston and West Lothian', moveContext: 'new-town housing and business-park relocations' },
  Dunfermline: { key: 'fife', label: 'Fife', areaPhrase: 'Dunfermline and West Fife', moveContext: 'historic town homes and modern estates' },
  Kirkcaldy: { key: 'fife', label: 'Fife', areaPhrase: 'Kirkcaldy and the Fife coast', moveContext: 'coastal flats and family moves' },
  Glenrothes: { key: 'fife', label: 'Fife', areaPhrase: 'Glenrothes and central Fife', moveContext: 'planned-town properties and local relocations' },
  Dumfries: { key: 'south', label: 'South Scotland', areaPhrase: 'Dumfries and Galloway', moveContext: 'market-town homes and longer rural legs' },
  Oban: { key: 'argyll', label: 'Argyll', areaPhrase: 'Oban and the west coast', moveContext: 'ferry-linked routes and narrow access' },
  'Fort William': { key: 'highlands', label: 'The Highlands', areaPhrase: 'Fort William and Lochaber', moveContext: 'Highland routes and seasonal demand' },
  Aviemore: { key: 'highlands', label: 'The Highlands', areaPhrase: 'Aviemore and the Cairngorms', moveContext: 'holiday lets and chalet-style properties' },
  Wick: { key: 'highlands', label: 'The Highlands', areaPhrase: 'Wick and Caithness', moveContext: 'long-distance Scottish routes' },
  Thurso: { key: 'highlands', label: 'The Highlands', areaPhrase: 'Thurso and the far north', moveContext: 'remote access and careful route planning' },
  Kirkwall: { key: 'islands', label: 'Orkney', areaPhrase: 'Kirkwall and Orkney', moveContext: 'island logistics and advance planning' },
  Lerwick: { key: 'islands', label: 'Shetland', areaPhrase: 'Lerwick and Shetland', moveContext: 'island moves with agreed schedules' },
}

const DEFAULT_REGION = {
  key: 'scotland',
  label: 'Scotland',
  areaPhrase: 'towns and villages across Scotland',
  moveContext: 'homes, flats, and local business moves',
}

/** @param {string} cityName */
function getRegion(cityName) {
  return REGION_BY_CITY[cityName] ?? DEFAULT_REGION
}

/** @param {string} cityName @param {number} seed */
function pickVariant(cityName, seed) {
  let h = seed
  for (let i = 0; i < cityName.length; i += 1) {
    h = (h + cityName.charCodeAt(i) * (i + 3)) % 997
  }
  return h
}

/** @param {string} cityName @param {string} kindLabel @param {number} variant */
function buildIntro(cityName, region, kindLabel, variant) {
  const intros = [
    `ShiftMyHome provides professional ${kindLabel} in ${cityName}, with crews who know ${region.areaPhrase}. Whether you are relocating within the town or moving to another part of Scotland, we plan access, parking, and loading so your ${region.moveContext} are handled with care.`,
    `Looking for dependable ${kindLabel} in ${cityName}? We support moves across ${region.label}, from compact flats to full-house relocations. Our team confirms vehicle size, crew, and timing before move day so you are not left guessing.`,
    `From ${cityName} to anywhere in Scotland or the UK, ShiftMyHome delivers structured ${kindLabel} with clear communication. We regularly work in ${region.areaPhrase} and understand the practical details that matter on local streets.`,
  ]
  return intros[variant % intros.length]
}

/** @param {string} cityName @param {string} regionLabel @param {number} variant */
function buildIntroSecondary(cityName, regionLabel, variant) {
  const lines = [
    `Based in Glasgow, we combine local knowledge with UK-wide capability — ideal when your move starts or ends in ${cityName} (${regionLabel}).`,
    `You receive a transparent online quote, insured transport, and professional movers who treat your belongings respectfully throughout the ${cityName} job.`,
    `Need packing materials, extra hands, or a specific time window? Tell us in the quote wizard and we will shape the ${cityName} plan around your priorities.`,
  ]
  return lines[variant % lines.length]
}

/** @param {SeoPageKind} kind @param {string} cityName */
function kindMeta(kind, cityName) {
  switch (kind) {
    case 'man-with-van':
      return {
        label: 'man with van',
        titleSuffix: `Man with Van ${cityName}`,
        h1: `Man with Van in ${cityName}`,
        serviceType: 'Man with Van',
        heroTeaser: `Flexible van & crew for ${cityName} loads.`,
        bullets: [
          'Single items, flat moves, and small office runs',
          'Same-area collections and multi-drop routes',
          'Help with stairs, lifts, and tight access',
        ],
      }
    case 'office-removals':
      return {
        label: 'office removals',
        titleSuffix: `Office Removals ${cityName}`,
        h1: `Office Removals in ${cityName}`,
        serviceType: 'Office Moves',
        heroTeaser: `Business relocations across ${cityName}.`,
        bullets: [
          'Desks, IT, filing, and meeting room furniture',
          'Out-of-hours moves where possible',
          'Labelled packing for faster setup',
        ],
      }
    case 'student-moves':
      return {
        label: 'student moves',
        titleSuffix: `Student Moves ${cityName}`,
        h1: `Student Moves in ${cityName}`,
        serviceType: 'Student Moves',
        heroTeaser: `Term-time moves for ${cityName} students.`,
        bullets: [
          'Halls, shared flats, and term storage runs',
          'Smaller vans for budget-friendly moves',
          'Flexible timing around term dates',
        ],
      }
    case 'furniture-delivery':
      return {
        label: 'furniture delivery',
        titleSuffix: `Furniture Delivery ${cityName}`,
        h1: `Furniture Delivery in ${cityName}`,
        serviceType: 'Furniture Delivery',
        heroTeaser: `Sofas, beds & bulky items in ${cityName}.`,
        bullets: [
          'Two-person delivery with straps and blankets',
          'Assembly/disassembly where agreed',
          'Retailer collections and private sales',
        ],
      }
    default:
      return {
        label: 'removals',
        titleSuffix: `${cityName} Removals`,
        h1: `Removals in ${cityName}`,
        serviceType: 'House Removals',
        heroTeaser: `House & flat removals across ${cityName}.`,
        bullets: [
          'Full and partial house moves',
          'Careful loading, transit, and placement',
          'Local, Scottish, and UK-wide routes',
        ],
      }
  }
}

/** @param {SeoPageKind} kind @param {string} cityName @param {ReturnType<typeof getRegion>} region */
function buildFaqs(kind, cityName, region) {
  const common = [
    {
      q: `How much do removals cost in ${cityName}?`,
      a: `Pricing depends on volume, distance, access, and date. Use our instant quote wizard with your ${cityName} pickup and delivery addresses for a live estimate — no obligation.`,
    },
    {
      q: `Do you cover postcodes around ${cityName}?`,
      a: `Yes. We serve ${region.areaPhrase} and can quote moves from ${cityName} to other Scottish towns or UK destinations.`,
    },
    {
      q: 'Are moves fully insured?',
      a: 'Goods-in-transit cover applies on booked jobs. Share high-value or fragile items in your quote so we can confirm the right approach.',
    },
  ]
  if (kind === 'man-with-van') {
    return [
      ...common,
      {
        q: `Is man with van cheaper than a full removal in ${cityName}?`,
        a: 'For smaller loads, a man-with-van crew is often the most efficient option. The wizard recommends vehicle size based on what you list.',
      },
    ]
  }
  if (kind === 'office-removals') {
    return [
      ...common,
      {
        q: `Can you move our ${cityName} office outside business hours?`,
        a: 'We schedule evening or weekend slots where availability allows — mention your preferred window in the quote notes.',
      },
    ]
  }
  if (kind === 'student-moves') {
    return [
      ...common,
      {
        q: `Do you help with student moves in ${cityName} during term changeover?`,
        a: 'Yes — book early around September and June peaks. We can handle shared flats, halls, and storage drops.',
      },
    ]
  }
  if (kind === 'furniture-delivery') {
    return [
      ...common,
      {
        q: `Can you collect furniture from a shop and deliver to ${cityName}?`,
        a: 'Yes. Add collection and delivery addresses, dimensions if known, and whether assembly is required.',
      },
    ]
  }
  return [
    ...common,
    {
      q: `How far in advance should I book removals in ${cityName}?`,
      a: 'Two to four weeks is ideal for house moves; we also accommodate shorter notice when crews are available.',
    },
  ]
}

/** @param {string} cityName @param {string} citySlug @param {SeoPageKind} kind @param {string} path */
function buildRelatedLinks(cityName, citySlug, kind, path) {
  /** @type {SeoRelatedLink[]} */
  const links = []
  const idx = scotlandCities.indexOf(cityName)

  const neighbours = []
  for (let offset = 1; offset <= 4; offset += 1) {
    const a = scotlandCities[(idx + offset) % scotlandCities.length]
    const b = scotlandCities[(idx - offset + scotlandCities.length) % scotlandCities.length]
    if (a !== cityName) neighbours.push(a)
    if (b !== cityName && neighbours.length < 4) neighbours.push(b)
  }

  neighbours.slice(0, 3).forEach((name) => {
    const slug = cityToSlug(name)
    if (kind === 'removals') {
      links.push({ href: `/${slug}-removals`, label: `${name} removals` })
    }
  })

  if (kind !== 'man-with-van' && MAN_WITH_VAN_CITIES.includes(cityName)) {
    links.push({ href: `/man-with-van-${citySlug}`, label: `Man with van ${cityName}` })
  }
  if (kind !== 'removals') {
    links.push({ href: `/${citySlug}-removals`, label: `${cityName} removals` })
  }
  if (cityName === 'Glasgow' || cityName === 'Edinburgh') {
    if (kind !== 'office-removals') links.push({ href: `/office-removals-${citySlug}`, label: `Office removals ${cityName}` })
    if (kind !== 'student-moves') links.push({ href: `/student-moves-${citySlug}`, label: `Student moves ${cityName}` })
    if (kind !== 'furniture-delivery') links.push({ href: `/furniture-delivery-${citySlug}`, label: `Furniture delivery ${cityName}` })
  }

  links.push(
    { href: '/house-removals', label: 'House removals' },
    { href: '/man-with-van', label: 'Man with van' },
    { href: '/coverage', label: 'Coverage map' },
    { href: '/#contact', label: 'Contact' },
  )

  return links.filter((l, i, arr) => arr.findIndex((x) => x.href === l.href) === i && l.href !== path).slice(0, 8)
}

/**
 * @param {SeoPageKind} kind
 * @param {string} cityName
 */
function buildSeoPage(kind, cityName) {
  const citySlug = cityToSlug(cityName)
  const region = getRegion(cityName)
  const meta = kindMeta(kind, cityName)
  const variant = pickVariant(cityName, kind.length * 11)

  let path
  switch (kind) {
    case 'man-with-van':
      path = `/man-with-van-${citySlug}`
      break
    case 'office-removals':
      path = `/office-removals-${citySlug}`
      break
    case 'student-moves':
      path = `/student-moves-${citySlug}`
      break
    case 'furniture-delivery':
      path = `/furniture-delivery-${citySlug}`
      break
    default:
      path = `/${citySlug}-removals`
  }

  const title = `${meta.titleSuffix} | ShiftMyHome — Instant Quote`
  const metaDescription = `Book ${meta.label} in ${cityName}, ${region.label}. Insured crews, transparent pricing, and an instant online quote from ShiftMyHome. Serving ${region.areaPhrase}.`

  return /** @type {SeoPageConfig} */ ({
    path,
    slug: path.slice(1),
    kind,
    cityName,
    citySlug,
    regionKey: region.key,
    regionLabel: region.label,
    title,
    metaDescription,
    h1: meta.h1,
    intro: buildIntro(cityName, region, meta.label, variant),
    introSecondary: buildIntroSecondary(cityName, region.label, variant + 1),
    serviceType: meta.serviceType,
    heroTeaser: meta.heroTeaser,
    serviceBullets: meta.bullets,
    faqs: buildFaqs(kind, cityName, region),
    relatedLinks: buildRelatedLinks(cityName, citySlug, kind, path),
  })
}

/**
 * @param {import('./seoIntentPages.js').IntentPageDef} def
 * @returns {SeoPageConfig}
 */
function buildIntentPage(def) {
  const citySlug = def.cityName === 'Scotland' ? 'scotland' : cityToSlug(def.cityName)
  const region = def.cityName === 'Scotland' ? DEFAULT_REGION : getRegion(def.cityName)
  const title = `${def.h1} | ShiftMyHome — Instant Quote`

  /** @type {SeoRelatedLink[]} */
  const related = [...(def.extraRelated ?? [])]
  if (def.cityName !== 'Scotland') {
    related.push({ href: `/${citySlug}-removals`, label: `${def.cityName} removals` })
    if (MAN_WITH_VAN_CITIES.includes(def.cityName)) {
      related.push({ href: `/man-with-van-${citySlug}`, label: `Man with van ${def.cityName}` })
    }
  } else {
    related.push({ href: '/glasgow-removals', label: 'Glasgow removals' }, { href: '/edinburgh-removals', label: 'Edinburgh removals' })
  }
  related.push(
    { href: '/house-removals', label: 'House removals' },
    { href: '/man-with-van', label: 'Man with van' },
    { href: '/coverage', label: 'Coverage map' },
  )

  const relatedLinks = related
    .filter((l, i, arr) => arr.findIndex((x) => x.href === l.href) === i && l.href !== def.path)
    .slice(0, 8)

  return {
    path: def.path,
    slug: def.path.slice(1),
    kind: 'intent',
    cityName: def.cityName,
    citySlug,
    regionKey: region.key,
    regionLabel: def.regionLabel,
    title,
    metaDescription: def.metaDescription,
    h1: def.h1,
    intro: def.intro,
    introSecondary: def.introSecondary,
    serviceType: def.serviceType,
    heroTeaser: def.heroTeaser,
    serviceBullets: def.serviceBullets,
    faqs: def.faqs,
    relatedLinks,
  }
}

/** @type {SeoPageConfig[]} */
const removalsPages = scotlandCities.map((city) => buildSeoPage('removals', city))

/** @type {SeoPageConfig[]} */
const manWithVanPages = MAN_WITH_VAN_CITIES.map((city) => buildSeoPage('man-with-van', city))

/** @type {SeoPageConfig[]} */
const serviceCityPages = SERVICE_CITY_ROUTES.flatMap(({ kind, cities }) =>
  cities.map((city) => buildSeoPage(kind, city)),
)

/** @type {SeoPageConfig[]} */
const intentPages = INTENT_PAGE_DEFINITIONS.map(buildIntentPage)

/** @param {SeoPageConfig[]} pages */
function assertUniqueSeoPaths(pages) {
  const paths = pages.map((p) => p.path)
  const seen = new Set()
  for (const path of paths) {
    if (seen.has(path)) {
      throw new Error(`Duplicate SEO path: ${path}`)
    }
    seen.add(path)
  }
}

const ALL_SEO_PAGES_RAW = [...removalsPages, ...manWithVanPages, ...serviceCityPages, ...intentPages]
assertUniqueSeoPaths(ALL_SEO_PAGES_RAW)

export const ALL_SEO_PAGES = ALL_SEO_PAGES_RAW

/** @type {Map<string, SeoPageConfig>} */
const byPath = new Map(ALL_SEO_PAGES.map((p) => [p.path, p]))

/** @param {string} pathname */
export function getSeoPageByPath(pathname) {
  return byPath.get(pathname) ?? null
}

export const SEO_PAGE_PATHS = ALL_SEO_PAGES.map((p) => p.path)
