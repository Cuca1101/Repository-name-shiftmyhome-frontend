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
  generateQuoteRef,
  buildQuoteRowFromTemplateParams,
} from './data/quotesRepository'
import { updateCustomerLeadById } from './data/customerLeadsRepository'
import { isSupabaseConfigured, supabase } from './supabase'
import {
  buildQuoteEmailTemplateParams,
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
 * @param {{
 *   createdBy: string,
 *   convert?: boolean,
 * }} opts
 */
export function buildQuoteRowFromCustomerLead(lead, { createdBy, convert = true }) {
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
  const ref = String(lead.quote_ref || '').trim() || generateQuoteRef()
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
  if (lead.price_override_by) {
    detailsLines.push(
      `Override by: ${lead.price_override_by}${
        lead.price_override_at ? ` at ${lead.price_override_at}` : ''
      }`,
    )
  }
  if (wizard.specialInstructions) {
    detailsLines.push('', `Customer notes: ${wizard.specialInstructions}`)
  }

  const inventorySummary =
    wizard.inventoryLines.length > 0
      ? wizard.inventoryLines
          .map((l) => `${l.quantity || 1}× ${l.name || 'Item'} (${l.m3 ?? '?'} m³)`)
          .join('\n')
      : ''

  const pricingText = [
    calculated != null ? `Calculated total: £${calculated.toFixed(2)}` : null,
    chargeable != null ? `Admin agreed / chargeable: £${chargeable.toFixed(2)}` : null,
    isOverride ? 'Manual admin price override applied (Pricing Engine unchanged).' : null,
  ]
    .filter(Boolean)
    .join('\n')

  const templateParams = buildQuoteEmailTemplateParams({
    name: wizard.fullName,
    email: wizard.email || 'lead@shiftmyhome.local',
    phone: wizard.phone,
    service: serviceType,
    pickup: wizard.pickupAddress,
    delivery: wizard.deliveryAddress,
    move_date: wizard.moveDate,
    quote_ref: ref,
    details: detailsLines.join('\n'),
    inventory: inventorySummary || undefined,
    pricing: pricingText,
    arrival_type: wizard.arrivalWindow === 'exact' ? 'exact' : 'window',
    arrival_time: getWizardArrivalTimePayload(wizard),
  })

  const inventoryJson = wizard.inventoryLines.map((l) => ({
    name: l.name,
    quantity: l.quantity,
    m3: l.m3,
    mult: l.mult ?? 1,
    weight_type: l.weightType,
    is_custom: Boolean(l.isCustom),
    category: l.categoryLabel,
  }))

  return buildQuoteRowFromTemplateParams(
    templateParams,
    {
      arrival_window: formatWizardArrivalSummary(wizard) || null,
      distance_miles: wizard.distanceMiles || null,
      crew_size: wizard.crewSize != null ? Number(wizard.crewSize) : null,
    },
    {
      quote_ref: ref,
      source: ADMIN_PHONE_BOOKING_SOURCE,
      status: 'Booked',
      payment_status: 'unpaid',
      payment_type: null,
      amount_paid: 0,
      paid_at: null,
      operational_status: PHONE_BOOKING_PENDING_OPERATIONAL_STATUS,
      estimated_total: calculated,
      calculated_total: calculated,
      agreed_price: isOverride ? chargeable : null,
      remaining_balance: chargeable,
      price_override_reason: isOverride ? String(lead.price_override_reason || '').trim() || null : null,
      price_override_by: isOverride ? lead.price_override_by || createdBy || null : null,
      price_override_at: isOverride ? lead.price_override_at || new Date().toISOString() : null,
      details: detailsLines.join('\n'),
      inventory: inventoryJson.length ? inventoryJson : [],
      pricing: pricingText,
    },
  )
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
    // Keep estimated_total as the original engine quote when known.
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

  // Sync linked quote if present.
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

/**
 * Create (or update) a quotes booking from the lead and mark converted.
 * @param {{
 *   lead: Record<string, unknown>,
 *   createdBy: string,
 * }} params
 */
export async function convertCustomerLeadToBooking({ lead, createdBy }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }
  if (!lead?.id) throw new Error('Lead not found.')

  const chargeable = resolveChargeableTotal(lead)
  if (chargeable == null || chargeable < 1) {
    throw new Error('Set an admin agreed price (or ensure a calculated quote exists) before converting.')
  }

  let quoteId = lead.quote_id ? String(lead.quote_id) : null
  let quoteRef = String(lead.quote_ref || '').trim()

  if (quoteId) {
    const calculated = resolveCalculatedTotal(lead)
    const isOverride =
      calculated != null && Math.abs(calculated - chargeable) > 0.009
    const { error } = await supabase
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
        price_override_at: isOverride
          ? lead.price_override_at || new Date().toISOString()
          : null,
      })
      .eq('id', quoteId)
    if (error) throw new Error(error.message || 'Failed to update booking price.')
  } else {
    const row = buildQuoteRowFromCustomerLead(lead, { createdBy, convert: true })
    const { data, error } = await supabase
      .from('quotes')
      .insert(row)
      .select('id, quote_ref')
      .single()
    if (error) throw new Error(error.message || 'Failed to create booking.')
    quoteId = String(data.id)
    quoteRef = String(data.quote_ref)
  }

  const updated = await updateCustomerLeadById(String(lead.id), {
    quote_id: quoteId,
    quote_ref: quoteRef,
    status: 'converted_to_booking',
    converted_at: new Date().toISOString(),
    // Keep payment recovery available until paid — admin still sends payment link.
    recovery_stopped_at: null,
    last_activity_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  return { lead: updated, quoteId, quoteRef }
}
