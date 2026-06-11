import { COVERAGE_AREAS } from '../coverageAreas.js'

/** @type {Record<string, { lng: number, lat: number, zoom?: number }>} */
const EXTRA_CITY_CENTERS = {
  Ayr: { lng: -4.633, lat: 55.458 },
  Perth: { lng: -3.437, lat: 56.395 },
  Kilmarnock: { lng: -4.499, lat: 55.611 },
  'East Kilbride': { lng: -4.176, lat: 55.764 },
  Hamilton: { lng: -4.039, lat: 55.778 },
  Motherwell: { lng: -3.992, lat: 55.789 },
  Cumbernauld: { lng: -3.99, lat: 55.946 },
  Dunfermline: { lng: -3.452, lat: 56.071 },
  Kirkcaldy: { lng: -3.159, lat: 56.111 },
  Greenock: { lng: -4.761, lat: 55.948 },
  Irvine: { lng: -4.655, lat: 55.619 },
  Glenrothes: { lng: -3.175, lat: 56.195 },
  Coatbridge: { lng: -4.024, lat: 55.861 },
  Airdrie: { lng: -3.98, lat: 55.866 },
  Wishaw: { lng: -3.926, lat: 55.773 },
  Dumfries: { lng: -3.611, lat: 55.07 },
  Galashiels: { lng: -2.813, lat: 55.619 },
  'St Andrews': { lng: -2.8, lat: 56.339 },
  Oban: { lng: -5.472, lat: 56.415 },
  'Fort William': { lng: -5.105, lat: 56.82 },
  Aviemore: { lng: -3.828, lat: 57.189 },
  Peterhead: { lng: -1.785, lat: 57.508 },
  Elgin: { lng: -3.321, lat: 57.649 },
  Forres: { lng: -3.609, lat: 57.61 },
  Wick: { lng: -3.288, lat: 58.441 },
  Thurso: { lng: -3.525, lat: 58.593 },
  Kirkwall: { lng: -2.959, lat: 58.984 },
  Lerwick: { lng: -1.145, lat: 60.153 },
  Troon: { lng: -4.663, lat: 55.541 },
  Prestwick: { lng: -4.614, lat: 55.495 },
  Musselburgh: { lng: -3.053, lat: 55.942 },
  Bathgate: { lng: -3.632, lat: 55.902 },
  Linlithgow: { lng: -3.604, lat: 55.979 },
  Alloa: { lng: -3.789, lat: 56.115 },
  Cupar: { lng: -3.011, lat: 56.319 },
  Arbroath: { lng: -2.581, lat: 56.559 },
  Montrose: { lng: -2.467, lat: 56.713 },
  Stonehaven: { lng: -2.208, lat: 56.964 },
  Inverurie: { lng: -2.374, lat: 57.284 },
  Nairn: { lng: -3.868, lat: 57.586 },
  Dingwall: { lng: -4.427, lat: 57.595 },
  Helensburgh: { lng: -4.726, lat: 56.006 },
  Dumbarton: { lng: -4.571, lat: 55.944 },
  Clydebank: { lng: -4.405, lat: 55.904 },
  Renfrew: { lng: -4.392, lat: 55.877 },
  Johnstone: { lng: -4.516, lat: 55.834 },
  Barrhead: { lng: -4.389, lat: 55.797 },
  Bearsden: { lng: -4.332, lat: 55.917 },
  Milngavie: { lng: -4.315, lat: 55.941 },
  Bishopbriggs: { lng: -4.226, lat: 55.904 },
  'Newton Mearns': { lng: -4.334, lat: 55.771 },
  Rutherglen: { lng: -4.214, lat: 55.828 },
  Penicuik: { lng: -3.225, lat: 55.831 },
  Dalkeith: { lng: -3.065, lat: 55.893 },
  Haddington: { lng: -2.778, lat: 55.957 },
  'North Berwick': { lng: -2.716, lat: 56.058 },
  Hawick: { lng: -2.789, lat: 55.422 },
  Kelso: { lng: -2.434, lat: 55.598 },
  Peebles: { lng: -3.188, lat: 55.652 },
  Stranraer: { lng: -5.027, lat: 54.903 },
  Largs: { lng: -4.869, lat: 55.793 },
  Broxburn: { lng: -3.471, lat: 55.934 },
  Livingston: { lng: -3.5226, lat: 55.9024 },
}

const SCOTLAND_OVERVIEW = { lng: -4.2, lat: 56.5, zoom: 6, radiusKm: 0 }

/**
 * @param {string} cityName
 * @returns {{ lng: number, lat: number, zoom: number, radiusKm: number } | null}
 */
export function getStaticSeoCityCenter(cityName) {
  const name = String(cityName || '').trim()
  if (!name || name === 'Scotland') return SCOTLAND_OVERVIEW

  const fromCoverage = COVERAGE_AREAS.find((a) => a.name.toLowerCase() === name.toLowerCase())
  if (fromCoverage) {
    return { lng: fromCoverage.lng, lat: fromCoverage.lat, zoom: 11.2, radiusKm: 8 }
  }

  const extra = EXTRA_CITY_CENTERS[name]
  if (extra) {
    return { lng: extra.lng, lat: extra.lat, zoom: extra.zoom ?? 11.2, radiusKm: 7 }
  }

  return null
}

/** @param {string} cityName */
export function buildSeoCityGeocodeQuery(cityName) {
  const name = String(cityName || '').trim()
  if (!name || name === 'Scotland') return 'Scotland, United Kingdom'
  return `${name}, Scotland, United Kingdom`
}
