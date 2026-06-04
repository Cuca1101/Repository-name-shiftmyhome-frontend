/**
 * Admin phone booking — shared validation and quote row payload (uses public wizard pricing only).
 */
import {
  buildQuoteEmailTemplateParams,
  buildWizardFullSummaryText,
  formatInventoryRowsForEmail,
  formatQuoteBreakdownLines,
  formatWizardArrivalSummary,
  getWizardArrivalTimePayload,
} from './emailQuotePayload'
import { isWizardArrivalValid, wizardArrivalErrorMessage } from './arrivalWizardValidation'
import { isMoveDateOnOrAfterToday, moveDatePastErrorMessage } from './moveDateLocal'
import { step3ContactDetailsError, step3ContactDetailsValid } from './quoteWizardStep3ContactScroll'
import { isSupabaseConfigured, supabase } from './supabase'
import {
  ADMIN_PHONE_BOOKING_SOURCE,
  PHONE_BOOKING_PENDING_OPERATIONAL_STATUS,
  buildQuoteRowFromTemplateParams,
  generateQuoteRef,
} from './data/quotesRepository'

const QUOTES_TABLE = 'quotes'

const HAS_MAPBOX_TOKEN = Boolean(import.meta.env.VITE_MAPBOX_TOKEN)

/**
 * @param {Record<string, unknown>} wizard
 * @param {{ requireAddressConfirmation?: boolean }} [opts]
 */
export function validateAdminPhoneBooking(wizard, opts = {}) {
  const requireAddressConfirmation = opts.requireAddressConfirmation !== false
  const errors = []

  const name = String(wizard.fullName || '').trim()
  const phone = String(wizard.phone || '').trim()
  const email = String(wizard.email || '').trim()
  if (!name) errors.push('Customer full name is required.')
  if (!phone) errors.push('Customer phone is required.')
  if (!email) errors.push('Customer email is required.')

  const pickup = String(wizard.pickupAddress || '').trim()
  const delivery = String(wizard.deliveryAddress || '').trim()
  if (pickup.length <= 2) errors.push('Pickup address is required.')
  if (delivery.length <= 2) errors.push('Delivery address is required.')

  if (HAS_MAPBOX_TOKEN) {
    if (wizard.pickupLng == null || wizard.pickupLat == null) {
      errors.push('Select pickup address from Mapbox suggestions.')
    }
    if (wizard.deliveryLng == null || wizard.deliveryLat == null) {
      errors.push('Select delivery address from Mapbox suggestions.')
    }
  }

  if (wizard.pickupFloor == null) errors.push('Pickup floor is required.')
  if (wizard.deliveryFloor == null) errors.push('Delivery floor is required.')

  if (!wizard.moveDate) {
    errors.push('Move date is required.')
  } else if (!isMoveDateOnOrAfterToday(wizard.moveDate)) {
    errors.push(moveDatePastErrorMessage(wizard.moveDate))
  }

  if (!isWizardArrivalValid(wizard)) {
    errors.push(wizardArrivalErrorMessage(wizard))
  }

  if (!(Number(wizard.distanceMiles) > 0)) {
    errors.push('Route distance is required — confirm both addresses on the map.')
  }

  if (!(Number(wizard.crewSize) >= 1 && Number(wizard.crewSize) <= 4)) {
    errors.push('Select a crew size.')
  }

  if (!Array.isArray(wizard.inventoryLines) || wizard.inventoryLines.length === 0) {
    errors.push('Add at least one inventory item.')
  }

  if (!step3ContactDetailsValid(wizard)) {
    errors.push(step3ContactDetailsError(wizard).message)
  }

  if (requireAddressConfirmation) {
    if (!wizard.pickupAddressConfirmed || !wizard.deliveryAddressConfirmed) {
      errors.push('Confirm pickup and delivery addresses in the Extras & notes section.')
    }
  }

  return errors
}

/**
 * Per-step validation for admin phone booking wizard (steps 1–3).
 * @param {Record<string, unknown>} wizard
 * @param {1 | 2 | 3} step
 */
export function validateAdminPhoneBookingStep(wizard, step) {
  const errors = []

  if (step === 1) {
    const pickup = String(wizard.pickupAddress || '').trim()
    const delivery = String(wizard.deliveryAddress || '').trim()
    if (pickup.length <= 2) errors.push('Pickup address is required.')
    if (delivery.length <= 2) errors.push('Delivery address is required.')

    if (HAS_MAPBOX_TOKEN) {
      if (wizard.pickupLng == null || wizard.pickupLat == null) {
        errors.push('Select pickup address from Mapbox suggestions.')
      }
      if (wizard.deliveryLng == null || wizard.deliveryLat == null) {
        errors.push('Select delivery address from Mapbox suggestions.')
      }
    }

    if (wizard.pickupFloor == null) errors.push('Pickup floor is required.')
    if (wizard.deliveryFloor == null) errors.push('Delivery floor is required.')

    if (!wizard.moveDate) {
      errors.push('Move date is required.')
    } else if (!isMoveDateOnOrAfterToday(wizard.moveDate)) {
      errors.push(moveDatePastErrorMessage(wizard.moveDate))
    }

    if (!isWizardArrivalValid(wizard)) {
      errors.push(wizardArrivalErrorMessage(wizard))
    }

    if (!(Number(wizard.distanceMiles) > 0)) {
      errors.push('Route distance is required — confirm both addresses on the map.')
    }

    return errors
  }

  if (step === 2) {
    const name = String(wizard.fullName || '').trim()
    const phone = String(wizard.phone || '').trim()
    const email = String(wizard.email || '').trim()
    if (!name) errors.push('Customer full name is required.')
    if (!phone) errors.push('Customer phone is required.')
    if (!email) errors.push('Customer email is required.')

    if (!(Number(wizard.crewSize) >= 1 && Number(wizard.crewSize) <= 4)) {
      errors.push('Select a crew size.')
    }

    if (!Array.isArray(wizard.inventoryLines) || wizard.inventoryLines.length === 0) {
      errors.push('Add at least one inventory item.')
    }

    return errors
  }

  return validateAdminPhoneBooking(wizard)
}

/**
 * @param {import('./pricingCalculator.js').PriceBreakdown} breakdown
 * @param {{
 *   useCalculatedPrice: boolean,
 *   finalPriceOverride: string | number | null,
 * }} params
 */
export function resolveAdminPhoneBookingFinalPrice(breakdown, { useCalculatedPrice, finalPriceOverride }) {
  const calculated =
    breakdown?.estimatedTotal != null && Number.isFinite(breakdown.estimatedTotal)
      ? breakdown.estimatedTotal
      : null
  if (useCalculatedPrice) {
    return { calculated, final: calculated, isOverride: false }
  }
  const raw = finalPriceOverride
  const parsed = raw === '' || raw == null ? NaN : Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { calculated, final: null, isOverride: true, invalid: true }
  }
  return { calculated, final: Math.round(parsed * 100) / 100, isOverride: true, invalid: false }
}

/**
 * @param {{
 *   wizard: Record<string, unknown>,
 *   serviceType: string,
 *   quoteRef?: string,
 *   breakdown: import('./pricingCalculator.js').PriceBreakdown,
 *   useCalculatedPrice: boolean,
 *   finalPrice: number | null,
 *   overrideReason?: string,
 *   adminNote?: string,
 *   createdBy?: string,
 * }} params
 */
export function buildAdminPhoneBookingQuoteRow({
  wizard,
  serviceType,
  quoteRef,
  breakdown,
  useCalculatedPrice,
  finalPrice,
  overrideReason = '',
  adminNote = '',
  createdBy = '',
}) {
  const ref = String(quoteRef || '').trim() || generateQuoteRef()
  const fullSummaryText = buildWizardFullSummaryText({
    wizard,
    serviceType,
    quoteRef: ref,
    breakdown,
    photoFileNames: [],
  })

  const invRowsForParams = (wizard.inventoryLines || []).map((l) => ({
    name: l.name,
    quantity: l.quantity,
    volumePerUnitM3: l.m3,
    handlingMultiplier: l.mult ?? 1,
    weightType: l.weightType,
    isCustom: l.isCustom,
    categoryLabel: l.categoryLabel,
    customSizeBand: l.customSizeBand,
  }))

  const templateParams = buildQuoteEmailTemplateParams({
    name: wizard.fullName,
    email: wizard.email,
    phone: wizard.phone,
    service: serviceType,
    pickup: wizard.pickupAddress,
    delivery: wizard.deliveryAddress,
    move_date: wizard.moveDate,
    quote_ref: ref,
    details: fullSummaryText,
    inventory: formatInventoryRowsForEmail(invRowsForParams),
    pricing: formatQuoteBreakdownLines(breakdown),
    arrival_type: wizard.arrivalWindow === 'exact' ? 'exact' : 'window',
    arrival_time: getWizardArrivalTimePayload(wizard),
  })

  const extras = {
    arrival_window: formatWizardArrivalSummary(wizard),
    distance_miles: Number(wizard.distanceMiles) || 0,
    crew_size: Number(wizard.crewSize) || null,
    vehicle_size: wizard.vehicleSize ? String(wizard.vehicleSize) : null,
  }

  const calculatedTotal = breakdown.estimatedTotal
  const finalTotal = finalPrice ?? calculatedTotal
  const remaining =
    finalTotal != null && Number.isFinite(finalTotal) ? Math.max(0, finalTotal) : null

  const staffLines = [
    createdBy ? `Created by admin (${createdBy})` : 'Created by admin (phone booking)',
    'Phone booking — payment to be arranged manually',
    'Payment status: unpaid (no Stripe checkout)',
    'Awaiting release from New phone booking to Available Jobs',
  ]
  if (!useCalculatedPrice && overrideReason.trim()) {
    staffLines.push(`Price override reason: ${overrideReason.trim()}`)
  }
  if (adminNote.trim()) {
    staffLines.push(`Admin note: ${adminNote.trim()}`)
  }
  if (
    !useCalculatedPrice &&
    calculatedTotal != null &&
    finalTotal != null &&
    Math.abs(calculatedTotal - finalTotal) > 0.009
  ) {
    staffLines.push(
      `Calculated £${calculatedTotal.toFixed(2)} → charged £${finalTotal.toFixed(2)}`,
    )
  }

  const details = [staffLines.join('\n'), fullSummaryText].filter(Boolean).join('\n\n')

  const inventoryJson = (wizard.inventoryLines || []).map((l) => ({
    name: l.name,
    quantity: l.quantity,
    m3: l.m3,
    mult: l.mult ?? 1,
    weight_type: l.weightType,
    is_custom: Boolean(l.isCustom),
    category: l.categoryLabel,
  }))

  return buildQuoteRowFromTemplateParams(templateParams, extras, {
    quote_ref: ref,
    source: ADMIN_PHONE_BOOKING_SOURCE,
    status: 'Booked',
    payment_status: 'unpaid',
    payment_type: null,
    amount_paid: 0,
    paid_at: null,
    operational_status: PHONE_BOOKING_PENDING_OPERATIONAL_STATUS,
    estimated_total: calculatedTotal,
    remaining_balance: remaining,
    details,
    inventory: inventoryJson.length ? inventoryJson : [],
    pricing: formatQuoteBreakdownLines(breakdown),
  })
}

/**
 * @param {Parameters<typeof buildAdminPhoneBookingQuoteRow>[0]} form
 */
export async function insertAdminPhoneBookingFromWizard(form) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }

  const requestedRef = String(form.quoteRef || '').trim()
  if (requestedRef) {
    const row = buildAdminPhoneBookingQuoteRow({ ...form, quoteRef: requestedRef })
    const { data, error } = await supabase.from(QUOTES_TABLE).insert(row).select('id, quote_ref').single()
    if (error) {
      if (error.code === '23505') {
        throw new Error('This quote reference is already in use. Leave it blank for a new one.')
      }
      throw new Error(error.message || 'Could not save booking.')
    }
    return { id: String(data.id), quote_ref: String(data.quote_ref) }
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const row = buildAdminPhoneBookingQuoteRow(form)
    const { data, error } = await supabase.from(QUOTES_TABLE).insert(row).select('id, quote_ref').single()
    if (!error && data?.id) {
      return { id: String(data.id), quote_ref: String(data.quote_ref) }
    }
    if (error?.code === '23505') {
      continue
    }
    throw new Error(error?.message || 'Could not save booking.')
  }
  throw new Error('Could not allocate a unique quote reference. Try again.')
}
