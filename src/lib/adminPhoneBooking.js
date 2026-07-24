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
import { fetchQuoteByIdForAdmin } from './data/quotesAdminRepository'
import { quoteIsAdminPhoneBooking } from './adminJobListRules'
import {
  appendWizardSnapshotToDetails,
  extractWizardSnapshotFromDetails,
} from './adminPhoneBookingWizardSnapshot'
import { SERVICE_TYPES } from '../constants/serviceTypes'
import { initialWizardState } from './quoteWizardDefaults'
import { hydrateWizardFromDraft } from './quoteDraftStorage'

const QUOTES_TABLE = 'quotes'

const HAS_MAPBOX_TOKEN = Boolean(import.meta.env.VITE_MAPBOX_TOKEN)

/** @typedef {{ field: string, message: string, step: 1 | 2 | 3 }} AdminPhoneBookingFieldError */

/**
 * @param {Record<string, unknown>} wizard
 * @param {{ requireAddressConfirmation?: boolean }} [opts]
 * @returns {AdminPhoneBookingFieldError[]}
 */
export function collectAdminPhoneBookingFieldErrors(wizard, opts = {}) {
  const requireAddressConfirmation = opts.requireAddressConfirmation !== false
  /** @type {AdminPhoneBookingFieldError[]} */
  const errors = []

  const name = String(wizard.fullName || '').trim()
  const phone = String(wizard.phone || '').trim()
  const email = String(wizard.email || '').trim()
  if (!name) errors.push({ field: 'fullName', message: 'Customer full name is required.', step: 2 })
  if (!phone) errors.push({ field: 'phone', message: 'Customer phone is required.', step: 2 })
  if (!email) errors.push({ field: 'email', message: 'Customer email is required.', step: 2 })

  const pickup = String(wizard.pickupAddress || '').trim()
  const delivery = String(wizard.deliveryAddress || '').trim()
  if (pickup.length <= 2) {
    errors.push({ field: 'pickupAddress', message: 'Pickup address is required.', step: 1 })
  }
  if (delivery.length <= 2) {
    errors.push({ field: 'deliveryAddress', message: 'Delivery address is required.', step: 1 })
  }

  if (HAS_MAPBOX_TOKEN) {
    if (wizard.pickupLng == null || wizard.pickupLat == null) {
      errors.push({
        field: 'pickupAddress',
        message: 'Select pickup address from Mapbox suggestions.',
        step: 1,
      })
    }
    if (wizard.deliveryLng == null || wizard.deliveryLat == null) {
      errors.push({
        field: 'deliveryAddress',
        message: 'Select delivery address from Mapbox suggestions.',
        step: 1,
      })
    }
  }

  if (wizard.pickupFloor == null) {
    errors.push({ field: 'pickupFloor', message: 'Pickup floor is required.', step: 1 })
  }
  if (wizard.deliveryFloor == null) {
    errors.push({ field: 'deliveryFloor', message: 'Delivery floor is required.', step: 1 })
  }

  if (!wizard.moveDate) {
    errors.push({ field: 'moveDate', message: 'Move date is required.', step: 1 })
  } else if (!isMoveDateOnOrAfterToday(wizard.moveDate)) {
    errors.push({
      field: 'moveDate',
      message: moveDatePastErrorMessage(wizard.moveDate),
      step: 1,
    })
  }

  if (!isWizardArrivalValid(wizard)) {
    errors.push({
      field: 'arrivalWindow',
      message: wizardArrivalErrorMessage(wizard),
      step: 1,
    })
  }

  if (!(Number(wizard.distanceMiles) > 0)) {
    errors.push({
      field: 'distanceMiles',
      message: 'Route distance is required — confirm both addresses on the map.',
      step: 1,
    })
  }

  if (!(Number(wizard.crewSize) >= 1 && Number(wizard.crewSize) <= 4)) {
    errors.push({ field: 'crewSize', message: 'Select a crew size.', step: 2 })
  }

  if (!Array.isArray(wizard.inventoryLines) || wizard.inventoryLines.length === 0) {
    errors.push({
      field: 'inventoryLines',
      message: 'Add at least one inventory item.',
      step: 2,
    })
  }

  if (!step3ContactDetailsValid(wizard)) {
    const contactErr = step3ContactDetailsError(wizard)
    errors.push({
      field: contactErr.field || 'contact',
      message: contactErr.message,
      step: 2,
    })
  }

  if (requireAddressConfirmation) {
    if (!wizard.pickupAddressConfirmed) {
      errors.push({
        field: 'pickupAddressConfirmed',
        message: 'Confirm the pickup address below.',
        step: 3,
      })
    }
    if (!wizard.deliveryAddressConfirmed) {
      errors.push({
        field: 'deliveryAddressConfirmed',
        message: 'Confirm the delivery address below.',
        step: 3,
      })
    }
  }

  return errors
}

/**
 * @param {Record<string, unknown>} wizard
 * @param {{ requireAddressConfirmation?: boolean }} [opts]
 */
export function validateAdminPhoneBooking(wizard, opts = {}) {
  return collectAdminPhoneBookingFieldErrors(wizard, opts).map((e) => e.message)
}

/**
 * Per-step validation for admin phone booking wizard (steps 1–3).
 * @param {Record<string, unknown>} wizard
 * @param {1 | 2 | 3} step
 */
export function validateAdminPhoneBookingStep(wizard, step) {
  return collectAdminPhoneBookingFieldErrors(wizard)
    .filter((e) => e.step === step)
    .map((e) => e.message)
}

/**
 * @param {AdminPhoneBookingFieldError[]} errors
 * @returns {Record<string, string>}
 */
export function adminPhoneBookingErrorsByField(errors) {
  /** @type {Record<string, string>} */
  const map = {}
  for (const e of errors) {
    if (!map[e.field]) map[e.field] = e.message
  }
  return map
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
  finalPriceOverride = '',
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

  const detailsBody = [staffLines.join('\n'), fullSummaryText].filter(Boolean).join('\n\n')
  const details = appendWizardSnapshotToDetails(detailsBody, {
    wizard,
    serviceType,
    useCalculatedPrice,
    finalPriceOverride: String(finalPriceOverride ?? ''),
    overrideReason,
    adminNote,
  })

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
    calculated_total: calculatedTotal,
    agreed_price:
      !useCalculatedPrice &&
      calculatedTotal != null &&
      finalTotal != null &&
      Math.abs(calculatedTotal - finalTotal) > 0.009
        ? finalTotal
        : null,
    price_override_reason:
      !useCalculatedPrice && overrideReason.trim() ? overrideReason.trim() : null,
    price_override_by:
      !useCalculatedPrice &&
      calculatedTotal != null &&
      finalTotal != null &&
      Math.abs(calculatedTotal - finalTotal) > 0.009
        ? createdBy || 'admin'
        : null,
    price_override_at:
      !useCalculatedPrice &&
      calculatedTotal != null &&
      finalTotal != null &&
      Math.abs(calculatedTotal - finalTotal) > 0.009
        ? new Date().toISOString()
        : null,
    details,
    inventory: inventoryJson.length ? inventoryJson : [],
    pricing: formatQuoteBreakdownLines(breakdown),
  })
}

/**
 * Map a saved quotes row (+ embedded wizard JSON) into admin form state.
 * @param {Record<string, unknown>} row
 */
export function adminPhoneBookingFormStateFromQuoteRow(row) {
  const { meta } = extractWizardSnapshotFromDetails(String(row.details || ''))
  const base = initialWizardState()
  let wizard = hydrateWizardFromDraft(meta?.wizard ?? {})
  if (!meta) {
    wizard = {
      ...base,
      fullName: String(row.full_name || ''),
      phone: String(row.phone || ''),
      email: String(row.email || ''),
      pickupAddress: String(row.pickup_address || ''),
      deliveryAddress: String(row.delivery_address || ''),
      moveDate: String(row.move_date || ''),
      distanceMiles: Number(row.distance_miles) || 0,
      crewSize: row.crew_size != null ? Number(row.crew_size) : null,
      inventoryLines: parseInventoryJsonFromQuoteRow(row.inventory),
      pickupAddressConfirmed: true,
      deliveryAddressConfirmed: true,
    }
  } else {
    wizard = {
      ...base,
      ...wizard,
      pickupAddressConfirmed: true,
      deliveryAddressConfirmed: true,
    }
  }

  const estimated = row.estimated_total != null ? Number(row.estimated_total) : null
  const remaining = row.remaining_balance != null ? Number(row.remaining_balance) : null
  let useCalculatedPrice = meta?.useCalculatedPrice !== false
  let finalPriceOverride = meta?.finalPriceOverride ?? ''
  if (!meta && estimated != null && remaining != null && Math.abs(estimated - remaining) > 0.009) {
    useCalculatedPrice = false
    finalPriceOverride = remaining.toFixed(2)
  }

  return {
    wizard,
    serviceType:
      meta?.serviceType ||
      String(row.service_type || row.service || '').trim() ||
      SERVICE_TYPES[0],
    quoteRef: String(row.quote_ref || ''),
    customQuoteRef: '',
    useCalculatedPrice,
    finalPriceOverride,
    overrideReason: meta?.overrideReason ?? '',
    adminNote: meta?.adminNote ?? '',
    step: 3,
  }
}

/**
 * @param {unknown} inv
 */
function parseInventoryJsonFromQuoteRow(inv) {
  if (!Array.isArray(inv)) return []
  return inv
    .filter((line) => line && typeof line === 'object')
    .map((line, i) => ({
      lineId: `L-import-${i}-${Date.now()}`,
      catalogId: null,
      name: String(line.name || 'Item'),
      categoryKey: null,
      categoryLabel: String(line.category || 'Imported'),
      quantity: Number(line.quantity) || 1,
      m3: Number(line.m3) || 0.1,
      defaultM3: Number(line.m3) || 0.1,
      mult: Number(line.mult) ?? 1,
      weightType: line.weight_type || 'medium',
      isCustom: Boolean(line.is_custom),
    }))
}

/**
 * @param {string} quoteId
 */
export async function fetchAdminPhoneBookingForEdit(quoteId) {
  const id = String(quoteId || '').trim()
  if (!id) throw new Error('Missing booking id.')
  const row = await fetchQuoteByIdForAdmin(id)
  if (!row) throw new Error('Booking not found.')
  if (!quoteIsAdminPhoneBooking(row)) {
    throw new Error('This record is not a phone booking.')
  }
  return { id: String(row.id), quote_ref: String(row.quote_ref), ...adminPhoneBookingFormStateFromQuoteRow(row) }
}

/**
 * @param {Parameters<typeof buildAdminPhoneBookingQuoteRow>[0] & { quoteId: string }} form
 */
export async function updateAdminPhoneBookingFromWizard(form) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }
  const quoteId = String(form.quoteId || '').trim()
  if (!quoteId) throw new Error('Missing booking id.')

  const existing = await fetchQuoteByIdForAdmin(quoteId)
  if (!existing) throw new Error('Booking not found.')
  if (!quoteIsAdminPhoneBooking(existing)) {
    throw new Error('This record is not a phone booking.')
  }

  const row = buildAdminPhoneBookingQuoteRow({
    ...form,
    quoteRef: String(existing.quote_ref || form.quoteRef || ''),
  })

  const patch = {
    ...row,
    quote_ref: existing.quote_ref,
    source: existing.source,
    payment_status: existing.payment_status,
    payment_type: existing.payment_type,
    amount_paid: existing.amount_paid,
    paid_at: existing.paid_at,
    operational_status: existing.operational_status,
  }

  const { data, error } = await supabase
    .from(QUOTES_TABLE)
    .update(patch)
    .eq('id', quoteId)
    .select('id, quote_ref')
    .single()

  if (error) throw new Error(error.message || 'Could not update booking.')
  return { id: String(data.id), quote_ref: String(data.quote_ref) }
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
    const row = buildAdminPhoneBookingQuoteRow({
      ...form,
      quoteRef: requestedRef,
      finalPriceOverride: form.finalPriceOverride,
    })
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
    const row = buildAdminPhoneBookingQuoteRow({
      ...form,
      finalPriceOverride: form.finalPriceOverride,
    })
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
