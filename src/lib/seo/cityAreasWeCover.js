/**
 * Suburb and nearby-area lists for priority city removal pages.
 * Used by SeoLandingPage "Areas We Cover" and static prerender HTML.
 */

import { cityToSlug } from '../citySlug.js'

/** @typedef {{ name: string, href: string }} CityAreaLink */

/** @typedef {{ href: string, label: string }} SeoRelatedLink */

/** Important secondary cities with existing /{city}-removals pages. */
export const SECONDARY_SCOTLAND_CITY_NAMES = [
  'Ayr',
  'Falkirk',
  'Stirling',
  'Greenock',
  'Motherwell',
  'Airdrie',
  'Bathgate',
  'Dunfermline',
  'Kirkcaldy',
]

/** Priority city removal hubs — linked from service pages as main cities. */
export const PRIMARY_SCOTLAND_CITY_NAMES = [
  'Glasgow',
  'Edinburgh',
  'Aberdeen',
  'Dundee',
  'Inverness',
  'Paisley',
]

const PRIMARY_CITY_REMOVAL_PATHS = new Set(
  PRIMARY_SCOTLAND_CITY_NAMES.map((name) => `/${cityToSlug(name)}-removals`),
)

const SECONDARY_CITY_REMOVAL_PATHS = new Set(
  SECONDARY_SCOTLAND_CITY_NAMES.map((name) => `/${cityToSlug(name)}-removals`),
)

/**
 * Split service-page location links into main cities, more areas, and specialty routes.
 * @param {{ href: string, label: string }[]} links
 */
export function groupServicePageCityLinks(links) {
  /** @type {{ href: string, label: string }[]} */
  const mainCities = []
  /** @type {{ href: string, label: string }[]} */
  const moreAreas = []
  /** @type {{ href: string, label: string }[]} */
  const localServices = []

  for (const link of links) {
    if (PRIMARY_CITY_REMOVAL_PATHS.has(link.href)) {
      mainCities.push(link)
    } else if (SECONDARY_CITY_REMOVAL_PATHS.has(link.href)) {
      moreAreas.push(link)
    } else {
      localServices.push(link)
    }
  }

  return { mainCities, moreAreas, localServices }
}

/** @returns {SeoRelatedLink[]} */
export function buildSecondaryCityRemovalLinks() {
  return SECONDARY_SCOTLAND_CITY_NAMES.map((name) => ({
    href: `/${cityToSlug(name)}-removals`,
    label: `${name} removals`,
  }))
}

/** Cities with dedicated /man-with-van-{city} routes among the secondary set. */
const SECONDARY_MAN_WITH_VAN_CITIES = ['Falkirk', 'Stirling']

/** @returns {SeoRelatedLink[]} */
export function buildSecondaryManWithVanLinks() {
  return SECONDARY_MAN_WITH_VAN_CITIES.map((name) => ({
    href: `/man-with-van-${cityToSlug(name)}`,
    label: `Man with van ${name}`,
  }))
}

/** @type {Record<string, string[]>} */
export const CITY_AREAS_WE_COVER = {
  Glasgow: [
    'Paisley',
    'East Kilbride',
    'Clydebank',
    'Renfrew',
    'Johnstone',
    'Barrhead',
    'Bearsden',
    'Milngavie',
    'Bishopbriggs',
    'Newton Mearns',
    'Rutherglen',
    'Knightswood',
    'Erskine',
    'Kirkintilloch',
    'Dumbarton',
    'Helensburgh',
    'Cambuslang',
    'Hamilton',
    'Motherwell',
    'Coatbridge',
    'Airdrie',
    'Falkirk',
    'Stirling',
    'Greenock',
    'Ayr',
  ],  Edinburgh: [
    'Leith',
    'Musselburgh',
    'Dalkeith',
    'Penicuik',
    'Queensferry',
    'North Berwick',
    'Haddington',
    'Tranent',
    'Bonnyrigg',
    'Livingston',
    'Linlithgow',
    'Bathgate',
    'Broxburn',
    'Kirkcaldy',
    'Dunfermline',
  ],
  Aberdeen: [
    'Peterhead',
    'Fraserburgh',
    'Stonehaven',
    'Ellon',
    'Inverurie',
    'Oldmeldrum',
    'Banchory',
    'Aboyne',
    'Banff',
    'Elgin',
    'Forres',
    'Alness',
    'Huntly',
  ],
  Dundee: [
    'Perth',
    'Arbroath',
    'Forfar',
    'Montrose',
    'Carnoustie',
    'Blairgowrie',
    'Crieff',
    'Cupar',
    'St Andrews',
    'Kirriemuir',
    'Brechin',
    'Pitlochry',
  ],
  Inverness: [
    'Nairn',
    'Fort William',
    'Aviemore',
    'Dingwall',
    'Dornoch',
    'Elgin',
    'Forres',
    'Kingussie',
    'Fort Augustus',
    'Thurso',
    'Wick',
    'Golspie',
  ],
  Paisley: [
    'Renfrew',
    'Johnstone',
    'Barrhead',
    'Erskine',
    'Clydebank',
    'Glasgow',
    'East Kilbride',
    'Kirkintilloch',
    'Bishopbriggs',
    'Newton Mearns',
    'Greenock',
    'Port Glasgow',
    'Kilwinning',
    'Irvine',
  ],
  Ayr: [
    'Kilmarnock',
    'Irvine',
    'Troon',
    'Prestwick',
    'Kilwinning',
    'Saltcoats',
    'Ardrossan',
    'Girvan',
    'Maybole',
    'Stewarton',
    'Glasgow',
  ],
  Falkirk: [
    'Stirling',
    'Alloa',
    'Denny',
    'Bo\'ness',
    'Livingston',
    'Cumbernauld',
    'Linlithgow',
    'Glasgow',
    'Edinburgh',
  ],
  Stirling: [
    'Falkirk',
    'Alloa',
    'Denny',
    'Callander',
    'Dollar',
    'Cumbernauld',
    'Glasgow',
    'Perth',
  ],
  Greenock: [
    'Gourock',
    'Port Glasgow',
    'Paisley',
    'Glasgow',
    'Wemyss Bay',
    'Johnstone',
    'Renfrew',
  ],
  Motherwell: [
    'Hamilton',
    'Wishaw',
    'Coatbridge',
    'Airdrie',
    'Bellshill',
    'Blantyre',
    'Lanark',
    'Glasgow',
    'East Kilbride',
  ],
  Airdrie: [
    'Coatbridge',
    'Motherwell',
    'Bellshill',
    'Hamilton',
    'Glasgow',
    'Cumbernauld',
    'Bathgate',
    'Wishaw',
  ],
  Bathgate: [
    'Livingston',
    'Linlithgow',
    'Broxburn',
    'Armadale',
    'Whitburn',
    'Edinburgh',
    'Falkirk',
    'Glasgow',
  ],
  Dunfermline: [
    'Kirkcaldy',
    'Glenrothes',
    'Cowdenbeath',
    'Lochgelly',
    'Kinross',
    'Cupar',
    'Edinburgh',
    'St Andrews',
  ],
  Kirkcaldy: [
    'Dunfermline',
    'Glenrothes',
    'Cowdenbeath',
    'Leven',
    'Burntisland',
    'Edinburgh',
    'Cupar',
  ],
}

/** @param {string} cityName */
export function getCityAreasWeCover(cityName) {
  return CITY_AREAS_WE_COVER[cityName] ?? []
}

/**
 * @param {string} cityName
 * @returns {CityAreaLink[]}
 */
export function buildCityAreaLinks(cityName) {
  return getCityAreasWeCover(cityName).map((name) => ({
    name,
    href: `/${cityToSlug(name)}-removals`,
  }))
}
