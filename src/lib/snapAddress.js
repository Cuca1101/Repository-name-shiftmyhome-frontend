/**
 * UK postcode lookup via SnapAddress. The API key stays in the Supabase secret
 * SNAPADDRESS_API_KEY and is never sent to the browser.
 */
import { supabase } from './supabaseClient'

function compactPostcode(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase()
}

function doorNumber(address) {
  const parts = String(address.formatted_address || '')
    .split(',')
    .map((part) => part.trim())
  const line = parts.find((part) => /^\d+[A-Za-z]?\s+\S/.test(part))
  return line?.match(/^(\d+[A-Za-z]?)/)?.[1] || ''
}

function streetName(address, door) {
  const parts = String(address.formatted_address || '')
    .split(',')
    .map((part) => part.trim())
  const line = parts.find((part) => door && part.startsWith(`${door} `))
  if (line) return line.slice(door.length).trim()
  return String(address.line_2 || address.line_1 || '').trim()
}

function doorSortValue(item) {
  const match = String(item.door || '').match(/\d+/)
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER
}

/**
 * @param {Record<string, string>} address
 * @param {number} index
 */
function toSuggestion(address, index) {
  const door = doorNumber(address)
  const formatted = String(address.formatted_address || '').trim()
  const street = streetName(address, door)
  return {
    id: String(address.udprn || `${compactPostcode(address.postcode)}-${index}`),
    source: 'snap',
    door,
    main: formatted,
    secondary: '',
    place: {
      source: 'snap',
      formattedAddress: formatted,
      houseNumber: door,
      subpremise: '',
      street,
      town: String(address.town || '').trim(),
      postcode: String(address.postcode || '').trim(),
      country: 'United Kingdom',
      placeId: String(address.udprn || ''),
      lat: null,
      lng: null,
    },
  }
}

/** SnapAddress is called through the server function, so the quote form can list doors. */
export function hasSnapPostcodeLookup() {
  return Boolean(supabase)
}

/**
 * Partial postcode, street, or building search. Postcode groups are expanded
 * by a later full postcode lookup so the customer can still pick a door.
 * @param {string} query
 */
export async function suggestSnapAddresses(query) {
  if (!supabase) throw new Error('Address lookup failed.')
  const text = String(query || '').trim()
  if (text.length < 2) return []
  const { data, error } = await supabase.functions.invoke('lookup-uk-postcode', {
    body: { q: text },
  })
  if (error || data?.error) throw new Error('Address lookup failed.')
  return (data?.suggestions || []).map((item, index) => {
    const postcode = String(item.postcode || '').trim()
    const summary = String(item.summary || postcode).trim()
    const count = Number(item.address_count) || 0
    if (count > 1) {
      return {
        id: `group:${postcode}:${index}`,
        source: 'snap-group',
        door: '',
        main: summary,
        secondary: `${count} addresses`,
        postcode,
        place: null,
      }
    }
    const door = doorNumber({ formatted_address: summary })
    return {
      id: `addr:${postcode}:${index}`,
      source: 'snap',
      door,
      main: summary,
      secondary: '',
      place: {
        source: 'snap',
        formattedAddress: summary,
        houseNumber: door,
        subpremise: '',
        street: streetName({ formatted_address: summary, line_1: '', line_2: '' }, door),
        town: '',
        postcode,
        country: 'United Kingdom',
        placeId: '',
        lat: null,
        lng: null,
      },
    }
  })
}

/**
 * Every address on a UK postcode, including the building number.
 * @param {string} postcode
 */
export async function lookupSnapPostcode(postcode) {
  if (!supabase) throw new Error('Address lookup failed.')
  const { data, error } = await supabase.functions.invoke('lookup-uk-postcode', {
    body: { postcode: String(postcode || '').trim() },
  })
  if (error || data?.error) throw new Error('Address lookup failed.')
  return (data?.addresses || [])
    .map(toSuggestion)
    .filter((item) => item.place.formattedAddress)
    .sort((a, b) => doorSortValue(a) - doorSortValue(b) || a.main.localeCompare(b.main))
}
