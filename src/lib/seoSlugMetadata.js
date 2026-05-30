/**
 * Slug-based SEO metadata fallback for public routes not in seoPages config.
 */
import { buildCanonicalUrl, finalizeMetaDescription, shortenSeoTitle } from './seo/seoKeywordHelpers.js'

const SCOTTISH_LOCATIONS = [
  'glasgow',
  'edinburgh',
  'aberdeen',
  'dundee',
  'inverness',
  'paisley',
  'perth',
  'stirling',
  'falkirk',
  'livingston',
  'east-kilbride',
  'hamilton',
  'cumbernauld',
  'kirkcaldy',
  'dunfermline',
  'ayr',
  'kilmarnock',
  'greenock',
  'motherwell',
  'coatbridge',
]

/** @param {string} slug */
function titleCaseWords(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** @param {string} slug */
function detectLocation(slug) {
  for (const loc of SCOTTISH_LOCATIONS) {
    if (slug === loc || slug.endsWith(`-${loc}`) || slug.startsWith(`${loc}-`)) {
      return titleCaseWords(loc)
    }
  }
  const removalsMatch = slug.match(/^(?:.+)-([a-z-]+)-removals$/)
  if (removalsMatch) return titleCaseWords(removalsMatch[1])
  const tailMatch = slug.match(/(?:^|-)([a-z]+(?:-[a-z]+)?)$/)
  if (tailMatch && !['removals', 'delivery', 'moves', 'van'].includes(tailMatch[1])) {
    return titleCaseWords(tailMatch[1])
  }
  return 'Scotland'
}

/** @param {string} slug */
function detectServiceLabel(slug) {
  if (slug.includes('man-with-van') || slug.includes('man-and-van')) return 'Man and Van'
  if (slug.includes('furniture-delivery') || slug.includes('sofa-delivery')) return 'Furniture Delivery'
  if (slug.includes('office-removals') || slug.includes('office-moves') || slug.includes('office-movers')) {
    return 'Office Removals'
  }
  if (slug.includes('student-moves') || slug.includes('student-removals')) return 'Student Moves'
  if (slug.includes('same-day')) return 'Same Day Removals'
  if (slug.includes('urgent')) return 'Urgent Removals'
  if (slug.includes('long-distance')) return 'Long Distance Removals'
  if (slug.includes('ikea')) return 'IKEA Delivery'
  if (slug.includes('tk-maxx') || slug.includes('tkmaxx')) return 'TK Maxx Delivery'
  if (slug.includes('gumtree')) return 'Gumtree Delivery'
  if (slug.includes('facebook-marketplace') || slug.includes('facebook-delivery')) {
    return 'Facebook Marketplace Delivery'
  }
  if (slug.includes('clearance')) return 'Clearance'
  if (slug.includes('house-removals') || slug.endsWith('-removals') || slug === 'removals') {
    return 'House Removals'
  }
  return 'Removals'
}

/** @param {string} service @param {string} location */
function buildTitle(service, location) {
  if (location === 'Scotland') return shortenSeoTitle(`${service} Scotland | ShiftMyHome`)
  if (service === 'Furniture Delivery') return shortenSeoTitle(`Furniture Delivery ${location} | ShiftMyHome`)
  if (service === 'Man and Van') return shortenSeoTitle(`${location} Man and Van | ShiftMyHome`)
  if (service === 'Student Moves') return shortenSeoTitle(`Student Moves ${location} | ShiftMyHome`)
  if (service === 'Same Day Removals') return shortenSeoTitle(`Same Day Removals ${location} | ShiftMyHome`)
  if (service === 'House Removals') return shortenSeoTitle(`${location} Removals | ShiftMyHome`)
  return shortenSeoTitle(`${location} ${service} | ShiftMyHome`)
}

/** @param {string} service @param {string} location @param {string} slug */
function buildDescription(service, location, slug) {
  const locPhrase = location === 'Scotland' ? 'Scotland' : location
  const serviceLower = service.toLowerCase()
  const templates = [
    `Book trusted ${locPhrase} ${serviceLower} with ShiftMyHome. House moves, furniture delivery and man with van. Get a quote today.`,
    `Professional ${serviceLower} in ${locPhrase} with ShiftMyHome. Insured local movers and clear online pricing. Get your quote today.`,
    `Need ${serviceLower} in ${locPhrase}? ShiftMyHome offers house removals, local movers and furniture delivery. Quote online today.`,
    `Reliable ${serviceLower} across ${locPhrase} from ShiftMyHome. Experienced crews and transparent pricing. Get a quote today.`,
  ]
  const idx = Math.abs(hashString(slug)) % templates.length
  return finalizeMetaDescription(templates[idx])
}

/** @param {string} s */
function hashString(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

/**
 * @param {string} pathname
 */
export function buildSeoMetadataFromSlug(pathname) {
  const path = pathname === '/' ? '/' : pathname.replace(/\/+$/, '') || '/'
  const slug = path === '/' ? '' : path.slice(1)
  const location = detectLocation(slug)
  const service = detectServiceLabel(slug)
  const title = buildTitle(service, location)
  const description = buildDescription(service, location, slug)
  const h1 =
    location === 'Scotland'
      ? `${service} in Scotland`
      : service === 'Furniture Delivery'
        ? `Furniture Delivery in ${location}`
        : `${service} in ${location}`

  return {
    path,
    title,
    description,
    h1,
    ogTitle: title,
    ogDescription: description,
    canonicalUrl: buildCanonicalUrl(path),
  }
}
