/**
 * Google Places API (New) via the Maps JavaScript loader.
 * Address search only. Driving routes stay on Mapbox.
 */

const MIN_QUERY_LENGTH = 3

/** Scotland bounds. Bias only — addresses elsewhere in the UK can still be returned. */
const SCOTLAND_BIAS = {
  south: 54.63,
  west: -7.65,
  north: 60.86,
  east: -0.73,
}

const PLACE_FIELDS = ['id', 'formattedAddress', 'addressComponents', 'location']
const ADDRESS_RESULT_TYPES = ['street_address', 'premise', 'subpremise']
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i

/** @type {Promise<google.maps.PlacesLibrary | Record<string, unknown>> | null} */
let placesLibraryPromise = null

export function hasGoogleMapsKey() {
  return Boolean(String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim())
}

/**
 * Install Google's importLibrary bootstrap once. Does not log the key.
 * @param {string} key
 */
function installMapsBootstrap(key) {
  const maps = window.google?.maps
  if (maps?.importLibrary) return

  const params = { key, v: 'weekly' }
  const callbackQueue = '__ib__'
  const importName = 'importLibrary'
  let loadPromise
  const queuedLibraries = new Set()
  const search = new URLSearchParams()
  const root = window.google || (window.google = {})
  const mapsNs = root.maps || (root.maps = {})

  const load = () =>
    loadPromise ||
    (loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      search.set('libraries', [...queuedLibraries].join(','))
      for (const name of Object.keys(params)) {
        const wireName = name.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)
        search.set(wireName, params[name])
      }
      search.set('callback', `google.maps.${callbackQueue}`)
      script.src = `https://maps.googleapis.com/maps/api/js?${search.toString()}`
      script.async = true
      script.onerror = () => reject(new Error('Google Maps could not load.'))
      mapsNs[callbackQueue] = resolve
      document.head.append(script)
    }))

  if (!mapsNs[importName]) {
    mapsNs[importName] = (library, ...rest) => {
      queuedLibraries.add(library)
      return load().then(() => mapsNs[importName](library, ...rest))
    }
  }
}

/**
 * @returns {Promise<Record<string, unknown>>}
 */
export function loadGooglePlaces() {
  if (!hasGoogleMapsKey()) {
    return Promise.reject(new Error('Google Maps API key is not configured.'))
  }
  if (!placesLibraryPromise) {
    placesLibraryPromise = (async () => {
      const key = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim()
      installMapsBootstrap(key)
      return window.google.maps.importLibrary('places')
    })().catch((error) => {
      placesLibraryPromise = null
      throw error
    })
  }
  return placesLibraryPromise
}

/**
 * One token per typing session. fetchFields on the chosen place ends the session.
 * @returns {Promise<google.maps.places.AutocompleteSessionToken>}
 */
export async function createAddressSessionToken() {
  const { AutocompleteSessionToken } = await loadGooglePlaces()
  return new AutocompleteSessionToken()
}

/**
 * @param {import('google.maps').places.PlacePrediction | undefined} prediction
 */
export function predictionLabel(prediction) {
  const full = prediction?.text?.text || ''
  if (full) return full
  const main = prediction?.mainText?.text || ''
  const secondary = prediction?.secondaryText?.text || ''
  return [main, secondary].filter(Boolean).join(', ')
}

/**
 * @param {string} input
 * @param {google.maps.places.AutocompleteSessionToken} sessionToken
 */
/**
 * @param {string} query
 * @param {google.maps.places.AutocompleteSessionToken} sessionToken
 * @param {string[] | undefined} includedPrimaryTypes
 */
async function fetchAddressSuggestions(query, sessionToken, includedPrimaryTypes) {
  const { AutocompleteSuggestion } = await loadGooglePlaces()
  const request = {
    input: query,
    sessionToken,
    includedRegionCodes: ['gb'],
    locationBias: SCOTLAND_BIAS,
    language: 'en-GB',
    region: 'gb',
  }
  if (includedPrimaryTypes) request.includedPrimaryTypes = includedPrimaryTypes
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request)
  return (suggestions || [])
    .map((suggestion) => {
      const prediction = suggestion.placePrediction
      if (!prediction) return null
      const label = predictionLabel(prediction)
      const id = prediction.placeId || label
      if (!label) return null
      return { id, label, prediction }
    })
    .filter(Boolean)
}

/**
 * Postcode-only hits have no door number. Keep street addresses that include one.
 * @param {{ label: string, prediction?: { types?: string[], mainText?: { text?: string } } }} item
 */
function hasHouseNumber(item) {
  const types = item.prediction?.types || []
  if (types.includes('postal_code') && !types.some((type) => ADDRESS_RESULT_TYPES.includes(type))) {
    return false
  }
  const main = item.prediction?.mainText?.text || item.label || ''
  return /\d/.test(main) || types.some((type) => ADDRESS_RESULT_TYPES.includes(type))
}

export async function suggestUkAddresses(input, sessionToken) {
  const query = String(input || '').trim()
  if (query.length < MIN_QUERY_LENGTH || !sessionToken) return []
  const addressed = await fetchAddressSuggestions(query, sessionToken, ADDRESS_RESULT_TYPES)
  const list = addressed.length > 0 ? addressed : await fetchAddressSuggestions(query, sessionToken)
  return list.filter(hasHouseNumber)
}

function isPostalCodeOnly(item) {
  const types = item.prediction?.types || []
  return types.includes('postal_code') && !types.some((type) => type === 'route' || ADDRESS_RESULT_TYPES.includes(type))
}

/** Street matches, including ones with no door number. The form asks for that number. */
export async function suggestUkStreets(input, sessionToken) {
  const query = String(input || '').trim()
  if (query.length < MIN_QUERY_LENGTH || !sessionToken) return []
  const list = await fetchAddressSuggestions(query, sessionToken)
  const streets = list.filter((item) => !isPostalCodeOnly(item))
  return streets.length > 0 ? streets : list
}

export function isUkPostcodeQuery(value) {
  return UK_POSTCODE.test(String(value || '').trim())
}

/**
 * @param {Array<{ longText?: string, shortText?: string, types?: string[] }> | undefined} components
 * @param {string} type
 */
function componentText(components, type) {
  const match = (components || []).find((part) => Array.isArray(part.types) && part.types.includes(type))
  return match?.longText || match?.shortText || ''
}

/**
 * @param {google.maps.places.Place} place
 */
export function parseGooglePlace(place) {
  const components = place?.addressComponents || []
  const location = place?.location
  const lat = typeof location?.lat === 'function' ? location.lat() : location?.lat
  const lng = typeof location?.lng === 'function' ? location.lng() : location?.lng
  return {
    formattedAddress: place?.formattedAddress || '',
    houseNumber: componentText(components, 'street_number'),
    subpremise: componentText(components, 'subpremise'),
    street: componentText(components, 'route'),
    town:
      componentText(components, 'postal_town') ||
      componentText(components, 'locality') ||
      componentText(components, 'administrative_area_level_2'),
    postcode: componentText(components, 'postal_code'),
    country: componentText(components, 'country'),
    placeId: place?.id || '',
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  }
}

/**
 * Ends the autocomplete session (Place.fetchFields).
 * @param {google.maps.places.PlacePrediction} prediction
 */
export async function placeFromPrediction(prediction) {
  const place = prediction.toPlace()
  await place.fetchFields({ fields: PLACE_FIELDS })
  return parseGooglePlace(place)
}

/**
 * Manual fallback when the customer does not pick a suggestion.
 * @param {string} query
 */
export async function findUkAddressByText(query) {
  const text = String(query || '').trim()
  if (text.length < MIN_QUERY_LENGTH || !hasGoogleMapsKey()) return null
  const { Place } = await loadGooglePlaces()
  const { places } = await Place.searchByText({
    textQuery: text,
    fields: PLACE_FIELDS,
    region: 'gb',
    language: 'en-GB',
    locationBias: SCOTLAND_BIAS,
    maxResultCount: 1,
  })
  const place = places?.[0]
  if (!place) return null
  return parseGooglePlace(place)
}

/**
 * Wizard fields cleared when the typed address no longer matches a selected place.
 * @param {'pickup' | 'delivery'} prefix
 */
export function emptyAddressPlacePatch(prefix) {
  return {
    [`${prefix}PlaceId`]: '',
    [`${prefix}HouseNumber`]: '',
    [`${prefix}Street`]: '',
    [`${prefix}Town`]: '',
    [`${prefix}Postcode`]: '',
    [`${prefix}Country`]: '',
  }
}

/**
 * Door number and street first, so the saved line is not only the postcode.
 * @param {ReturnType<typeof parseGooglePlace>} place
 */
export function formatAddressWithHouseNumber(place) {
  const doorNumber = [place.subpremise, place.houseNumber]
    .filter((part, index, all) => part && all.indexOf(part) === index)
    .join(', ')
  const door = [doorNumber, place.street].filter(Boolean).join(' ')
  if (!doorNumber || !door) return place.formattedAddress || door
  const locality = [place.town, place.postcode].filter(Boolean).join(' ')
  return [door, locality].filter(Boolean).join(', ')
}

/**
 * @param {'pickup' | 'delivery'} prefix
 * @param {ReturnType<typeof parseGooglePlace>} place
 * @param {{ keepTypedAddress?: boolean, typedAddress?: string }} [opts]
 */
export function addressPlacePatch(prefix, place, opts = {}) {
  const formatted = opts.keepTypedAddress
    ? opts.typedAddress || place.formattedAddress || ''
    : formatAddressWithHouseNumber(place) || place.formattedAddress || opts.typedAddress || ''
  return {
    [`${prefix}Address`]: opts.keepTypedAddress ? opts.typedAddress || formatted : formatted,
    [`${prefix}Lng`]: place.lng,
    [`${prefix}Lat`]: place.lat,
    [`${prefix}PlaceId`]: place.placeId,
    [`${prefix}HouseNumber`]: place.houseNumber,
    [`${prefix}Street`]: place.street,
    [`${prefix}Town`]: place.town,
    [`${prefix}Postcode`]: place.postcode,
    [`${prefix}Country`]: place.country,
  }
}

export const GOOGLE_ADDRESS_MIN_QUERY = MIN_QUERY_LENGTH
