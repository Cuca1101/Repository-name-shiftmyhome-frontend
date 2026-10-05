/**
 * Admin Edit Booking — load any booking into the wizard, recalculate price, save, notify.
 * Preserves quote_ref, payments, source, and operational workflow fields.
 */
import {
  buildQuoteEmailTemplateParams,
  buildWizardFullSummaryText,
  formatInventoryRowsForEmail,
  formatQuoteBreakdownLines,
  formatWizardArrivalSummary,
  getWizardArrivalTimePayload,
} from './emailQuotePayload'
import { isSupabaseConfigured, supabase } from './supabase'
import { buildQuoteRowFromTemplateParams } from './data/quotesRepository'
import { fetchQuoteByIdForAdmin } from './data/quotesAdminRepository'
import {
  appendWizardSnapshotToDetails,
  extractWizardSnapshotFromDetails,
} from './adminPhoneBookingWizardSnapshot'
import { SERVICE_TYPES } from '../constants/serviceTypes'
import { initialWizardState } from './quoteWizardDefaults'
import { hydrateWizardFromDraft } from './quoteDraftStorage'
import { resolveChargeableTotal } from './adminAgreedPrice'
import {
  adminPhoneBookingFormStateFromQuoteRow,
  resolveAdminPhoneBookingFinalPrice,
} from './adminPhoneBooking'
import {
  buildCustomerFacingBookingSnapshot,
  diffCustomerFacingBooking,
} from './adminEditBookingDiff'
import { parseWizardStructured, mergeDetailSections } from './quoteJobAdminModel'
import { buildAvailableJobInventoryDisplayRows } from './availableJobInventoryDisplay'

const QUOTES_TABLE = 'quotes'

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

/**
 * @param {unknown} inv
 */
function parseInventoryJsonFromQuoteRow(inv) {
  if (!Array.isArray(inv)) return []
  return inv
    .filter((line) => line && typeof line === 'object' && !('summary' in line && Object.keys(line).length === 1))
    .map((line, i) => ({
      lineId: `L-import-${i}-${Date.now()}`,
      catalogId: null,
      name: String(line.name || 'Item'),
      categoryKey: null,
      categoryLabel: String(line.category || 'Imported'),
      quantity: Number(line.quantity) || 1,
      m3: Number(line.m3) || 0.1,
      defaultM3: Number(line.m3) || 0.1,
      mult: Number.isFinite(Number(line.mult)) && Number(line.mult) > 0 ? Number(line.mult) : 1,
      weightType: line.weight_type || 'medium',
      isCustom: Boolean(line.is_custom),
    }))
}

/**
 * @param {Record<string, unknown>} row
 */
function hydrateInventoryLinesFromQuote(row) {
  const fromJson = parseInventoryJsonFromQuoteRow(row.inventory)
  if (fromJson.length) return fromJson

  const displayRows = buildAvailableJobInventoryDisplayRows(row)
  return displayRows.map((r, i) => {
    const qty = Math.max(1, Number(r.qty) || 1)
    const volRaw = String(r.volume || '').replace(/[^\d.]/g, '')
    const lineVol = Number(volRaw) || 0
    // Display volume is often total line volume (~X m³ line vol); convert to per-unit.
    const m3 = lineVol > 0 ? Math.max(0.01, Math.round((lineVol / qty) * 1000) / 1000) : 0.1
    const name = String(r.name || 'Item').trim() || 'Item'
    // Strip qty markers already reflected in quantity (e.g. "Sofa × 2").
    const cleanName = name.replace(/\s*×\s*\d+\s*$/i, '').trim() || name
    return {
      lineId: `L-display-${i}-${Date.now()}`,
      catalogId: null,
      name: cleanName,
      categoryKey: null,
      categoryLabel: String(r.sizeType && r.sizeType !== '—' ? r.sizeType : 'Imported'),
      quantity: qty,
      m3,
      defaultM3: m3,
      mult: 1,
      weightType: 'medium',
      isCustom: true,
    }
  })
}

function parseFloor(raw) {
  if (raw == null || raw === '' || raw === '—') return null
  const s = String(raw).trim().toLowerCase()
  if (s === 'ground' || s === 'g' || s === '0') return 0
  const n = Number(String(raw).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Normalize DB move_date (date or timestamptz) to YYYY-MM-DD for <input type="date">. */
function normalizeMoveDateValue(raw) {
  const s = String(raw || '').trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : ''
}

/**
 * Phone-booking style parser often turns inventory `[{summary}]` into a single "Item".
 * Prefer richer display-row hydration whenever the current lines look incomplete.
 * @param {unknown[]} lines
 * @param {unknown[]} hydrated
 */
function shouldReplaceInventoryLines(lines, hydrated) {
  if (!Array.isArray(hydrated) || hydrated.length === 0) return false
  if (!Array.isArray(lines) || lines.length === 0) return true
  if (hydrated.length > lines.length) return true
  if (lines.length === 1) {
    const name = String(lines[0]?.name || '').trim()
    if (!name || /^item$/i.test(name)) return true
    if (name.length > 80 || name.includes('\n') || /[•·●]/.test(name)) return true
  }
  return false
}

function parseLift(raw) {
  if (raw == null || raw === '' || raw === '—') return null
  const s = String(raw).trim().toLowerCase()
  if (s === 'yes' || s === 'y' || s === 'true' || s === '1') return true
  if (s === 'no' || s === 'n' || s === 'false' || s === '0' || s === 'none') return false
  return null
}

function hydrateArrivalFromQuoteRow(row, wizard) {
  const aw = String(row.arrival_window || '').trim()
  const arrivalType = String(row.arrival_type || '').trim()
  const arrivalTime = String(row.arrival_time || '').trim()

  if (wizard.arrivalWindow) return wizard

  const next = { ...wizard }
  if (arrivalType === 'exact' || /^exact/i.test(aw) || /\(Exact time\)/i.test(aw)) {
    next.arrivalWindow = 'exact'
    next.exactArrivalTime = arrivalTime || aw.replace(/\s*\(Exact time\)\s*/i, '').trim()
  } else if (/flexible|flex_window/i.test(aw) || (arrivalTime && /[-–—]/.test(arrivalTime))) {
    next.arrivalWindow = 'flex_window'
    const m = (arrivalTime || aw).match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/)
    if (m) {
      next.flexibleArrivalFrom = m[1]
      next.flexibleArrivalUntil = m[2]
    }
  } else if (/morning/i.test(aw)) {
    next.arrivalWindow = 'morning'
  } else if (/midday/i.test(aw)) {
    next.arrivalWindow = 'midday'
  } else if (/evening|afternoon/i.test(aw)) {
    next.arrivalWindow = 'evening'
  } else if (aw) {
    // Human summary stored in arrival_window (phone booking path)
    if (/08:00|morning/i.test(aw)) next.arrivalWindow = 'morning'
    else if (/12:00|midday/i.test(aw)) next.arrivalWindow = 'midday'
    else if (/16:00|evening/i.test(aw)) next.arrivalWindow = 'evening'
  }
  return next
}

function hydrateAccessFromDetails(row, wizard) {
  const sections = parseWizardStructured(String(row.details || ''))
  const pickupSec = sections['Pickup property & access'] || {}
  const deliverySec = sections['Delivery property & access'] || {}
  const accessCarry = sections['Access & carry (both ends factored in pricing)'] || {}
  const formAccess = mergeDetailSections(sections, ['Property / access'])
  const next = { ...wizard }

  if (next.pickupFloor == null) {
    next.pickupFloor = parseFloor(pickupSec.Floor || pickupSec['Pickup floor'] || formAccess['Pickup floor'])
  }
  if (next.deliveryFloor == null) {
    next.deliveryFloor = parseFloor(
      deliverySec.Floor || deliverySec['Delivery floor'] || formAccess['Delivery floor'],
    )
  }
  if (next.pickupLift == null) {
    next.pickupLift = parseLift(pickupSec.Lift || pickupSec['Pickup lift'] || formAccess['Pickup lift'])
  }
  if (next.deliveryLift == null) {
    next.deliveryLift = parseLift(
      deliverySec.Lift || deliverySec['Delivery lift'] || formAccess['Delivery lift'],
    )
  }
  if (!next.parkingDistance || next.parkingDistance === 'standard') {
    const parking =
      accessCarry['Parking'] ||
      accessCarry['Awkward parking / extended carry'] ||
      formAccess['Awkward parking / extended carry'] ||
      ''
    if (/awkward|extended|long/i.test(parking)) next.parkingDistance = 'long'
    else if (/easy/i.test(parking)) next.parkingDistance = 'easy'
  }
  if (!next.walkingDistance || next.walkingDistance === 'standard') {
    const walking = accessCarry['Walking'] || accessCarry['Long walk / carry'] || ''
    if (/long/i.test(walking)) next.walkingDistance = 'long'
    else if (/short/i.test(walking)) next.walkingDistance = 'short'
  }
  if (!next.specialInstructions) {
    const instr =
      sections['Special instructions']?.Notes ||
      sections['Instructions']?.Notes ||
      formAccess['Special instructions'] ||
      ''
    if (instr && instr !== '—') next.specialInstructions = String(instr)
  }
  return next
}

/**
 * Price shown as the current booking total when opening Edit Booking.
 * Prefer agreed/chargeable total; for fully paid jobs fall back to amount paid.
 * @param {Record<string, unknown>} row
 * @returns {number | null}
 */
export function resolveEditBookingBaselinePrice(row) {
  const chargeable = resolveChargeableTotal(row)
  if (chargeable != null && Number.isFinite(chargeable)) return chargeable
  const paid = Number(row?.amount_paid)
  const status = String(row?.payment_status || '').toLowerCase()
  if ((status === 'paid' || status === 'deposit_paid') && Number.isFinite(paid) && paid > 0) {
    return Math.round(paid * 100) / 100
  }
  return null
}

/**
 * Map any quotes row into edit-booking form state (wizard + price mode).
 * @param {Record<string, unknown>} row
 */
export function adminEditBookingFormStateFromQuoteRow(row) {
  const base = adminPhoneBookingFormStateFromQuoteRow(row)
  let wizard = { ...base.wizard }

  const hydratedInv = hydrateInventoryLinesFromQuote(row)
  if (shouldReplaceInventoryLines(wizard.inventoryLines, hydratedInv)) {
    wizard.inventoryLines = hydratedInv
  }

  const { meta } = extractWizardSnapshotFromDetails(String(row.details || ''))
  if (!meta) {
    wizard = hydrateArrivalFromQuoteRow(row, wizard)
    wizard = hydrateAccessFromDetails(row, wizard)
  }

  // Always normalize calendar date for the date input (timestamptz → YYYY-MM-DD).
  const fromRow = normalizeMoveDateValue(row.move_date)
  const fromWizard = normalizeMoveDateValue(wizard.moveDate)
  wizard.moveDate = fromWizard || fromRow

  const chargeable = resolveEditBookingBaselinePrice(row)

  // Prefer the amount already on the booking (what the customer paid / agreed).
  // Live engine recalculation often differs after inventory re-hydration.
  let useCalculatedPrice = true
  let finalPriceOverride = ''
  if (chargeable != null && Number.isFinite(chargeable)) {
    useCalculatedPrice = false
    finalPriceOverride = chargeable.toFixed(2)
  } else if (base.useCalculatedPrice === false && base.finalPriceOverride) {
    useCalculatedPrice = false
    finalPriceOverride = String(base.finalPriceOverride)
  }

  return {
    ...base,
    wizard: {
      ...initialWizardState(),
      ...hydrateWizardFromDraft(wizard),
      moveDate: normalizeMoveDateValue(wizard.moveDate) || fromRow,
      inventoryLines: Array.isArray(wizard.inventoryLines) ? wizard.inventoryLines : [],
      pickupAddressConfirmed: true,
      deliveryAddressConfirmed: true,
    },
    serviceType:
      base.serviceType ||
      String(row.service_type || row.service || '').trim() ||
      SERVICE_TYPES[0],
    useCalculatedPrice,
    finalPriceOverride,
    baselinePrice: chargeable,
  }
}

/**
 * @param {string} quoteId
 */
export async function fetchBookingForAdminEdit(quoteId) {
  const id = String(quoteId || '').trim()
  if (!id) throw new Error('Missing booking id.')
  const row = await fetchQuoteByIdForAdmin(id)
  if (!row) throw new Error('Booking not found.')
  const status = String(row.status || '').toLowerCase()
  if (status === 'cancelled') {
    throw new Error('Cancelled bookings cannot be edited.')
  }
  return {
    id: String(row.id),
    quote_ref: String(row.quote_ref || ''),
    existing: row,
    ...adminEditBookingFormStateFromQuoteRow(row),
  }
}

/**
 * Build the quote update payload from wizard + pricing (does not touch payments / ref / source).
 * @param {{
 *   existing: Record<string, unknown>,
 *   wizard: Record<string, unknown>,
 *   serviceType: string,
 *   breakdown: import('./pricingCalculator.js').PriceBreakdown,
 *   useCalculatedPrice: boolean,
 *   finalPrice: number | null,
 *   finalPriceOverride?: string | number,
 *   overrideReason?: string,
 *   adminNote?: string,
 *   editedBy?: string,
 * }} params
 */
export function buildAdminEditBookingPatch({
  existing,
  wizard,
  serviceType,
  breakdown,
  useCalculatedPrice,
  finalPrice,
  finalPriceOverride = '',
  overrideReason = '',
  adminNote = '',
  editedBy = '',
}) {
  const ref = String(existing.quote_ref || '').trim()
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
    heavyFee: l.heavyFee,
    appliesHeavyHandlingFee: l.heavyFee,
    isCustom: l.isCustom,
    categoryLabel: l.categoryLabel,
    customSizeBand: l.customSizeBand,
  }))

  const emailForRow = String(wizard.email || '').trim() || String(existing.email || '').trim() || 'booking@shiftmyhome.local'
  const phoneForRow = String(wizard.phone || '').trim() || String(existing.phone || '').trim() || '00000000000'

  const templateParams = buildQuoteEmailTemplateParams({
    name: wizard.fullName,
    email: emailForRow,
    phone: phoneForRow,
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
  const amountPaid = Number(existing.amount_paid)
  const paid = Number.isFinite(amountPaid) && amountPaid > 0 ? round2(amountPaid) : 0
  const remaining =
    finalTotal != null && Number.isFinite(finalTotal) ? Math.max(0, round2(finalTotal - paid)) : null

  // Keep payment amounts/ids untouched, but align status with the new balance.
  let paymentStatus = existing.payment_status
  if (paid > 0 && remaining != null) {
    paymentStatus = remaining <= 0.009 ? 'paid' : 'deposit_paid'
  }

  const { displayDetails } = extractWizardSnapshotFromDetails(String(existing.details || ''))
  const staffBits = []
  if (editedBy) staffBits.push(`Last edited by admin (${editedBy}) at ${new Date().toISOString()}`)
  if (!useCalculatedPrice && overrideReason.trim()) {
    staffBits.push(`Price override reason: ${overrideReason.trim()}`)
  }
  if (adminNote.trim()) staffBits.push(`Admin note: ${adminNote.trim()}`)

  // Strip prior "Admin note:" / edit audit lines from display body when rebuilding.
  const priorBody = displayDetails
    .split('\n')
    .filter((line) => {
      const t = line.trim()
      if (/^Last edited by admin/i.test(t)) return false
      if (/^Price override reason:/i.test(t)) return false
      if (/^Admin note:/i.test(t)) return false
      return true
    })
    .join('\n')
    .trim()

  const keepInternal =
    priorBody &&
    !priorBody.includes('— Service —') &&
    !priorBody.includes('Preferred arrival:')
      ? priorBody
      : ''

  const detailsBody = [staffBits.join('\n'), keepInternal, fullSummaryText].filter(Boolean).join('\n\n')
  const details = appendWizardSnapshotToDetails(detailsBody, {
    wizard,
    serviceType,
    useCalculatedPrice,
    finalPriceOverride: String(finalPriceOverride ?? ''),
    overrideReason,
    adminNote,
  })

  const inventoryJson = (wizard.inventoryLines || []).map((l) => {
    const multRaw = Number(l.mult)
    return {
      name: l.name,
      quantity: l.quantity,
      m3: l.m3,
      mult: Number.isFinite(multRaw) && multRaw > 0 ? multRaw : 1,
      weight_type: l.weightType,
      is_custom: Boolean(l.isCustom),
      category: l.categoryLabel,
    }
  })

  const built = buildQuoteRowFromTemplateParams(templateParams, extras, {
    quote_ref: ref,
    status: existing.status || 'Booked',
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
        ? editedBy || 'admin'
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

  // Preserve payment truth, booking reference, source, and workflow.
  return {
    full_name: built.full_name,
    email: built.email,
    phone: built.phone,
    service: built.service,
    service_type: built.service_type,
    pickup_address: built.pickup_address,
    delivery_address: built.delivery_address,
    move_date: built.move_date,
    arrival_window: built.arrival_window,
    arrival_type: built.arrival_type,
    arrival_time: built.arrival_time,
    distance_miles: built.distance_miles,
    crew_size: built.crew_size,
    vehicle_size: built.vehicle_size,
    details: built.details,
    pricing: built.pricing,
    inventory: built.inventory,
    inventory_text: built.inventory_text,
    estimated_total: built.estimated_total,
    calculated_total: built.calculated_total,
    agreed_price: built.agreed_price,
    remaining_balance: remaining,
    price_override_reason: built.price_override_reason,
    price_override_by: built.price_override_by,
    price_override_at: built.price_override_at,
    quote_ref: existing.quote_ref,
    source: existing.source,
    payment_status: paymentStatus,
    payment_type: existing.payment_type,
    amount_paid: existing.amount_paid,
    paid_at: existing.paid_at,
    operational_status: existing.operational_status,
    status: existing.status,
  }
}

/**
 * Compare baseline vs current wizard for the confirm step / email.
 */
export function computeAdminEditBookingChanges({
  baselineWizard,
  baselinePrice,
  baselineServiceType,
  wizard,
  serviceType,
  finalPrice,
}) {
  const before = buildCustomerFacingBookingSnapshot(baselineWizard, {
    price: baselinePrice,
    serviceType: baselineServiceType,
  })
  const after = buildCustomerFacingBookingSnapshot(wizard, {
    price: finalPrice,
    serviceType,
  })
  return diffCustomerFacingBooking(before, after)
}

/**
 * @param {Parameters<typeof buildAdminEditBookingPatch>[0] & { quoteId: string }} form
 */
export async function updateAdminBookingFromWizard(form) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }
  const quoteId = String(form.quoteId || '').trim()
  if (!quoteId) throw new Error('Missing booking id.')

  const existing = form.existing || (await fetchQuoteByIdForAdmin(quoteId))
  if (!existing) throw new Error('Booking not found.')
  if (String(existing.status || '').toLowerCase() === 'cancelled') {
    throw new Error('Cancelled bookings cannot be edited.')
  }

  const priceResolution = resolveAdminPhoneBookingFinalPrice(form.breakdown, {
    useCalculatedPrice: form.useCalculatedPrice,
    finalPriceOverride: form.finalPriceOverride,
  })
  if (priceResolution.invalid) {
    throw new Error('Enter a valid final price override, or use the calculated price.')
  }

  const finalPrice = form.finalPrice ?? priceResolution.final
  const diff = computeAdminEditBookingChanges({
    baselineWizard: form.baselineWizard,
    baselinePrice: form.baselinePrice,
    baselineServiceType: form.baselineServiceType,
    wizard: form.wizard,
    serviceType: form.serviceType,
    finalPrice,
  })
  if (!diff.hasChanges) {
    throw new Error('No changes to save.')
  }

  const patch = buildAdminEditBookingPatch({
    existing,
    wizard: form.wizard,
    serviceType: form.serviceType,
    breakdown: form.breakdown,
    useCalculatedPrice: form.useCalculatedPrice,
    finalPrice,
    finalPriceOverride: form.finalPriceOverride,
    overrideReason: form.overrideReason || '',
    adminNote: form.adminNote || '',
    editedBy: form.editedBy || '',
  })

  const { data, error } = await supabase
    .from(QUOTES_TABLE)
    .update(patch)
    .eq('id', quoteId)
    .select('id, quote_ref, email, full_name')
    .single()

  if (error) throw new Error(error.message || 'Could not update booking.')

  const changeSetId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `edit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  return {
    id: String(data.id),
    quote_ref: String(data.quote_ref),
    email: String(data.email || ''),
    full_name: String(data.full_name || ''),
    changes: diff.changes,
    changeSetId,
  }
}

/**
 * Send (or retry) the customer booking-updated email for a saved change set.
 * Idempotent per changeSetId — already-sent notifications are not duplicated.
 * @param {{
 *   quoteId: string,
 *   changeSetId: string,
 *   changes: Array<{ label: string, previous: string, next: string, kind?: string }>,
 *   quoteRef?: string,
 * }} params
 */
export async function sendBookingUpdatedCustomerEmail(params) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }
  const quoteId = String(params.quoteId || '').trim()
  const changeSetId = String(params.changeSetId || '').trim()
  if (!quoteId || !changeSetId) throw new Error('Missing booking or change set id.')
  if (!Array.isArray(params.changes) || params.changes.length === 0) {
    throw new Error('No changes to notify.')
  }

  const { data, error } = await supabase.functions.invoke('notify-booking-updated', {
    body: {
      quote_id: quoteId,
      change_set_id: changeSetId,
      changes: params.changes,
      quote_ref: params.quoteRef || '',
    },
  })

  // Non-2xx responses often put JSON on error.context; prefer that over a generic FunctionsHttpError.
  let payload = data
  if ((!payload || typeof payload !== 'object') && error) {
    try {
      const ctx = /** @type {{ context?: Response } | undefined} */ (error)?.context
      if (ctx && typeof ctx.json === 'function') {
        payload = await ctx.json()
      }
    } catch {
      /* ignore */
    }
  }

  if (payload && payload.ok === false && !payload.skipped) {
    throw new Error(payload.error || payload.message || 'Could not send customer email.')
  }
  if (payload && (payload.ok === true || payload.skipped)) {
    return payload
  }
  if (error) throw new Error(error.message || 'Could not send customer email.')
  return payload
}
