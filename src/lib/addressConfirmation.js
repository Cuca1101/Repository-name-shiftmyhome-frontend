/**
 * Pickup/delivery address confirmation helpers (quote wizard + admin phone booking).
 */

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
