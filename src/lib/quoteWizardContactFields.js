/**
 * Pickup/delivery contact helpers for the quote wizard (Step 3).
 * Resolved values are embedded in quote `details` text until dedicated DB columns exist.
 */

/**
 * @param {Record<string, unknown>} wizard
 */
export function resolvePickupContact(wizard) {
  if (wizard.pickupContactSameAsCustomer !== false) {
    return {
      name: String(wizard.fullName || '').trim(),
      phone: String(wizard.phone || '').trim(),
    }
  }
  return {
    name: String(wizard.pickupContactName || '').trim(),
    phone: String(wizard.pickupContactPhone || '').trim(),
  }
}

/**
 * @param {Record<string, unknown>} wizard
 */
export function resolveDeliveryContact(wizard) {
  if (wizard.deliveryContactSameAsCustomer !== false) {
    return {
      name: String(wizard.fullName || '').trim(),
      phone: String(wizard.phone || '').trim(),
    }
  }
  return {
    name: String(wizard.deliveryContactName || '').trim(),
    phone: String(wizard.deliveryContactPhone || '').trim(),
  }
}

/**
 * @param {Record<string, unknown>} wizard
 */
export function pickupDeliveryContactsValid(wizard) {
  const pickup = resolvePickupContact(wizard)
  const delivery = resolveDeliveryContact(wizard)
  const pickupOk =
    wizard.pickupContactSameAsCustomer !== false ||
    (pickup.name.length > 1 && pickup.phone.length > 5)
  const deliveryOk =
    wizard.deliveryContactSameAsCustomer !== false ||
    (delivery.name.length > 1 && delivery.phone.length > 5)
  return pickupOk && deliveryOk
}

/**
 * Plain-text block for quote details / emails (no separate DB columns yet).
 * @param {Record<string, unknown>} wizard
 */
export function formatPickupDeliveryContactsForSummary(wizard) {
  const pickup = resolvePickupContact(wizard)
  const delivery = resolveDeliveryContact(wizard)
  const pickupSame = wizard.pickupContactSameAsCustomer !== false
  const deliverySame = wizard.deliveryContactSameAsCustomer !== false

  return [
    '— Pickup & delivery contacts —',
    `Pickup contact same as booking customer: ${pickupSame ? 'Yes' : 'No'}`,
    `Pickup contact name: ${pickup.name || '—'}`,
    `Pickup phone: ${pickup.phone || '—'}`,
    `Delivery contact same as booking customer: ${deliverySame ? 'Yes' : 'No'}`,
    `Delivery contact name: ${delivery.name || '—'}`,
    `Delivery phone: ${delivery.phone || '—'}`,
  ].join('\n')
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
