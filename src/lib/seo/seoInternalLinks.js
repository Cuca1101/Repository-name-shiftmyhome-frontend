import { cityToSlug } from '../citySlug.js'
import { buildNearbyLocationLinks } from '../seoNearbyAreas.js'
import { SEO_PAGE_PATHS } from '../../data/seoPages.js'
import { SERVICE_PAGES } from '../../constants/servicePages.js'
import {
  FOOTER_PRIMARY_CITIES,
  MAN_WITH_VAN_SEO_CITIES,
  getRemovalsPathForCity,
} from './locations.js'

/** @typedef {{ href: string, label: string }} SeoInternalLink */

/** @type {Set<string>} */
const KNOWN_INTERNAL_PATHS = new Set([
  ...SEO_PAGE_PATHS,
  ...SERVICE_PAGES.map((p) => p.path),
  '/coverage',
])

/** @param {SeoInternalLink} item @param {string} [excludePath] */
function pushUnique(/** @type {SeoInternalLink[]} */ links, item, excludePath) {
  if (!item?.href || item.href === excludePath) return
  if (!KNOWN_INTERNAL_PATHS.has(item.href)) return
  if (links.some((l) => l.href === item.href)) return
  links.push(item)
}

/** @param {SeoInternalLink[]} links @param {number} [limit] */
function limitLinks(links, limit = 6) {
  return links.slice(0, limit)
}

/** @type {Record<string, SeoInternalLink[]>} */
const CITY_SERVICE_LINKS = {
  Glasgow: [
    { href: '/glasgow-removals', label: 'Glasgow House Removals' },
    { href: '/man-with-van-glasgow', label: 'Man with Van Glasgow' },
    { href: '/same-day-removals-glasgow', label: 'Same Day Removals Glasgow' },
    { href: '/student-removals-glasgow', label: 'Student Moves in Glasgow' },
    { href: '/office-removals-glasgow', label: 'Office Removals Glasgow' },
    { href: '/furniture-delivery-glasgow', label: 'Furniture Delivery Glasgow' },
  ],
  Edinburgh: [
    { href: '/edinburgh-removals', label: 'Edinburgh Removals' },
    { href: '/man-with-van-edinburgh', label: 'Man with Van Edinburgh' },
    { href: '/same-day-man-with-van-edinburgh', label: 'Same Day Van Edinburgh' },
    { href: '/cheap-student-moves-edinburgh', label: 'Student Moves in Edinburgh' },
    { href: '/office-removals-edinburgh', label: 'Office Removals Edinburgh' },
    { href: '/furniture-delivery-edinburgh', label: 'Furniture Delivery Edinburgh' },
  ],
  Aberdeen: [
    { href: '/aberdeen-removals', label: 'Removals in Aberdeen' },
    { href: '/man-with-van-aberdeen', label: 'Man with Van Aberdeen' },
  ],
  Dundee: [
    { href: '/dundee-removals', label: 'Removals in Dundee' },
    { href: '/man-with-van-dundee', label: 'Man with Van Dundee' },
  ],
  Inverness: [
    { href: '/inverness-removals', label: 'Removals in Inverness' },
    { href: '/man-with-van-inverness', label: 'Man with Van Inverness' },
  ],
  Paisley: [
    { href: '/paisley-removals', label: 'Removals in Paisley' },
    { href: '/man-with-van-paisley', label: 'Man with Van Paisley' },
  ],
}

/** @type {SeoInternalLink[]} */
const SCOTLAND_SERVICE_LINKS = [
  { href: '/glasgow-removals', label: 'Glasgow House Removals' },
  { href: '/edinburgh-removals', label: 'Edinburgh Removals' },
  { href: '/man-with-van-glasgow', label: 'Man with Van Glasgow' },
  { href: '/same-day-removals-glasgow', label: 'Same Day Removals Glasgow' },
  { href: '/office-removals-glasgow', label: 'Office Removals Glasgow' },
  { href: '/student-removals-glasgow', label: 'Student Moves in Glasgow' },
]

/** @type {SeoInternalLink[]} */
const POPULAR_GUIDES = [
  { href: '/removals-scotland', label: 'Removals Across Scotland' },
  { href: '/moving-services-scotland', label: 'Moving Services Across Scotland' },
  { href: '/furniture-delivery-scotland', label: 'Furniture Delivery Scotland' },
  { href: '/movers-near-me', label: 'Movers Near Me' },
  { href: '/removal-company-near-me', label: 'Removal Company Near Me' },
  { href: '/ikea-furniture-delivery', label: 'IKEA Furniture Delivery' },
]

/**
 * @param {string} cityName
 * @param {string} excludePath
 * @returns {SeoInternalLink[]}
 */
function buildRelatedServices(cityName, excludePath) {
  /** @type {SeoInternalLink[]} */
  const links = []

  if (cityName === 'Scotland') {
    SCOTLAND_SERVICE_LINKS.forEach((item) => pushUnique(links, item, excludePath))
  } else if (CITY_SERVICE_LINKS[cityName]) {
    CITY_SERVICE_LINKS[cityName].forEach((item) => pushUnique(links, item, excludePath))
  } else {
    const slug = cityToSlug(cityName)
    pushUnique(links, { href: getRemovalsPathForCity(cityName), label: `Removals in ${cityName}` }, excludePath)
    if (MAN_WITH_VAN_SEO_CITIES.includes(cityName)) {
      pushUnique(
        links,
        { href: `/man-with-van-${slug}`, label: `Man with Van ${cityName}` },
        excludePath,
      )
    }
    pushUnique(links, { href: '/house-removals', label: 'House Removals Service' }, excludePath)
    pushUnique(links, { href: '/man-with-van', label: 'Man with Van Service' }, excludePath)
  }

  if (links.length < 4) {
    pushUnique(links, { href: '/furniture-delivery', label: 'Furniture Delivery Service' }, excludePath)
    pushUnique(links, { href: '/office-moves', label: 'Office Removals Service' }, excludePath)
    pushUnique(links, { href: '/student-moves', label: 'Student Moves Service' }, excludePath)
  }

  return limitLinks(links)
}

/**
 * @param {string} cityName
 * @param {string} regionKey
 * @param {string} excludePath
 * @returns {SeoInternalLink[]}
 */
function buildNearbyAreas(cityName, regionKey, excludePath) {
  /** @type {SeoInternalLink[]} */
  const links = []

  if (cityName === 'Scotland') {
    FOOTER_PRIMARY_CITIES.forEach((name) => {
      pushUnique(
        links,
        { href: getRemovalsPathForCity(name), label: `Removals in ${name}` },
        excludePath,
      )
    })
    return limitLinks(links)
  }

  const nearby = buildNearbyLocationLinks(cityName, regionKey, 'removals')
  nearby.forEach(({ href, label }) => {
    const areaLabel = href.endsWith('-removals') ? `Removals in ${label}` : label
    pushUnique(links, { href, label: areaLabel }, excludePath)
  })

  if (links.length < 4) {
    FOOTER_PRIMARY_CITIES.filter((name) => name !== cityName).forEach((name) => {
      pushUnique(
        links,
        { href: getRemovalsPathForCity(name), label: `Removals in ${name}` },
        excludePath,
      )
    })
  }

  return limitLinks(links)
}

/** @param {string} excludePath @returns {SeoInternalLink[]} */
function buildPopularGuides(excludePath) {
  /** @type {SeoInternalLink[]} */
  const links = []
  POPULAR_GUIDES.forEach((item) => pushUnique(links, item, excludePath))
  return limitLinks(links)
}

/**
 * @param {object} options
 * @param {string} options.path
 * @param {string} [options.cityName]
 * @param {string} [options.regionKey]
 * @returns {{ relatedServices: SeoInternalLink[], nearbyAreas: SeoInternalLink[], popularGuides: SeoInternalLink[] } | null}
 */
export function buildSeoInternalLinks({ path, cityName = 'Glasgow', regionKey = 'greater-glasgow' }) {
  if (!path) return null

  const relatedServices = buildRelatedServices(cityName, path)
  const nearbyAreas = buildNearbyAreas(cityName, regionKey, path)
  const popularGuides = buildPopularGuides(path)

  if (relatedServices.length + nearbyAreas.length + popularGuides.length === 0) {
    return null
  }

  return { relatedServices, nearbyAreas, popularGuides }
}

/**
 * @param {string} pathname
 * @param {import('../../data/seoPages.js').SeoPageConfig | null} [seoPage]
 */
export function buildSeoInternalLinksFromPath(pathname, seoPage = null) {
  if (seoPage) {
    return buildSeoInternalLinks({
      path: seoPage.path,
      cityName: seoPage.cityName,
      regionKey: seoPage.regionKey,
    })
  }

  if (pathname === '/coverage') {
    return buildSeoInternalLinks({ path: pathname, cityName: 'Scotland', regionKey: 'scotland' })
  }

  const servicePage = SERVICE_PAGES.find((p) => p.path === pathname)
  if (servicePage) {
    return buildSeoInternalLinks({
      path: pathname,
      cityName: 'Glasgow',
      regionKey: 'greater-glasgow',
    })
  }

  return null
}
