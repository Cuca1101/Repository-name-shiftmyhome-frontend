/**
 * Convert a customer lead into a quotes booking using the admin agreed price.
 */
import {
  resolveCalculatedTotal,
  resolveChargeableTotal,
} from './adminAgreedPrice'
import {
  ADMIN_PHONE_BOOKING_SOURCE,
  PHONE_BOOKING_PENDING_OPERATIONAL_STATUS,
  insertAdminPhoneBooking,
} from './data/quotesRepository'
import { updateCustomerLeadById } from './data/customerLeadsRepository'
import {
  fetchQuoteByIdForAdmin,
  releaseAdminPhoneBookingToAvailableJobs,
} from './data/quotesAdminRepository'
import {
  quoteIsAdminPhoneBookingPending,
  quotePassesAvailableJobsStrict,
} from './adminJobListRules'
import { isSupabaseConfigured, supabase } from './supabase'
import {
  formatWizardArrivalSummary,
  getWizardArrivalTimePayload,
} from './emailQuotePayload'
import { resolveServiceLabel } from './normalizeServiceType'

/**
 * @param {Record<string, unknown>} lead
 */
function wizardFromLead(lead) {
  const wd = lead.wizard_data && typeof lead.wizard_data === 'object' ? lead.wizard_data : {}
  const s1 = wd.step1 && typeof wd.step1 === 'object' ? wd.step1 : {}
  const s2 = wd.step2 && typeof wd.step2 === 'object' ? wd.step2 : {}
  const s3 = wd.step3 && typeof wd.step3 === 'object' ? wd.step3 : {}

  return {
    fullName: String(lead.customer_name || s2.fullName || '').trim(),
    phone: String(lead.customer_phone || s2.phone || '').trim(),
    email: String(lead.customer_email || s2.email || '').trim(),
    pickupAddress: String(lead.pickup_address || s1.pickupAddress || '').trim(),
    deliveryAddress: String(lead.delivery_address || s1.deliveryAddress || '').trim(),
    moveDate: String(lead.move_date || s3.selectedMoveDate || s1.moveDate || '').trim(),
    distanceMiles: Number(s1.distanceMiles ?? lead.distance_miles) || 0,
    crewSize: s3.crewSize ?? s2.crewSize ?? null,
    arrivalWindow: s1.arrivalWindow || 'morning',
    exactArrivalTime: s1.exactArrivalTime || '',
    flexibleArrivalFrom: s1.flexibleArrivalFrom || '',
    flexibleArrivalUntil: s1.flexibleArrivalUntil || '',
    inventoryLines: Array.isArray(s2.inventoryLines) ? s2.inventoryLines : [],
    specialInstructions: s3.specialInstructions || '',
    packing: Boolean(s3.packing),
    packingWhat: s3.packingWhat || '',
    packingMaterials: Boolean(s3.packingMaterials),
    packingMaterialsDetail: s3.packingMaterialsDetail || '',
    dismantling: Boolean(s3.dismantling),
    dismantlingItemCount: s3.dismantlingItemCount || 0,
    dismantlingWhat: s3.dismantlingWhat || '',
    reassembly: Boolean(s3.reassembly),
    reassemblyItemCount: s3.reassemblyItemCount || 0,
    reassemblyWhat: s3.reassemblyWhat || '',
  }
}

/**
 * @param {Record<string, unknown>} lead
 * @param {{ createdBy: string, convert?: boolean }} opts
 */
function buildAdminPhoneBookingFormFromLead(lead, { createdBy, convert = true }) {
  const wizard = wizardFromLead(lead)
  const serviceType =
    resolveServiceLabel(lead.service_type) ||
    resolveServiceLabel(
      lead.wizard_data &&
        typeof lead.wizard_data === 'object' &&
        lead.wizard_data.step1 &&
        typeof lead.wizard_data.step1 === 'object'
        ? lead.wizard_data.step1.serviceType
        : '',
    ) ||
    'House Removals'
  const calculated = resolveCalculatedTotal(lead)
  const chargeable = resolveChargeableTotal(lead)
  const isOverride =
    calculated != null &&
    chargeable != null &&
    Math.abs(calculated - chargeable) > 0.009

  const detailsLines = [
    createdBy ? `Created by admin (${createdBy}) from customer lead` : 'Created by admin from customer lead',
    convert ? 'Converted from website / customer lead' : 'Manual quote from customer lead',
    `Calculated price: £${(calculated ?? 0).toFixed(2)}`,
    `Admin agreed price: £${(chargeable ?? calculated ?? 0).toFixed(2)}`,
  ]
  if (isOverride && lead.price_override_reason) {
    detailsLines.push(`Price override reason: ${String(lead.price_override_reason).trim()}`)
  }
  if (wizard.specialInstructions) {
    detailsLines.push('', `Customer notes: ${wizard.specialInstructions}`)
  }
  if (wizard.inventoryLines.length > 0) {
    detailsLines.push(
      '',
      'Inventory:',
      ...wizard.inventoryLines.map(
        (l) => `- ${l.quantity || 1}× ${l.name || 'Item'} (${l.m3 ?? '?'} m³)`,
      ),
    )
  }
  const arrival = formatWizardArrivalSummary(wizard) || getWizardArrivalTimePayload(wizard) || ''

  return {
    quote_ref: String(lead.quote_ref || '').trim() || undefined,
    name: wizard.fullName || 'Customer',
    email: wizard.email || 'lead@shiftmyhome.local',
    phone: wizard.phone || '00000000000',
    service: serviceType,
    pickup: wizard.pickupAddress,
    delivery: wizard.deliveryAddress,
    move_date: wizard.moveDate || new Date().toISOString().slice(0, 10),
    arrival_time: arrival || undefined,
    details: detailsLines.join('\n'),
    payment_mode: /** @type {'quote_only'} */ ('quote_only'),
    estimated_total: chargeable ?? calculated,
    created_by: createdBy,
  }
}

/**
 * Addresses / contact already on the lead — used before insert so we never open an empty form.
 * @param {Record<string, unknown>} lead
 */
export function getCustomerLeadBookingSummary(lead) {
  const wizard = wizardFromLead(lead)
  return {
    pickupAddress: wizard.pickupAddress,
    deliveryAddress: wizard.deliveryAddress,
    fullName: wizard.fullName,
    phone: wizard.phone,
    email: wizard.email,
    moveDate: wizard.moveDate,
    hasAddresses: Boolean(wizard.pickupAddress && wizard.deliveryAddress),
  }
}

/**
 * Save admin agreed price on a customer lead (preserves calculated_total).
 * @param {{
 *   leadId: string,
 *   agreedPrice: number,
 *   reason?: string,
 *   adminLabel: string,
 *   currentLead: Record<string, unknown>,
 * }} params
 */
export async function saveCustomerLeadAgreedPrice({
  leadId,
  agreedPrice,
  reason = '',
  adminLabel,
  currentLead,
}) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }

  const calculated =
    resolveCalculatedTotal(currentLead) ??
    (Number.isFinite(Number(currentLead.estimated_total))
      ? Number(currentLead.estimated_total)
      : null)

  const previousSessionId = String(currentLead.stripe_checkout_session_id || '').trim()
  const previousAmount = Number(currentLead.stripe_payment_link_amount)
  const amountChanged =
    !Number.isFinite(previousAmount) || Math.abs(previousAmount - agreedPrice) > 0.009

  const patch = {
    calculated_total: calculated,
    estimated_total: calculated ?? currentLead.estimated_total ?? null,
    agreed_price: agreedPrice,
    price_override_reason: String(reason || '').trim() || null,
    price_override_by: String(adminLabel || 'admin').trim() || 'admin',
    price_override_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (amountChanged && previousSessionId) {
    patch.stripe_checkout_session_id = null
    patch.stripe_payment_link_url = null
    patch.stripe_payment_link_amount = null
  }

  const updated = await updateCustomerLeadById(leadId, patch)
  if (!updated) throw new Error('Failed to save agreed price.')

  const quoteId = updated.quote_id || currentLead.quote_id
  if (quoteId) {
    await supabase
      .from('quotes')
      .update({
        calculated_total: calculated,
        estimated_total: calculated,
        agreed_price: agreedPrice,
        remaining_balance: agreedPrice,
        price_override_reason: patch.price_override_reason,
        price_override_by: patch.price_override_by,
        price_override_at: patch.price_override_at,
      })
      .eq('id', quoteId)
  }

  return { lead: updated, previousSessionId: amountChanged ? previousSessionId : '' }
}

export async function convertCustomerLeadToBooking({ lead, createdBy }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }
  if (!lead?.id) throw new Error('Lead not found.')

  const summary = getCustomerLeadBookingSummary(lead)
  if (!summary.hasAddresses) {
    throw new Error(
      'This lead is missing pickup or delivery address in the saved quote data. Open Details to check what was captured.',
    )
  }
  if (!summary.fullName || !summary.phone) {
    throw new Error('This lead is missing customer name or phone. Open Details and check contact details.')
  }

  const chargeable = resolveChargeableTotal(lead)
  if (chargeable == null || chargeable < 1) {
    throw new Error('Set an admin agreed price (or ensure a calculated quote exists) before converting.')
  }

  const calculated = resolveCalculatedTotal(lead)
  const isOverride =
    calculated != null && Math.abs(calculated - chargeable) > 0.009

  let quoteId = lead.quote_id ? String(lead.quote_id) : null
  let quoteRef = String(lead.quote_ref || '').trim()

  if (quoteId) {
    const existing = await fetchQuoteByIdForAdmin(quoteId)
    if (!existing) {
      // Stale quote_id on lead — create a fresh phone booking instead.
      quoteId = null
    } else {
      const { error } = await supabase
        .from('quotes')
        .update({
          full_name: summary.fullName || existing.full_name,
          phone: summary.phone || existing.phone,
          email: summary.email || existing.email || 'lead@shiftmyhome.local',
          pickup_address: summary.pickupAddress || existing.pickup_address,
          delivery_address: summary.deliveryAddress || existing.delivery_address,
          move_date: summary.moveDate || existing.move_date,
          source: ADMIN_PHONE_BOOKING_SOURCE,
          status: 'Booked',
          payment_status: 'unpaid',
          // Released immediately so it appears in Available Jobs.
          operational_status: null,
          marketplace_visibility: 'hidden_from_partners',
          assigned_driver_id: null,
          assigned_partner_id: null,
          bundled_journey_id: null,
          calculated_total: calculated,
          estimated_total: calculated,
          agreed_price: isOverride ? chargeable : null,
          remaining_balance: chargeable,
          price_override_reason: isOverride
            ? String(lead.price_override_reason || '').trim() || null
            : null,
          price_override_by: isOverride ? lead.price_override_by || createdBy : null,
          price_override_at: isOverride
            ? lead.price_override_at || new Date().toISOString()
            : null,
        })
        .eq('id', quoteId)
      if (error) throw new Error(error.message || 'Failed to update booking for Available Jobs.')
      quoteRef = String(existing.quote_ref || quoteRef)
    }
  }

  if (!quoteId) {
    const form = buildAdminPhoneBookingFormFromLead(lead, { createdBy, convert: true })
    let created
    try {
      created = await insertAdminPhoneBooking(form)
    } catch (e) {
      throw new Error(
        e?.message
          ? `Failed to create booking: ${e.message}`
          : 'Failed to create booking. Check you are signed in as admin.',
      )
    }
    quoteId = String(created.id)
    quoteRef = String(created.quote_ref)

    // Attach agreed/calculated totals (insertAdminPhoneBooking stores estimated via payment_mode).
    const { error: priceErr } = await supabase
      .from('quotes')
      .update({
        calculated_total: calculated,
        estimated_total: calculated,
        agreed_price: isOverride ? chargeable : null,
        remaining_balance: chargeable,
        price_override_reason: isOverride
          ? String(lead.price_override_reason || '').trim() || null
          : null,
        price_override_by: isOverride ? lead.price_override_by || createdBy : null,
        price_override_at: isOverride ? lead.price_override_at || new Date().toISOString() : null,
        // null = released to Available Jobs (unpaid phone booking).
        operational_status: null,
        marketplace_visibility: 'hidden_from_partners',
        status: 'Booked',
        payment_status: 'unpaid',
      })
      .eq('id', quoteId)
    if (priceErr) {
      throw new Error(priceErr.message || 'Booking created but price fields failed to save.')
    }
  }

  const updated = await updateCustomerLeadById(String(lead.id), {
    quote_id: quoteId,
    quote_ref: quoteRef,
    status: 'converted_to_booking',
    converted_at: new Date().toISOString(),
    recovery_stopped_at: null,
    last_activity_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  return { lead: updated, quoteId, quoteRef }
}

/**
 * Ensure a lead-converted quote can enter Available Jobs as an unpaid phone booking.
 * @param {string} quoteId
 * @returns {Promise<{ alreadyVisible: boolean }>}
 */
async function ensureLeadQuoteReadyForAvailableJobs(quoteId) {
  const row = await fetchQuoteByIdForAdmin(quoteId)
  if (!row) throw new Error('Booking not found after convert.')

  if (quotePassesAvailableJobsStrict(row)) {
    return { alreadyVisible: true }
  }

  // Force unpaid phone booking released state (shows in Available Jobs).
  const { error } = await supabase
    .from('quotes')
    .update({
      source: ADMIN_PHONE_BOOKING_SOURCE,
      operational_status: null,
      marketplace_visibility: 'hidden_from_partners',
      status: String(row.status || '') === 'Cancelled' ? row.status : 'Booked',
      payment_status: 'unpaid',
      assigned_driver_id: null,
      assigned_driver_name: null,
      assigned_partner_id: null,
      bundled_journey_id: null,
    })
    .eq('id', quoteId)
  if (error) {
    throw new Error(error.message || 'Failed to prepare booking for Available Jobs.')
  }

  const updated = await fetchQuoteByIdForAdmin(quoteId)
  if (!updated || !quotePassesAvailableJobsStrict(updated)) {
    // Fall back to pending → release path used by New phone booking.
    if (!quoteIsAdminPhoneBookingPending(updated || {})) {
      await supabase
        .from('quotes')
        .update({ operational_status: PHONE_BOOKING_PENDING_OPERATIONAL_STATUS })
        .eq('id', quoteId)
    }
    return { alreadyVisible: false }
  }
  return { alreadyVisible: true }
}

/**
 * Convert lead → unpaid phone booking using saved lead details, then optionally
 * release straight to Available Jobs (no re-typing addresses).
 * @param {{
 *   lead: Record<string, unknown>,
 *   createdBy: string,
 *   releaseToAvailableJobs?: boolean,
 * }} params
 */
export async function convertCustomerLeadToUnpaidJob({
  lead,
  createdBy,
  releaseToAvailableJobs = true,
}) {
  const result = await convertCustomerLeadToBooking({ lead, createdBy })
  if (!releaseToAvailableJobs || !result.quoteId) {
    return { ...result, releasedToAvailableJobs: false }
  }

  const ready = await ensureLeadQuoteReadyForAvailableJobs(result.quoteId)
  if (ready.alreadyVisible) {
    return { ...result, releasedToAvailableJobs: true, alreadyReleased: true }
  }

  try {
    await releaseAdminPhoneBookingToAvailableJobs(result.quoteId)
    return { ...result, releasedToAvailableJobs: true }
  } catch (e) {
    const msg = String(e?.message || e || '')
    // Already released earlier — treat as success for this admin action.
    if (/already in Available Jobs/i.test(msg)) {
      return { ...result, releasedToAvailableJobs: true, alreadyReleased: true }
    }
    throw e
  }
}
