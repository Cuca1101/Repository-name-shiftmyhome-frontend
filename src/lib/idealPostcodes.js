/**
 * UK postcode lookup via Ideal Postcodes. Returns every delivery point, including the house number.
 * The key stays in VITE_IDEAL_POSTCODES_API_KEY and is never logged.
 */

const API_ROOT = 'https://api.ideal-postcodes.co.uk/v1'

export function hasIdealPostcodesKey() {
  return Boolean(String(import.meta.env.VITE_IDEAL_POSTCODES_API_KEY || '').trim())
}

function compactPostcode(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase()
}

function linesOf(address) {
  return [address.line_1, address.line_2, address.line_3].map((line) => String(line || '').trim()).filter(Boolean)
}

function formattedIdealAddress(address) {
  const tail = [address.post_town, address.postcode].filter(Boolean).join(' ')
  return [...linesOf(address), tail].filter(Boolean).join(', ')
}

function doorNumber(address) {
  return String(address.building_number || '').trim()
}

/**
 * @param {Record<string, unknown>} address
 * @param {number} index
 */
function toSuggestion(address, index) {
  const door = doorNumber(address)
  const street = String(address.thoroughfare || '').trim()
  const building = String(address.building_name || '').trim()
  const organisation = String(address.organisation_name || '').trim()
  const firstLine = String(address.line_1 || '').trim()
  const title = organisation || firstLine.replace(new RegExp(`^${door}\\s+`), '')
  const main = [title, building && building !== title ? building : ''].filter(Boolean).join(', ') || street || firstLine
  const secondary = [street, [address.post_town, address.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const lat = Number(address.latitude)
  const lng = Number(address.longitude)
  return {
    id: String(address.udprn || address.uprn || `${compactPostcode(address.postcode)}-${index}`),
    source: 'ideal',
    door,
    main,
    secondary,
    place: {
      formattedAddress: formattedIdealAddress(address),
      houseNumber: door,
      subpremise: String(address.sub_building_name || '').trim(),
      street,
      town: String(address.post_town || '').trim(),
      postcode: String(address.postcode || '').trim(),
      country: 'United Kingdom',
      placeId: String(address.udprn || ''),
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    },
  }
}

function doorSortValue(item) {
  const match = String(item.door || '').match(/\d+/)
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER
}

/**
 * Every address on a UK postcode, with the building number.
 * @param {string} postcode
 */
export async function lookupUkPostcode(postcode) {
  const key = String(import.meta.env.VITE_IDEAL_POSTCODES_API_KEY || '').trim()
  const compact = compactPostcode(postcode)
  if (!key || compact.length < 5) return []
  const response = await fetch(`${API_ROOT}/postcodes/${encodeURIComponent(compact)}?api_key=${encodeURIComponent(key)}`)
  const data = await response.json()
  if (data?.code === 4040) return []
  if (!response.ok || data?.code !== 2000) {
    throw new Error('Address lookup failed.')
  }
  return (data.result || [])
    .map(toSuggestion)
    .sort((a, b) => doorSortValue(a) - doorSortValue(b) || a.main.localeCompare(b.main))
}
