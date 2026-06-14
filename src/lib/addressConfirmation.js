/**
 * Pickup/delivery address confirmation helpers (quote wizard + admin phone booking).
 */

import { geocodeAddress } from './mapboxRouteApi'

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
 * Geocode a single typed address (no autocomplete selection required).
 * @param {string} addressText
 * @param {string} token
 * @returns {Promise<{ lng: number, lat: number } | null>}
 */
export async function geocodeTypedWizardAddress(addressText, token) {
  const text = String(addressText || '').trim()
  if (!token || text.length < MIN_MANUAL_ADDRESS_LENGTH) return null
  return geocodeAddress(text, token)
}

/**
 * Resolve missing pickup/delivery coordinates from typed addresses via Mapbox geocoding.
 * @param {Record<string, unknown>} wizard
 * @param {string} token
 * @returns {Promise<{ ok: boolean, wizard: Record<string, unknown>, errors: { field: string, message: string }[] }>}
 */
export async function resolveWizardMissingAddressCoords(wizard, token) {
  if (!token) return { ok: true, wizard, errors: [] }

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
    const hit = await geocodeAddress(trimmed, token)
    if (!hit) {
      errors.push({
        field,
        message: `We could not verify this ${label.toLowerCase()}. Please check the spelling or try a nearby postcode.`,
      })
      return
    }
    patch[lngKey] = hit.lng
    patch[latKey] = hit.lat
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
