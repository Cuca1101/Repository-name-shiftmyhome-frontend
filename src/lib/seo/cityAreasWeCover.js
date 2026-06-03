/**
 * Suburb and nearby-area lists for priority city removal pages.
 * Used by SeoLandingPage "Areas We Cover" and static prerender HTML.
 */

import { cityToSlug } from '../citySlug.js'

/** @typedef {{ name: string, href: string }} CityAreaLink */

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
  ],
  Edinburgh: [
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
