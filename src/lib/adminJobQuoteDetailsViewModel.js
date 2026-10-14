/**
 * Read-only display bundle for admin job / quote details UI.
 * Centralises parsing used by Job Details so header chips and body stay in sync.
 * Does not mutate quote data or perform pricing.
 */

import { PARKING_LABELS, WALKING_LABELS } from './emailQuotePayload'
import { SNAPSHOT_END, SNAPSHOT_START } from './adminPhoneBookingWizardSnapshot'
import {
  formatMoveArrivalSummary,
  formatVolumeAndCrew,
  mergeDetailSections,
  parseDetailsKeyValues,
  parsePricingText,
  parseWizardStructured,
  shortAddressLine,
} from './quoteJobAdminModel'

export const ACCESS_NOT_PROVIDED = 'Not provided'

const FLOOR_LABELS = {
  '-1': 'Basement',
  0: 'Ground floor',
  1: '1st Floor',
  2: '2nd Floor',
  3: '3rd Floor',
  4: '4th Floor',
  5: '5th Floor',
  6: '6th Floor',
  7: '7th Floor',
  8: '8th Floor',
  9: '9th Floor',
  10: '10+ Floors',
}

const ACCESS_FIELDS = [
  'propertyType',
  'floor',
  'lift',
  'parking',
  'carryDistance',
  'stairs',
  'accessNotes',
  'specialInstructions',
]

/** @param {unknown} v */
export function liftReadable(v) {
  const s = String(v ?? '').trim()
  if (!s || s === '—') return '—'
  const low = s.toLowerCase()
  if (low === 'yes' || low === 'y' || low === 'true' || low === '1') return 'Yes'
  if (low === 'no' || low === 'n' || low === 'false' || low === '0' || low === 'none') return 'No'
  return s
}

/**
 * Phone-booking JSON saved in details. Reads the raw wizard only — draft hydration
 * fills House / standard parking / 0 stairs, which must not appear as saved answers.
 * @param {unknown} details
 * @returns {Record<string, unknown> | null}
 */
function readRawPhoneBookingWizard(details) {
  const text = String(details ?? '')
  const start = text.indexOf(SNAPSHOT_START)
  if (start < 0) return null
  const end = text.indexOf(SNAPSHOT_END, start)
  if (end < 0) return null
  try {
    const parsed = JSON.parse(text.slice(start + SNAPSHOT_START.length, end).trim())
    const wizard = parsed?.wizard
    return wizard && typeof wizard === 'object' ? wizard : null
  } catch {
    return null
  }
}

/**
 * @param {Record<string, unknown> | null} wizard
 * @param {string} key
 * @returns {{ known: boolean, value: unknown }}
 */
function snapshotField(wizard, key) {
  if (!wizard || !Object.prototype.hasOwnProperty.call(wizard, key)) return { known: false, value: null }
  return { known: true, value: wizard[key] }
}

/** @param {unknown} value */
function meaningfulText(value) {
  if (value == null) return null
  const text = String(value).trim()
  if (!text || text === '—' || text === '-' || text === '–' || /^n\/a$/i.test(text)) return null
  return text
}

/** @param {unknown[]} values */
function firstText(...values) {
  for (const value of values) {
    const text = meaningfulText(value)
    if (text) return text
  }
  return null
}

/**
 * Snapshot wins when the key was saved, including 0 and false.
 * A missing key falls through to the enquiry text. Null / blank snapshot values stay absent.
 * @param {Record<string, unknown> | null} wizard
 * @param {string} key
 * @param {unknown[]} textValues
 */
function savedValue(wizard, key, ...textValues) {
  const snap = snapshotField(wizard, key)
  if (!snap.known) return firstText(...textValues)
  if (typeof snap.value === 'string') return meaningfulText(snap.value)
  if (snap.value == null) return null
  return snap.value
}

/** @param {unknown} value */
function formatFloorSaved(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return FLOOR_LABELS[value] || `${value} floor`
  const text = meaningfulText(value)
  if (!text) return null
  if (/^ground(\s+floor)?$/i.test(text)) return 'Ground floor'
  if (/^basement$/i.test(text)) return 'Basement'
  if (/^\d+$/.test(text) || text === '-1') return FLOOR_LABELS[Number(text)] || `${text} floor`
  return text
}

/** @param {unknown} value */
function formatLiftSaved(value) {
  if (value === true) return 'Lift available'
  if (value === false) return 'No lift'
  const text = meaningfulText(value)
  if (!text) return null
  const low = text.toLowerCase()
  if (low === 'yes' || low === 'y' || low === 'true' || low === '1' || low === 'lift available') return 'Lift available'
  if (low === 'no' || low === 'n' || low === 'false' || low === '0' || low === 'none' || low === 'no lift') {
    return 'No lift'
  }
  return text
}

/** @param {unknown} value */
function formatParkingSaved(value) {
  if (value == null) return null
  const code = typeof value === 'string' ? value.trim() : ''
  if (code && PARKING_LABELS[code]) return PARKING_LABELS[code]
  const text = meaningfulText(value)
  if (!text) return null
  if (/^yes$/i.test(text)) return 'Extended carry / awkward parking'
  if (/^no$/i.test(text)) return 'No extended carry'
  return PARKING_LABELS[text] || text
}

/** @param {unknown} value */
function formatCarrySaved(value) {
  if (value == null) return null
  const code = typeof value === 'string' ? value.trim() : ''
  if (code && WALKING_LABELS[code]) return WALKING_LABELS[code]
  const text = meaningfulText(value)
  if (!text) return null
  if (/^yes$/i.test(text)) return WALKING_LABELS.long
  if (/^no$/i.test(text)) return 'No long carry'
  return WALKING_LABELS[text] || text
}

/** @param {unknown} value */
function formatFlightsSaved(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value === 1 ? '1 flight' : `${value} flights`
  }
  const text = meaningfulText(value)
  if (!text) return null
  if (!/^-?\d+$/.test(text)) return text
  const n = Number(text)
  return n === 1 ? '1 flight' : `${n} flights`
}

/** @param {unknown[]} parts */
function joinSaved(...parts) {
  const lines = parts.map((part) => meaningfulText(part)).filter(Boolean)
  return lines.length ? lines.join('\n') : null
}

/** @param {unknown} value */
function displayAccess(value) {
  return value == null || value === '' ? ACCESS_NOT_PROVIDED : String(value)
}

/** @param {unknown} value */
function legacyDash(value) {
  return value == null || value === '' ? '—' : String(value)
}

/**
 * @param {Record<string, string>} side
 */
function sideAllMissing(side) {
  return ACCESS_FIELDS.every((key) => side[key] === ACCESS_NOT_PROVIDED)
}

function blankAccess() {
  const side = Object.fromEntries(ACCESS_FIELDS.map((key) => [key, ACCESS_NOT_PROVIDED]))
  return { allMissing: true, pickup: side, delivery: { ...side } }
}

/**
 * @param {Record<string, unknown>} q
 */
export function buildAdminJobQuoteDetailsViewModel(q) {
  if (!q || typeof q !== 'object') {
    return {
      kvFlat: {},
      distanceDisplay: '—',
      arrivalLine: '—',
      pickupType: '—',
      pickupFloor: '—',
      pickupLiftRaw: '—',
      deliveryType: '—',
      deliveryFloor: '—',
      deliveryLiftRaw: '—',
      parking: '—',
      walking: '—',
      stairs: '—',
      stairsNotes: '—',
      specialInstructions: '—',
      volumeLine: '—',
      crewDisplay: '—',
      paidLabel: 'unpaid',
      serviceLabel: '—',
      pickupAddress: '',
      deliveryAddress: '',
      pickupAddressShort: '—',
      deliveryAddressShort: '—',
      pickupCity: '—',
      deliveryCity: '—',
      pickupContact: '—',
      pickupContactPhone: '—',
      deliveryContact: '—',
      deliveryContactPhone: '—',
      pickupFlatDetails: '—',
      deliveryFlatDetails: '—',
      access: blankAccess(),
    }
  }

  const kvFlat = parseDetailsKeyValues(q.details)
  const sections = parseWizardStructured(q.details)
  const serviceSec = sections['Service'] || {}
  const pickupSec = sections['Pickup property & access'] || {}
  const deliverySec = sections['Delivery property & access'] || {}
  const accessCarry = sections['Access & carry (both ends factored in pricing)'] || {}
  const formAccess = mergeDetailSections(sections, ['Property / access'])

  const pricingParsed = parsePricingText(q.pricing)

  const distanceDisplay =
    q.distance_miles != null && String(q.distance_miles).trim() !== ''
      ? `${q.distance_miles} mi`
      : serviceSec['Route distance (miles)'] || kvFlat['Route distance (miles)'] || '—'

  const arrivalLine = formatMoveArrivalSummary(q, { ...kvFlat, ...serviceSec })

  // Access is stored in quotes.details (wizard text, and a phone-booking JSON snapshot).
  // fetchQuoteByIdForAdmin already selects the full row, so this is a mapping fix.
  const wizard = readRawPhoneBookingWizard(q.details)
  const sharedLiftText = formAccess['Lift available (pricing uses same value at both ends in this form)']
  const parkingSaved = formatParkingSaved(
    savedValue(
      wizard,
      'parkingDistance',
      accessCarry['Parking / vehicle access'],
      accessCarry['Parking'],
      formAccess['Awkward parking / extended carry'],
    ),
  )
  const carrySaved = formatCarrySaved(
    savedValue(
      wizard,
      'walkingDistance',
      accessCarry['Walking distance (van to door)'],
      accessCarry['Walking'],
      formAccess['Long walk / carry'],
    ),
  )
  const flightsSaved = formatFlightsSaved(
    savedValue(
      wizard,
      'stairsFlights',
      accessCarry['Flights of stairs (estimate)'],
      formAccess['Stairs flights (estimate)'],
    ),
  )
  const stairsNotesSaved = savedValue(wizard, 'stairsNotes', accessCarry['Stairs & access notes'])
  const heavyNotesSaved = savedValue(wizard, 'heavyNotes', accessCarry['Heavy / bulky items notes'])
  const specialSaved = savedValue(
    wizard,
    'specialInstructions',
    accessCarry['Special instructions'],
    kvFlat['Special instructions'],
    serviceSec['Special instructions'],
    kvFlat['Customer notes'],
    kvFlat['Free-text message'],
  )
  const stairsSaved = joinSaved(flightsSaved, stairsNotesSaved)

  const pickupTypeSaved = savedValue(wizard, 'pickupPropertyType', pickupSec['Property type'])
  const deliveryTypeSaved = savedValue(wizard, 'deliveryPropertyType', deliverySec['Property type'])
  const pickupFloorSaved = formatFloorSaved(
    savedValue(wizard, 'pickupFloor', pickupSec.Floor, pickupSec['Pickup floor'], formAccess['Pickup floor']),
  )
  const deliveryFloorSaved = formatFloorSaved(
    savedValue(wizard, 'deliveryFloor', deliverySec.Floor, deliverySec['Delivery floor'], formAccess['Delivery floor']),
  )
  const pickupLiftSaved = formatLiftSaved(
    savedValue(wizard, 'pickupLift', pickupSec.Lift, pickupSec['Pickup lift'], sharedLiftText),
  )
  const deliveryLiftSaved = formatLiftSaved(
    savedValue(wizard, 'deliveryLift', deliverySec.Lift, deliverySec['Delivery lift'], sharedLiftText),
  )
  const pickupNotesSaved = joinSaved(
    savedValue(wizard, 'pickupFlatDetails', kvFlat['Pickup access notes']),
    heavyNotesSaved,
  )
  const deliveryNotesSaved = joinSaved(
    savedValue(wizard, 'deliveryFlatDetails', kvFlat['Delivery access notes']),
    heavyNotesSaved,
  )

  const pickupAccess = {
    propertyType: displayAccess(pickupTypeSaved),
    floor: displayAccess(pickupFloorSaved),
    lift: displayAccess(pickupLiftSaved),
    parking: displayAccess(parkingSaved),
    carryDistance: displayAccess(carrySaved),
    stairs: displayAccess(stairsSaved),
    accessNotes: displayAccess(pickupNotesSaved),
    specialInstructions: displayAccess(specialSaved),
  }
  const deliveryAccess = {
    propertyType: displayAccess(deliveryTypeSaved),
    floor: displayAccess(deliveryFloorSaved),
    lift: displayAccess(deliveryLiftSaved),
    parking: displayAccess(parkingSaved),
    carryDistance: displayAccess(carrySaved),
    stairs: displayAccess(stairsSaved),
    accessNotes: displayAccess(deliveryNotesSaved),
    specialInstructions: displayAccess(specialSaved),
  }

  const pickupType = legacyDash(pickupTypeSaved)
  const pickupFloor = legacyDash(pickupFloorSaved)
  const pickupLiftRaw = pickupLiftSaved === 'Lift available' ? 'Yes' : pickupLiftSaved === 'No lift' ? 'No' : '—'
  const deliveryType = legacyDash(deliveryTypeSaved)
  const deliveryFloor = legacyDash(deliveryFloorSaved)
  const deliveryLiftRaw = deliveryLiftSaved === 'Lift available' ? 'Yes' : deliveryLiftSaved === 'No lift' ? 'No' : '—'
  const parking = legacyDash(parkingSaved)
  const walking = legacyDash(carrySaved)
  const stairs = legacyDash(flightsSaved)
  const stairsNotes = legacyDash(stairsNotesSaved)
  const specialInstructions = legacyDash(specialSaved)

  const volumeLine =
    pricingParsed.volumeM3 != null
      ? `${pricingParsed.volumeM3.toFixed(2)} m³`
      : q.total_cubic_metres != null && Number(q.total_cubic_metres) > 0
        ? `${Number(q.total_cubic_metres).toFixed(2)} m³`
        : formatVolumeAndCrew(q).split('·')[0]?.trim() || '—'

  const crewDisplay =
    q.crew_size != null && Number(q.crew_size) > 0 ? String(q.crew_size) : serviceSec['Crew size'] || '—'

  const paidLabel = String(q.payment_status || 'unpaid').replace(/_/g, ' ')

  const serviceLabel = q.service || q.service_type || serviceSec['Selected service'] || '—'

  const pickupAddress = String(q.pickup_address || '').trim()
  const deliveryAddress = String(q.delivery_address || '').trim()

  const pickupCity = cityFromAddress(pickupAddress)
  const deliveryCity = cityFromAddress(deliveryAddress)

  return {
    kvFlat,
    distanceDisplay,
    arrivalLine,
    pickupType,
    pickupFloor,
    pickupLiftRaw,
    deliveryType,
    deliveryFloor,
    deliveryLiftRaw,
    parking,
    walking,
    stairs,
    stairsNotes,
    specialInstructions,
    volumeLine,
    crewDisplay,
    paidLabel,
    serviceLabel,
    pickupAddress,
    deliveryAddress,
    pickupAddressShort: pickupAddress ? shortAddressLine(pickupAddress, 42) : '—',
    deliveryAddressShort: deliveryAddress ? shortAddressLine(deliveryAddress, 42) : '—',
    pickupCity,
    deliveryCity,
    pickupContact: kvFlat['Pickup contact'] || kvFlat['Pickup contact name'] || '—',
    pickupContactPhone: kvFlat['Pickup phone'] || '—',
    deliveryContact: kvFlat['Delivery contact'] || kvFlat['Delivery contact name'] || '—',
    deliveryContactPhone: kvFlat['Delivery phone'] || '—',
    pickupFlatDetails: legacyDash(savedValue(wizard, 'pickupFlatDetails', kvFlat['Pickup access notes'])),
    deliveryFlatDetails: legacyDash(savedValue(wizard, 'deliveryFlatDetails', kvFlat['Delivery access notes'])),
    access: {
      allMissing: sideAllMissing(pickupAccess) && sideAllMissing(deliveryAccess),
      pickup: pickupAccess,
      delivery: deliveryAccess,
    },
  }
}

/**
 * @param {string} address
 */
function cityFromAddress(address) {
  const s = String(address || '').trim()
  if (!s) return '—'
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2]
    if (candidate && !/^[A-Z]{1,2}\d/i.test(candidate)) return candidate
  }
  return parts[0] || '—'
}
