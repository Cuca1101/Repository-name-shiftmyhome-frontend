/**
 * Scotland location registry — single source for SEO city pages.
 * Used by seoPages.js, seoNearbyAreas.js, and footer internal links.
 */

import { cityToSlug } from '../citySlug.js'

/** @typedef {{ key: string, label: string, areaPhrase: string, moveContext: string }} SeoRegionDef */

/** @type {Record<string, SeoRegionDef>} */
export const REGION_DEFINITIONS = {
  'greater-glasgow': {
    key: 'greater-glasgow',
    label: 'Greater Glasgow',
    areaPhrase: 'Glasgow and the surrounding towns',
    moveContext: 'tenements, flats, and family homes',
  },
  'edinburgh-lothians': {
    key: 'edinburgh-lothians',
    label: 'Edinburgh & the Lothians',
    areaPhrase: 'Edinburgh, Leith, and the Lothians',
    moveContext: 'city flats, New Town properties, and suburban family homes',
  },
  'lanarkshire': {
    key: 'lanarkshire',
    label: 'Lanarkshire',
    areaPhrase: 'Lanarkshire towns and new-build estates',
    moveContext: 'terraced homes, estates, and commuter properties',
  },
  lothians: {
    key: 'lothians',
    label: 'West Lothian & Midlothian',
    areaPhrase: 'West Lothian and Midlothian communities',
    moveContext: 'new-town housing and suburban family moves',
  },
  fife: {
    key: 'fife',
    label: 'Fife',
    areaPhrase: 'Fife towns and the Kingdom coast',
    moveContext: 'coastal flats, planned towns, and historic properties',
  },
  tayside: {
    key: 'tayside',
    label: 'Tayside',
    areaPhrase: 'Dundee, Perthshire, and Angus',
    moveContext: 'riverside flats, market towns, and rural outskirts',
  },
  'north-east': {
    key: 'north-east',
    label: 'North East Scotland',
    areaPhrase: 'Aberdeen, Aberdeenshire, and the north-east coast',
    moveContext: 'granite properties, coastal flats, and rural relocations',
  },
  highlands: {
    key: 'highlands',
    label: 'The Highlands',
    areaPhrase: 'the Highlands and far north',
    moveContext: 'longer access routes, rural properties, and careful scheduling',
  },
  ayrshire: {
    key: 'ayrshire',
    label: 'Ayrshire',
    areaPhrase: 'Ayrshire towns and the Clyde coast',
    moveContext: 'seaside properties, bungalows, and town centre flats',
  },
  central: {
    key: 'central',
    label: 'Central Scotland',
    areaPhrase: 'Central Scotland and the Forth Valley',
    moveContext: 'commuter moves and historic town centre properties',
  },
  inverclyde: {
    key: 'inverclyde',
    label: 'Inverclyde',
    areaPhrase: 'Inverclyde and the lower Clyde',
    moveContext: 'coastal flats and hillside streets',
  },
  south: {
    key: 'south',
    label: 'South Scotland',
    areaPhrase: 'Dumfries and Galloway and the Scottish Borders',
    moveContext: 'market-town homes and longer rural legs',
  },
  borders: {
    key: 'borders',
    label: 'Scottish Borders',
    areaPhrase: 'Border towns and market communities',
    moveContext: 'stone-built homes and cross-border routes',
  },
  argyll: {
    key: 'argyll',
    label: 'Argyll & Bute',
    areaPhrase: 'Argyll, Bute, and the west coast',
    moveContext: 'ferry-linked routes, narrow access, and coastal properties',
  },
  islands: {
    key: 'islands',
    label: 'Scottish Islands',
    areaPhrase: 'Scotland’s island communities',
    moveContext: 'island logistics, advance planning, and agreed schedules',
  },
  scotland: {
    key: 'scotland',
    label: 'Scotland',
    areaPhrase: 'towns and villages across Scotland',
    moveContext: 'homes, flats, and local business moves',
  },
}

/** Priority cities appear first in lists and footer links. */
export const PRIORITY_SEO_CITIES = [
  'Glasgow',
  'Edinburgh',
  'Aberdeen',
  'Dundee',
  'Inverness',
  'Paisley',
  'East Kilbride',
  'Livingston',
  'Hamilton',
  'Cumbernauld',
  'Falkirk',
  'Stirling',
  'Perth',
  'Ayr',
  'Kilmarnock',
  'Greenock',
  'Motherwell',
  'Dunfermline',
  'Kirkcaldy',
  'St Andrews',
]

/** @type {Record<string, string[]>} */
const REGION_CITY_GROUPS = {
  'greater-glasgow': [
    'Glasgow', 'Paisley', 'East Kilbride', 'Clydebank', 'Renfrew', 'Johnstone', 'Barrhead',
    'Bearsden', 'Milngavie', 'Bishopbriggs', 'Newton Mearns', 'Rutherglen', 'Knightswood',
    'Yoker', 'Erskine', 'Kirkintilloch', 'Balerno', 'Gourock', 'Port Glasgow', 'Wemyss Bay',
    'Alexandria', 'Dumbarton', 'Helensburgh', 'Clydebank',
  ],
  'edinburgh-lothians': [
    'Edinburgh', 'Musselburgh', 'Dalkeith', 'Penicuik', 'Queensferry', 'North Berwick',
    'Haddington', 'Tranent', 'Bonnyrigg', 'Newburgh',
  ],
  lanarkshire: [
    'Hamilton', 'Motherwell', 'Wishaw', 'Coatbridge', 'Airdrie', 'Bellshill', 'Blantyre',
    'Lanark', 'Carluke', 'Lesmahagow', 'Shotts', 'Uddingston', 'Cambuslang', 'Larkhall',
    'Stenhousemuir', 'Whitburn', 'Armadale', 'Bathgate', 'Broxburn', 'Livingston',
    'Cumbernauld', 'East Kilbride',
  ],
  lothians: ['Livingston', 'Bathgate', 'Broxburn', 'Linlithgow', 'Whitburn', 'Armadale'],
  fife: [
    'Dunfermline', 'Kirkcaldy', 'Glenrothes', 'Cowdenbeath', 'Lochgelly', 'Burntisland',
    'Cupar', 'St Andrews', 'Leven', 'Kinross', 'Newburgh', 'Pittenweem', 'Ballingry',
  ],
  tayside: [
    'Dundee', 'Perth', 'Arbroath', 'Forfar', 'Montrose', 'Brechin', 'Carnoustie',
    'Blairgowrie', 'Crieff', 'Auchterarder', 'Pitlochry', 'Callander', 'Kinross',
    'Kirriemuir', 'Aberfeldy',
  ],
  'north-east': [
    'Aberdeen', 'Peterhead', 'Fraserburgh', 'Stonehaven', 'Ellon', 'Inverurie', 'Oldmeldrum',
    'Banff', 'Banchory', 'Ballater', 'Aboyne', 'Alness', 'Huntly', 'Keith', 'Fochabers',
    'Forres', 'Elgin', 'Lossiemouth', 'Buckie', 'Tain', 'Turriff', 'Invergordon',
  ],
  highlands: [
    'Inverness', 'Fort William', 'Aviemore', 'Nairn', 'Wick', 'Thurso', 'Dingwall', 'Dornoch',
    'Golspie', 'Ullapool', 'Kingussie', 'Fort Augustus', 'Fortrose', 'Kinlochleven', 'Mallaig',
    'Plockton', 'Findhorn',
  ],
  ayrshire: [
    'Ayr', 'Kilmarnock', 'Irvine', 'Troon', 'Prestwick', 'Kilwinning', 'Saltcoats', 'Ardrossan',
    'Stevenston', 'Largs', 'Girvan', 'Maybole', 'Stewarton', 'Galston', 'Newmilns', 'Darvel',
    'Cumnock', 'Kilbirnie', 'West Kilbride', 'Dalry',
  ],
  central: ['Stirling', 'Falkirk', 'Alloa', 'Denny', 'Bo\'ness', 'Dollar', 'Callander'],
  inverclyde: ['Greenock', 'Gourock', 'Port Glasgow', 'Wemyss Bay'],
  south: [
    'Dumfries', 'Stranraer', 'Annan', 'Lockerbie', 'Gretna', 'Sanquhar', 'Moffat', 'Castle Douglas',
    'Newton Stewart',
  ],
  borders: [
    'Galashiels', 'Hawick', 'Kelso', 'Jedburgh', 'Selkirk', 'Peebles', 'Innerleithen', 'Melrose',
    'Coldstream', 'Duns', 'Eyemouth', 'Coldstream', 'Jedforest',
  ],
  argyll: [
    'Oban', 'Dunoon', 'Campbeltown', 'Tarbert', 'Tobermory', 'Brodick', 'Helensburgh',
  ],
  islands: ['Kirkwall', 'Lerwick', 'Rothesay'],
}

/** @type {Record<string, string>} */
const CITY_REGION_MAP = (() => {
  /** @type {Record<string, string>} */
  const map = {}
  for (const [regionKey, cities] of Object.entries(REGION_CITY_GROUPS)) {
    for (const city of cities) {
      if (!map[city]) map[city] = regionKey
    }
  }
  return map
})()

/** Additional locations (merged with groups above). */
const ADDITIONAL_LOCATIONS = [
  'Biggar', 'Brechin', 'Dunbar', 'Alloa', 'Coatbridge', 'Wishaw', 'Renfrew', 'Elgin',
  'Forres', 'Nairn', 'Buckie', 'Lossiemouth', 'Peterhead', 'Fraserburgh', 'Stonehaven',
  'Montrose', 'Arbroath', 'Forfar', 'Crieff', 'Auchterarder', 'Oban', 'Fort William',
  'Aviemore', 'Wick', 'Thurso', 'Kirkwall', 'Lerwick', 'Dumfries', 'Galashiels', 'Irvine',
  'Arbroath', 'Musselburgh', 'Wishaw', 'Alloa', 'Bathgate', 'Blantyre', 'Bo\'ness',
  'Broxburn', 'Buckie', 'Burntisland', 'Carnoustie', 'Cowdenbeath', 'Dalkeith', 'Denny',
  'Dingwall', 'Dornoch', 'Forfar', 'Fraserburgh', 'Glenrothes', 'Hawick', 'Helensburgh',
  'Johnstone', 'Keith', 'Lanark', 'Largs', 'Leven', 'Linlithgow', 'Lockerbie', 'Montrose',
  'Nairn', 'Newton Mearns', 'Peterhead', 'Port Glasgow', 'Prestwick', 'Renfrew', 'Rothesay',
  'Selkirk', 'Shotts', 'St Andrews', 'Stonehaven', 'Stranraer', 'Thurso', 'Troon', 'Ullapool',
  'Wick', 'Aboyne', 'Alness', 'Annan', 'Ardrossan', 'Aviemore', 'Ballater', 'Banchory',
  'Banff', 'Barrhead', 'Biggar', 'Brechin', 'Campbeltown', 'Castle Douglas', 'Crieff', 'Cupar',
  'Dunbar', 'Ellon', 'Eyemouth', 'Forres', 'Girvan', 'Golspie', 'Gourock', 'Haddington',
  'Huntly', 'Invergordon', 'Jedburgh', 'Kelso', 'Kilwinning', 'Kinross', 'Kirriemuir',
  'Knightswood', 'Lochgelly', 'Lossiemouth', 'Moffat', 'Newburgh', 'North Berwick', 'Peebles',
  'Pitlochry', 'Queensferry', 'Rutherglen', 'Stenhousemuir', 'Tain', 'Tranent', 'Whitburn',
  'Alexandria', 'Armadale', 'Auchterarder', 'Balerno', 'Bellshill', 'Bonnyrigg', 'Carluke',
  'Coldstream', 'Cumnock', 'Darvel', 'Dollar', 'Duns', 'Erskine', 'Fochabers', 'Galston',
  'Gretna', 'Innerleithen', 'Inverurie', 'Jedforest', 'Kilbirnie', 'Kingussie', 'Kirkintilloch',
  'Lesmahagow', 'Maybole', 'Melrose', 'Milngavie', 'Newmilns', 'Oldmeldrum', 'Penicuik',
  'Pittenweem', 'Saltcoats', 'Sanquhar', 'Stewarton', 'Tobermory', 'West Kilbride', 'Whitehills',
  'Aberfeldy', 'Ballingry', 'Brodick', 'Callander', 'Dalry', 'Dunoon', 'Findhorn', 'Fort Augustus',
  'Fortrose', 'Kinlochleven', 'Mallaig', 'Newton Stewart', 'Plockton', 'Tarbert', 'Turriff',
  'Wemyss Bay', 'Yoker', 'Uddingston', 'Cambuslang', 'Larkhall', 'Stevenston', 'Blairgowrie',
]

/** @type {string[]} */
export const SCOTLAND_LOCATION_NAMES = (() => {
  const seen = new Set()
  /** @type {string[]} */
  const ordered = []
  const add = (name) => {
    const trimmed = String(name).trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    ordered.push(trimmed)
  }
  PRIORITY_SEO_CITIES.forEach(add)
  Object.values(REGION_CITY_GROUPS).flat().forEach(add)
  ADDITIONAL_LOCATIONS.forEach(add)
  return ordered
})()

/** Cities with dedicated man-with-van SEO routes. */
export const MAN_WITH_VAN_SEO_CITIES = [
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

/** Primary footer cities — keep the footer concise; full list lives on /coverage. */
export const FOOTER_PRIMARY_CITIES = [
  'Glasgow',
  'Edinburgh',
  'Aberdeen',
  'Dundee',
  'Inverness',
  'Paisley',
]

/** Display order for coverage page region groups. */
export const REGION_DISPLAY_ORDER = [
  'greater-glasgow',
  'edinburgh-lothians',
  'lanarkshire',
  'lothians',
  'fife',
  'tayside',
  'north-east',
  'highlands',
  'ayrshire',
  'central',
  'inverclyde',
  'south',
  'borders',
  'argyll',
  'islands',
  'scotland',
]

/** @param {string} cityName */
export function getLocationRegion(cityName) {
  const key = CITY_REGION_MAP[cityName] ?? 'scotland'
  return REGION_DEFINITIONS[key] ?? REGION_DEFINITIONS.scotland
}

/** @param {string} slug */
export function getLocationBySlug(slug) {
  const normalized = String(slug || '').trim().toLowerCase()
  const name = SCOTLAND_LOCATION_NAMES.find((n) => cityToSlug(n) === normalized)
  if (!name) return null
  const region = getLocationRegion(name)
  return {
    name,
    slug: cityToSlug(name),
    regionKey: region.key,
    region,
    removalsPath: `/${cityToSlug(name)}-removals`,
  }
}

/** @param {string} cityName */
export function getRemovalsPathForCity(cityName) {
  return `/${cityToSlug(cityName)}-removals`
}

/** Footer internal links — high-priority cities only (display name without "removals" suffix). */
export const FOOTER_SEO_LOCATION_LINKS = FOOTER_PRIMARY_CITIES.map((name) => ({
  to: `/${cityToSlug(name)}-removals`,
  label: name,
}))

/**
 * All Scotland SEO locations grouped by region for the coverage page.
 * @returns {{ regionKey: string, label: string, locations: { name: string, slug: string, href: string }[] }[]}
 */
export function getScotlandLocationsGroupedByRegion() {
  /** @type {Map<string, { regionKey: string, label: string, locations: { name: string, slug: string, href: string }[] }>} */
  const groups = new Map()

  for (const name of SCOTLAND_LOCATION_NAMES) {
    const region = getLocationRegion(name)
    if (!groups.has(region.key)) {
      groups.set(region.key, { regionKey: region.key, label: region.label, locations: [] })
    }
    const slug = cityToSlug(name)
    groups.get(region.key).locations.push({
      name,
      slug,
      href: `/${slug}-removals`,
    })
  }

  for (const group of groups.values()) {
    group.locations.sort((a, b) => a.name.localeCompare(b.name, 'en-GB'))
  }

  const ordered = REGION_DISPLAY_ORDER.filter((key) => groups.has(key)).map((key) => groups.get(key))
  for (const [key, group] of groups) {
    if (!REGION_DISPLAY_ORDER.includes(key)) ordered.push(group)
  }
  return ordered
}

/** @param {string} cityName @param {string} [excludeCity] @param {number} [limit] */
export function getNearbyLocationNames(cityName, excludeCity = cityName, limit = 6) {
  const region = getLocationRegion(cityName)
  const peers = SCOTLAND_LOCATION_NAMES.filter(
    (name) =>
      name !== excludeCity &&
      (CITY_REGION_MAP[name] === region.key || CITY_REGION_MAP[name] === CITY_REGION_MAP[cityName]),
  )
  if (peers.length >= limit) return peers.slice(0, limit)
  const idx = SCOTLAND_LOCATION_NAMES.indexOf(cityName)
  const filler = []
  if (idx >= 0) {
    for (let i = 1; filler.length + peers.length < limit && i < SCOTLAND_LOCATION_NAMES.length; i += 1) {
      const next = SCOTLAND_LOCATION_NAMES[(idx + i) % SCOTLAND_LOCATION_NAMES.length]
      if (next !== excludeCity && !peers.includes(next) && !filler.includes(next)) filler.push(next)
    }
  }
  return [...peers, ...filler].slice(0, limit)
}
