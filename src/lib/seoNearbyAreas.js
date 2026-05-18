import scotlandCities from '../data/scotlandCities.json' with { type: 'json' }
import { cityToSlug } from './citySlug.js'

/** Cities with dedicated /man-with-van-{city} routes — others link to removals pages. */
const MAN_WITH_VAN_CITY_SLUGS = new Set(
  ['Glasgow', 'Edinburgh', 'Aberdeen', 'Dundee', 'Inverness', 'Stirling', 'Perth', 'Paisley', 'Falkirk', 'Livingston'].map(
    cityToSlug,
  ),
)

/**
 * Geographic neighbours for stronger internal linking (not exhaustive — fallback uses region peers).
 * @type {Record<string, string[]>}
 */
export const NEARBY_CITIES = {
  Glasgow: ['Paisley', 'East Kilbride', 'Hamilton', 'Clydebank', 'Motherwell', 'Renfrew'],
  Edinburgh: ['Musselburgh', 'Livingston', 'Dalkeith', 'Penicuik', 'Dunfermline'],
  Aberdeen: ['Stonehaven', 'Peterhead', 'Dundee', 'Inverness'],
  Dundee: ['Perth', 'Arbroath', 'Forfar', 'Edinburgh'],
  Inverness: ['Aviemore', 'Fort William', 'Nairn', 'Elgin'],
  Stirling: ['Falkirk', 'Cumbernauld', 'Perth', 'Glasgow'],
  Perth: ['Dundee', 'Crieff', 'Blairgowrie', 'Stirling'],
  Paisley: ['Glasgow', 'Renfrew', 'Johnstone', 'Greenock'],
  Falkirk: ['Stirling', 'Livingston', 'Cumbernauld', 'Glasgow'],
  Livingston: ['Edinburgh', 'Bathgate', 'Broxburn', 'Falkirk'],
  Dunfermline: ['Kirkcaldy', 'Edinburgh', 'Glenrothes', 'Linlithgow'],
  Motherwell: ['Hamilton', 'Wishaw', 'Coatbridge', 'Glasgow'],
  Ayr: ['Kilmarnock', 'Troon', 'Prestwick', 'Irvine'],
}

/** @type {Record<string, string[]>} */
const REGION_PEERS = {
  'greater-glasgow': ['Glasgow', 'Paisley', 'East Kilbride', 'Hamilton', 'Clydebank'],
  'edinburgh-lothians': ['Edinburgh', 'Musselburgh', 'Livingston', 'Dalkeith'],
  'lanarkshire': ['Hamilton', 'Motherwell', 'East Kilbride', 'Wishaw', 'Coatbridge'],
  'fife': ['Dunfermline', 'Kirkcaldy', 'Glenrothes', 'Edinburgh'],
  'tayside': ['Dundee', 'Perth', 'Arbroath', 'Forfar'],
  'north-east': ['Aberdeen', 'Peterhead', 'Stonehaven', 'Elgin'],
  highlands: ['Inverness', 'Fort William', 'Aviemore', 'Wick'],
  ayrshire: ['Ayr', 'Kilmarnock', 'Irvine', 'Troon'],
  central: ['Stirling', 'Falkirk', 'Perth', 'Cumbernauld'],
}

/**
 * @param {string} cityName
 * @param {string} regionKey
 * @param {'removals' | 'man-with-van'} [linkKind]
 * @returns {{ href: string, label: string }[]}
 */
export function buildNearbyLocationLinks(cityName, regionKey, linkKind = 'removals') {
  if (cityName === 'Scotland') {
    return ['Glasgow', 'Edinburgh', 'Aberdeen', 'Dundee', 'Inverness', 'Stirling'].map((name) => ({
      href: `/${cityToSlug(name)}-removals`,
      label: name,
    }))
  }

  const names = new Set()
  const explicit = NEARBY_CITIES[cityName] ?? REGION_PEERS[regionKey] ?? []
  explicit.forEach((n) => {
    if (n !== cityName) names.add(n)
  })

  if (names.size < 4) {
    const idx = scotlandCities.indexOf(cityName)
    if (idx >= 0) {
      for (let offset = 1; offset <= 6 && names.size < 6; offset += 1) {
        const next = scotlandCities[(idx + offset) % scotlandCities.length]
        if (next !== cityName) names.add(next)
      }
    }
  }

  return [...names].slice(0, 6).map((name) => {
    const slug = cityToSlug(name)
    const href =
      linkKind === 'man-with-van' && MAN_WITH_VAN_CITY_SLUGS.has(slug)
        ? `/man-with-van-${slug}`
        : `/${slug}-removals`
    return { href, label: name }
  })
}

/** Scotland-wide hub links for crawl paths */
export const SCOTLAND_HUB_LINKS = [
  { href: '/removals-scotland', label: 'Removals Scotland' },
  { href: '/moving-services-scotland', label: 'Moving services Scotland' },
  { href: '/movers-near-me', label: 'Movers near me' },
  { href: '/coverage', label: 'Coverage map' },
]
