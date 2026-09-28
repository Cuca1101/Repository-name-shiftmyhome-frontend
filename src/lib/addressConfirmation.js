/**
 * Pickup/delivery address confirmation helpers (quote wizard + admin phone booking).
 */

import { findUkAddressByText, hasGoogleMapsKey } from './googlePlaces'

const HAS_MAPBOX_TOKEN = Boolean(import.meta.env.VITE_MAPBOX_TOKEN)

/** Minimum trimmed length for an address to be considered present. */
export const MIN_ADDRESS_TEXT_LENGTH = 3

/** Manual entry without Mapbox coords — allow confirm when text looks complete. */
export const MIN_MANUAL_ADDRESS_LENGTH = 8

export function hasMapboxToken() {
  return HAS_MAPBOX_TOKEN
}

/**
 * @param {string | null | undefined} address
 */
export function isAddressTextPresent(address) {
  return String(address || '').trim().length > MIN_ADDRESS_TEXT_LENGTH
}

/**
 * @param {Record<string, unknown>} wizard
 * @param {boolean} [hasMapbox]
 */
export function canConfirmPickupAddress(wizard, hasMapbox = HAS_MAPBOX_TOKEN) {
  const text = String(wizard.pickupAddress || '').trim()
  if (text.length <= MIN_ADDRESS_TEXT_LENGTH) return false
  if (!hasMapbox) return true
  if (wizard.pickupLng != null && wizard.pickupLat != null) return true
  return text.length >= MIN_MANUAL_ADDRESS_LENGTH
}

/**
 * @param {Record<string, unknown>} wizard
 * @param {boolean} [hasMapbox]
 */
export function canConfirmDeliveryAddress(wizard, hasMapbox = HAS_MAPBOX_TOKEN) {
  const text = String(wizard.deliveryAddress || '').trim()
  if (text.length <= MIN_ADDRESS_TEXT_LENGTH) return false
  if (!hasMapbox) return true
  if (wizard.deliveryLng != null && wizard.deliveryLat != null) return true
  return text.length >= MIN_MANUAL_ADDRESS_LENGTH
}

/**
 * When an address string changes, clear only that side's confirmation flag.
 * @param {Record<string, unknown>} prev
 * @param {Record<string, unknown>} next
 */
export function applyAddressChangeConfirmationReset(prev, next) {
  const out = { ...next }
  if (String(prev.pickupAddress ?? '') !== String(next.pickupAddress ?? '')) {
    out.pickupAddressConfirmed = false
  }
  if (String(prev.deliveryAddress ?? '') !== String(next.deliveryAddress ?? '')) {
    out.deliveryAddressConfirmed = false
  }
  return out
}

/**
 * Auto-confirm geocoded addresses (e.g. when admin reaches review step).
 * @param {Record<string, unknown>} wizard
 */
export function autoConfirmGeocodedAddresses(wizard) {
  const patch = {}
  if (!wizard.pickupAddressConfirmed && canConfirmPickupAddress(wizard)) {
    if (wizard.pickupLng != null && wizard.pickupLat != null) {
      patch.pickupAddressConfirmed = true
    }
  }
  if (!wizard.deliveryAddressConfirmed && canConfirmDeliveryAddress(wizard)) {
    if (wizard.deliveryLng != null && wizard.deliveryLat != null) {
      patch.deliveryAddressConfirmed = true
    }
  }
  if (Object.keys(patch).length === 0) return wizard
  return { ...wizard, ...patch }
}

/**
 * Look up a typed address with Google Places. Returns null when Places has no match.
 * A missing match must not block a booking — the caller keeps the typed text.
 * @param {string} addressText
 * @returns {Promise<import('./googlePlaces.js').parseGooglePlace | null>}
 */
export async function geocodeTypedWizardAddress(addressText) {
  const text = String(addressText || '').trim()
  if (!hasGoogleMapsKey() || text.length < MIN_MANUAL_ADDRESS_LENGTH) return null
  try {
    return await findUkAddressByText(text)
  } catch {
    return null
  }
}

/**
 * Fill missing pickup/delivery coordinates from typed addresses via Google Places.
 * If Places cannot find an address, the typed text is kept and the step can continue.
 * @param {Record<string, unknown>} wizard
 * @returns {Promise<{ ok: boolean, wizard: Record<string, unknown>, errors: { field: string, message: string }[] }>}
 */
export async function resolveWizardMissingAddressCoords(wizard) {
  if (!hasGoogleMapsKey()) return { ok: true, wizard, errors: [] }

  /** @type {Record<string, unknown>} */
  const patch = {}
  /** @type {{ field: string, message: string }[]} */
  const errors = []

  /**
   * @param {string | undefined} text
   * @param {unknown} lng
   * @param {unknown} lat
   * @param {string} lngKey
   * @param {string} latKey
   * @param {string} confirmedKey
   * @param {string} field
   * @param {string} label
   */
  async function resolveSide(text, lng, lat, lngKey, latKey, confirmedKey, field, label) {
    if (lng != null && lat != null) return
    const trimmed = String(text || '').trim()
    if (trimmed.length <= MIN_ADDRESS_TEXT_LENGTH) {
      errors.push({ field, message: `${label} is required.` })
      return
    }
    if (trimmed.length < MIN_MANUAL_ADDRESS_LENGTH) {
      errors.push({
        field,
        message: `Enter a full ${label.toLowerCase()} (at least ${MIN_MANUAL_ADDRESS_LENGTH} characters).`,
      })
      return
    }
    const hit = await geocodeTypedWizardAddress(trimmed)
    if (!hit || hit.lng == null || hit.lat == null) return
    const side = field === 'deliveryAddress' ? 'delivery' : 'pickup'
    patch[`${side}Address`] = trimmed
    patch[lngKey] = hit.lng
    patch[latKey] = hit.lat
    patch[`${side}PlaceId`] = hit.placeId
    patch[`${side}HouseNumber`] = hit.houseNumber
    patch[`${side}Street`] = hit.street
    patch[`${side}Town`] = hit.town
    patch[`${side}Postcode`] = hit.postcode
    patch[`${side}Country`] = hit.country
    patch[confirmedKey] = true
  }

  await resolveSide(
    wizard.pickupAddress,
    wizard.pickupLng,
    wizard.pickupLat,
    'pickupLng',
    'pickupLat',
    'pickupAddressConfirmed',
    'pickupAddress',
    'Pickup address',
  )
  await resolveSide(
    wizard.deliveryAddress,
    wizard.deliveryLng,
    wizard.deliveryLat,
    'deliveryLng',
    'deliveryLat',
    'deliveryAddressConfirmed',
    'deliveryAddress',
    'Delivery address',
  )

  const updated = Object.keys(patch).length > 0 ? { ...wizard, ...patch } : wizard
  return { ok: errors.length === 0, wizard: updated, errors }
}
