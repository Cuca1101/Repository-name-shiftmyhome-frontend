import { reviewAddressesConfirmed } from './addressConfirmation'

/**
 * Pickup/delivery contact helpers for the quote wizard (Step 3).
 * Resolved values are embedded in quote `details` text until dedicated DB columns exist.
 */

/**
 * @param {Record<string, unknown>} wizard
 */
export function resolvePickupContact(wizard) {
  const name = String(wizard.pickupContactName || '').trim()
  const phone = String(wizard.pickupContactPhone || '').trim()
  if (wizard.pickupContactSameAsCustomer === false) {
    return { name, phone }
  }
  return {
    name: name || String(wizard.fullName || '').trim(),
    phone: phone || String(wizard.phone || '').trim(),
  }
}

/** Drop-off person defaults to the pickup contact. */
export function isDropoffSameAsPickup(wizard) {
  if (wizard.dropoffSameAsPickup === true) return true
  if (wizard.dropoffSameAsPickup === false) return false
  if (wizard.deliveryContactSameAsCustomer === false) return false
  return true
}

/**
 * @param {Record<string, unknown>} wizard
 */
export function resolveDeliveryContact(wizard) {
  if (isDropoffSameAsPickup(wizard)) return resolvePickupContact(wizard)
  return {
    name: String(wizard.deliveryContactName || '').trim(),
    phone: String(wizard.deliveryContactPhone || '').trim(),
  }
}

/**
 * @param {string} name
 * @param {string} phone
 */
export function contactDetailsComplete(name, phone) {
  return String(name || '').trim().length > 1 && String(phone || '').replace(/\s/g, '').length > 5
}

/**
 * @param {Record<string, unknown>} wizard
 */
export function pickupDeliveryContactsValid(wizard) {
  const pickup = resolvePickupContact(wizard)
  if (!contactDetailsComplete(pickup.name, pickup.phone)) return false
  if (isDropoffSameAsPickup(wizard)) return true
  const delivery = resolveDeliveryContact(wizard)
  return contactDetailsComplete(delivery.name, delivery.phone)
}

/** Both Review addresses are confirmed and the required people can be contacted. */
export function reviewDetailsReady(wizard) {
  return reviewAddressesConfirmed(wizard) && pickupDeliveryContactsValid(wizard)
}

/**
 * Plain-text block for quote details / emails (no separate DB columns yet).
 * @param {Record<string, unknown>} wizard
 */
export function formatPickupDeliveryContactsForSummary(wizard) {
  const pickup = resolvePickupContact(wizard)
  const delivery = resolveDeliveryContact(wizard)
  const same = isDropoffSameAsPickup(wizard)
  const pickupFlat = String(wizard.pickupFlatDetails || '').trim()
  const deliveryFlat = String(wizard.deliveryFlatDetails || '').trim()

  return [
    '— Pickup & delivery contacts —',
    `Pickup contact: ${pickup.name || '—'}`,
    `Pickup phone: ${pickup.phone || '—'}`,
    pickupFlat ? `Pickup access notes: ${pickupFlat}` : '',
    `Drop-off same as pickup: ${same ? 'Yes' : 'No'}`,
    `Delivery contact: ${delivery.name || '—'}`,
    `Delivery phone: ${delivery.phone || '—'}`,
    deliveryFlat ? `Delivery access notes: ${deliveryFlat}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Resolved payload fields for future DB columns (not sent to Supabase insert yet).
 * @param {Record<string, unknown>} wizard
 */
export function resolvedContactPayloadFields(wizard) {
  const pickup = resolvePickupContact(wizard)
  const delivery = resolveDeliveryContact(wizard)
  return {
    pickup_contact_name: pickup.name || null,
    pickup_contact_phone: pickup.phone || null,
    delivery_contact_name: delivery.name || null,
    delivery_contact_phone: delivery.phone || null,
  }
}
