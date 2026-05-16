/**
 * Read-only display bundle for admin job / quote details UI.
 * Centralises parsing used by Job Details so header chips and body stay in sync.
 * Does not mutate quote data or perform pricing.
 */

import {
  formatMoveArrivalSummary,
  formatVolumeAndCrew,
  mergeDetailSections,
  parseDetailsKeyValues,
  parsePricingText,
  parseWizardStructured,
  shortAddressLine,
} from './quoteJobAdminModel'

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

  const pickupType = pickupSec['Property type'] || '—'
  const pickupFloor = pickupSec.Floor ?? formAccess['Pickup floor'] ?? '—'
  const pickupLiftRaw =
    pickupSec.Lift ?? formAccess['Lift available (pricing uses same value at both ends in this form)'] ?? '—'

  const deliveryType = deliverySec['Property type'] || '—'
  const deliveryFloor = deliverySec.Floor ?? formAccess['Delivery floor'] ?? '—'
  const deliveryLiftRaw =
    deliverySec.Lift ?? formAccess['Lift available (pricing uses same value at both ends in this form)'] ?? '—'

  const parking =
    accessCarry['Parking / vehicle access'] ||
    (formAccess['Awkward parking / extended carry'] ? 'Awkward / extended' : '—')
  const walking =
    accessCarry['Walking distance (van to door)'] ||
    (formAccess['Long walk / carry'] === 'Yes' ? 'Long walk' : '—')
  const stairs = accessCarry['Flights of stairs (estimate)'] || formAccess['Stairs flights (estimate)'] || '—'
  const stairsNotes = accessCarry['Stairs & access notes'] || '—'
  const specialInstructions =
    [kvFlat['Special instructions'], serviceSec['Special instructions'], accessCarry['Special instructions']]
      .filter(Boolean)
      .join('\n\n') || '—'

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
  }
}
