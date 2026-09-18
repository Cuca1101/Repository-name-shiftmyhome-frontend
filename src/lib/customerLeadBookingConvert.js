import {
  resolveCalculatedTotal,
  resolveChargeableTotal,
} from './adminAgreedPrice'
import {
  ADMIN_PHONE_BOOKING_SOURCE,
  ADMIN_PHONE_BOOKING_SOURCES,
  PHONE_BOOKING_PENDING_OPERATIONAL_STATUS,
  insertAdminPhoneBooking,
} from './data/quotesRepository'
import { updateCustomerLeadById } from './data/customerLeadsRepository'
import {
  fetchQuoteByIdForAdmin,
  releaseAdminPhoneBookingToAvailableJobs,
} from './data/quotesAdminRepository'
import {
  quoteHasAssignedDriver,
  quoteHasAssignedPartner,
  quoteIsAdminPhoneBooking,
  quoteIsCardPaid,
  quotePassesAvailableJobsStrict,
  quoteIsAdminPhoneBookingPending,
} from './adminJobListRules'
import { isSupabaseConfigured, supabase } from './supabase'
import {
  formatWizardArrivalSummary,
  getWizardArrivalTimePayload,
} from './emailQuotePayload'
import { resolveServiceLabel } from './normalizeServiceType'

/** Stored on lead.wizard_data so Undo can restore prior lead + quote shape. */
const CONVERT_SNAPSHOT_KEY = '_smh_admin_convert'

const RESTORABLE_LEAD_STATUSES = new Set([
  'new_lead',
  'quote_started',
  'quote_viewed',
  'payment_started',
  'abandoned',
  'payment_failed',
])

/**
 * @param {Record<string, unknown> | null | undefined} lead
 * @returns {Record<string, unknown>}
 */
function wizardDataObject(lead) {
  return lead?.wizard_data && typeof lead.wizard_data === 'object' && !Array.isArray(lead.wizard_data)
    ? { ...lead.wizard_data }
    : {}
}

/**
 * @param {Record<string, unknown> | null | undefined} lead
 */
function readConvertSnapshot(lead) {
  const wd = wizardDataObject(lead)
  const snap = wd[CONVERT_SNAPSHOT_KEY]
  return snap && typeof snap === 'object' ? snap : null
}

/**
 * @param {Record<string, unknown>} quote
 */
function quoteSnapshotFields(quote) {
  return {
    source: quote.source ?? null,
    status: quote.status ?? null,
    payment_status: quote.payment_status ?? null,
    operational_status: quote.operational_status ?? null,
    marketplace_visibility: quote.marketplace_visibility ?? null,
    calculated_total: quote.calculated_total ?? null,
    estimated_total: quote.estimated_total ?? null,
    agreed_price: quote.agreed_price ?? null,
    remaining_balance: quote.remaining_balance ?? null,
    price_override_reason: quote.price_override_reason ?? null,
    price_override_by: quote.price_override_by ?? null,
    price_override_at: quote.price_override_at ?? null,
  }
}

/**
 * @param {Record<string, unknown>} lead
 * @param {{ quoteCreatedByConvert: boolean, quoteBefore: Record<string, unknown> | null, quoteIdBefore: string | null }} meta
 */
function buildConvertWizardData(lead, meta) {
  const wd = wizardDataObject(lead)
  const previousRaw = String(lead.status || 'abandoned')
  const previousStatus =
    previousRaw === 'converted_to_booking'
      ? String(readConvertSnapshot(lead)?.previousStatus || 'abandoned')
      : previousRaw
  const safePrevious = RESTORABLE_LEAD_STATUSES.has(previousStatus) ? previousStatus : 'abandoned'

  return {
    ...wd,
    [CONVERT_SNAPSHOT_KEY]: {
      previousStatus: safePrevious,
      quoteIdBefore: meta.quoteIdBefore,
      quoteCreatedByConvert: Boolean(meta.quoteCreatedByConvert),
      quoteBefore: meta.quoteBefore,
      at: new Date().toISOString(),
    },
  }
}

/**
 * @param {Record<string, unknown>} lead
 * @param {Record<string, unknown> | null} [quote]
 */
export function canRevertCustomerLeadConversion(lead, quote = null) {
  if (!lead?.id) return { ok: false, reason: 'Lead not found.' }
  if (String(lead.status || '') !== 'converted_to_booking') {
    return { ok: false, reason: 'Lead is not converted.' }
  }
  if (!lead.quote_id) {
    return { ok: true, reason: '' }
  }
  if (!quote) {
    return { ok: true, reason: '' }
  }
  // Only block real card payment — abandoned Stripe sessions on unpaid quotes are OK.
  if (quoteIsCardPaid(quote) || quote.paid_at) {
    return { ok: false, reason: 'This booking was paid by card — cannot undo.' }
  }
  if (quoteHasAssignedDriver(quote) || quoteHasAssignedPartner(quote)) {
    return { ok: false, reason: 'Job is already assigned — unassign first.' }
  }
  if (quote.bundled_journey_id) {
    return { ok: false, reason: 'Job is on a journey bundle — cannot undo.' }
  }
  const ps = String(quote.payment_status || '').trim().toLowerCase()
  if (ps && ps !== 'unpaid') {
    return { ok: false, reason: 'Only unpaid (not card-paid) conversions can be undone.' }
  }
  return { ok: true, reason: '' }
}
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
 * @param {{ createdBy: string, convert?: boolean, freshQuoteRef?: boolean }} opts
 */
function buildAdminPhoneBookingFormFromLead(lead, { createdBy, convert = true, freshQuoteRef = false }) {
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
    // Never reuse website quote_ref on insert — avoids unique constraint collisions.
    quote_ref: freshQuoteRef ? undefined : String(lead.quote_ref || '').trim() || undefined,
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
 * Fields required so an unpaid phone booking appears in Available Jobs.
 * Clears archive/test/cancel flags that hide rows from production admin inboxes.
 * @param {{
 *   summary: ReturnType<typeof getCustomerLeadBookingSummary>,
 *   chargeable: number,
 *   calculated: number | null,
 *   lead: Record<string, unknown>,
 *   createdBy: string,
 *   existing?: Record<string, unknown> | null,
 * }} p
 */
function buildLeadUnpaidJobPatch({ summary, chargeable, calculated, lead, createdBy, existing = null }) {
  const calc = calculated ?? chargeable
  return {
    full_name: summary.fullName || existing?.full_name || 'Customer',
    phone: summary.phone || existing?.phone || '',
    email: summary.email || existing?.email || 'lead@shiftmyhome.local',
    pickup_address: summary.pickupAddress || existing?.pickup_address || '',
    delivery_address: summary.deliveryAddress || existing?.delivery_address || '',
    move_date: summary.moveDate || existing?.move_date || new Date().toISOString().slice(0, 10),
    source: ADMIN_PHONE_BOOKING_SOURCE,
    status: 'Booked',
    payment_status: 'unpaid',
    payment_type: null,
    // amount_paid is NOT NULL in DB — unpaid jobs use 0, never null.
    amount_paid: 0,
    paid_at: null,
    // Released to Available Jobs (not phone_booking_pending).
    operational_status: null,
    marketplace_visibility: 'hidden_from_partners',
    assigned_driver_id: null,
    assigned_driver_name: null,
    assigned_partner_id: null,
    bundled_journey_id: null,
    // Always persist the chargeable admin price (£250 etc.) on the job.
    calculated_total: calc,
    estimated_total: chargeable,
    agreed_price: chargeable,
    remaining_balance: chargeable,
    price_override_reason: String(lead.price_override_reason || '').trim() || null,
    price_override_by: lead.price_override_by || createdBy || null,
    price_override_at: lead.price_override_at || new Date().toISOString(),
    // Production inbox hides archived / test rows — clear so convert is visible.
    archived_for_go_live: false,
    is_test: false,
    cancelled_at: null,
    completed_at: null,
    admin_cancellation_reason: null,
  }
}

/**
 * Explain why a quote is not yet in Available Jobs (for admin error messages).
 * @param {Record<string, unknown> | null | undefined} q
 */
export function explainAvailableJobsBlocker(q) {
  if (!q) return 'Booking row missing after create.'
  if (!quotePassesAvailableJobsStrict(q)) {
    const bits = []
    if (String(q.source || '') !== ADMIN_PHONE_BOOKING_SOURCE && String(q.source || '') !== 'admin_phone_booking') {
      bits.push(`source=${q.source || 'null'}`)
    }
    if (String(q.payment_status || '') !== 'unpaid' && !quoteIsCardPaid(q)) {
      bits.push(`payment_status=${q.payment_status || 'null'}`)
    }
    if (String(q.operational_status || '').toLowerCase() === PHONE_BOOKING_PENDING_OPERATIONAL_STATUS) {
      bits.push('still phone_booking_pending')
    }
    if (q.archived_for_go_live === true) bits.push('archived_for_go_live')
    if (q.is_test === true) bits.push('is_test')
    if (q.cancelled_at) bits.push('cancelled_at set')
    if (q.completed_at) bits.push('completed_at set')
    if (quoteHasAssignedDriver(q)) bits.push('driver assigned')
    if (quoteHasAssignedPartner(q)) bits.push('partner assigned')
    if (q.bundled_journey_id) bits.push('bundled journey')
    return bits.length ? bits.join(', ') : 'failed Available Jobs eligibility checks'
  }
  return ''
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

/**
 * Resolve an existing quotes row for this lead (by id, then by quote_ref).
 * Website leads often keep quote_ref but clear/lose quote_id — reusing avoids
 * unique constraint 23505 on quote_ref inserts.
 * @param {Record<string, unknown>} lead
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function findExistingQuoteForLead(lead) {
  if (lead.quote_id) {
    const byId = await fetchQuoteByIdForAdmin(String(lead.quote_id))
    if (byId) return byId
  }
  const ref = String(lead.quote_ref || '').trim()
  if (!ref || !supabase) return null
  const { data, error } = await supabase.from('quotes').select('*').eq('quote_ref', ref).maybeSingle()
  if (error) throw new Error(error.message || 'Failed to look up existing booking by quote_ref.')
  return data ?? null
}

/**
 * Link lead → quote without marking converted (duplicate-click safety).
 * @param {Record<string, unknown>} lead
 * @param {string} quoteId
 * @param {string} quoteRef
 */
async function linkLeadQuoteIds(lead, quoteId, quoteRef) {
  if (String(lead.quote_id || '') === quoteId && String(lead.quote_ref || '') === quoteRef) {
    return lead
  }
  const updated = await updateCustomerLeadById(String(lead.id), {
    quote_id: quoteId,
    quote_ref: quoteRef,
    last_activity_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  return updated || { ...lead, quote_id: quoteId, quote_ref: quoteRef }
}

/**
 * Create/update unpaid phone booking from lead — does NOT mark the lead converted.
 * Caller must mark lead only after Available Jobs eligibility is confirmed.
 * @param {{ lead: Record<string, unknown>, createdBy: string }} params
 */
export async function convertCustomerLeadToBooking({ lead, createdBy }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }
  if (!lead?.id) throw new Error('Lead not found.')

  // Idempotent: already converted with a live Available Jobs booking.
  if (String(lead.status || '') === 'converted_to_booking' && lead.quote_id) {
    const existingConverted = await fetchQuoteByIdForAdmin(String(lead.quote_id))
    if (existingConverted && quotePassesAvailableJobsStrict(existingConverted)) {
      return {
        lead,
        quoteId: String(existingConverted.id),
        quoteRef: String(existingConverted.quote_ref || lead.quote_ref || ''),
        alreadyConverted: true,
        quoteCreatedByConvert: false,
        quoteBefore: null,
        quoteIdBefore: String(lead.quote_id),
      }
    }
  }

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

  let quoteId = lead.quote_id ? String(lead.quote_id) : null
  let quoteRef = String(lead.quote_ref || '').trim()
  let quoteCreatedByConvert = !quoteId
  /** @type {Record<string, unknown> | null} */
  let quoteBefore = null
  const quoteIdBefore = quoteId
  /** @type {Record<string, unknown>} */
  let workingLead = lead

  let existing = await findExistingQuoteForLead(lead)
  if (existing && (quoteIsCardPaid(existing) || existing.paid_at)) {
    // Never mutate a card-paid booking into an unpaid phone job — create a fresh unpaid job.
    existing = null
    quoteId = null
    quoteCreatedByConvert = true
    quoteBefore = null
  }

  if (existing) {
    quoteId = String(existing.id)
    quoteRef = String(existing.quote_ref || quoteRef)
    quoteBefore = quoteSnapshotFields(existing)
    quoteCreatedByConvert = false
    const patch = buildLeadUnpaidJobPatch({
      summary,
      chargeable,
      calculated,
      lead,
      createdBy,
      existing,
    })
    const { error } = await supabase.from('quotes').update(patch).eq('id', quoteId)
    if (error) throw new Error(error.message || 'Failed to update booking for Available Jobs.')
  } else {
    const form = buildAdminPhoneBookingFormFromLead(lead, {
      createdBy,
      convert: true,
      // Never reuse website quote_ref on insert — unique constraint 23505 if row already exists.
      freshQuoteRef: true,
    })
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
    quoteCreatedByConvert = true

    const patch = buildLeadUnpaidJobPatch({
      summary,
      chargeable,
      calculated,
      lead,
      createdBy,
      existing: null,
    })
    const { error: priceErr } = await supabase.from('quotes').update(patch).eq('id', quoteId)
    if (priceErr) {
      // Roll back orphan booking so we do not leave a half-created job.
      try {
        await supabase.from('quotes').delete().eq('id', quoteId)
      } catch {
        /* best effort */
      }
      throw new Error(priceErr.message || 'Booking created but price fields failed to save.')
    }
  }

  // Persist quote link before marking converted — second click updates this job instead of inserting another.
  workingLead = await linkLeadQuoteIds(workingLead, quoteId, quoteRef)

  return {
    lead: workingLead,
    quoteId,
    quoteRef,
    alreadyConverted: false,
    quoteCreatedByConvert,
    quoteBefore,
    quoteIdBefore,
  }
}

/**
 * Ensure a lead-converted quote can enter Available Jobs as an unpaid phone booking.
 * @param {string} quoteId
 * @param {{ lead: Record<string, unknown>, createdBy: string, chargeable: number, calculated: number | null, summary: ReturnType<typeof getCustomerLeadBookingSummary> }} ctx
 * @returns {Promise<{ alreadyVisible: boolean, quote: Record<string, unknown> }>}
 */
async function ensureLeadQuoteReadyForAvailableJobs(quoteId, ctx) {
  let row = await fetchQuoteByIdForAdmin(quoteId)
  if (!row) throw new Error('Booking not found after convert.')

  if (quotePassesAvailableJobsStrict(row)) {
    return { alreadyVisible: true, quote: row }
  }

  const patch = buildLeadUnpaidJobPatch({
    summary: ctx.summary,
    chargeable: ctx.chargeable,
    calculated: ctx.calculated,
    lead: ctx.lead,
    createdBy: ctx.createdBy,
    existing: row,
  })
  const { error } = await supabase.from('quotes').update(patch).eq('id', quoteId)
  if (error) {
    throw new Error(error.message || 'Failed to prepare booking for Available Jobs.')
  }

  row = await fetchQuoteByIdForAdmin(quoteId)
  if (row && quotePassesAvailableJobsStrict(row)) {
    return { alreadyVisible: true, quote: row }
  }

  // Last resort: stage as pending then release (same path as New phone booking).
  await supabase
    .from('quotes')
    .update({ operational_status: PHONE_BOOKING_PENDING_OPERATIONAL_STATUS })
    .eq('id', quoteId)

  return { alreadyVisible: false, quote: (await fetchQuoteByIdForAdmin(quoteId)) || row }
}

/**
 * Mark lead converted only after the unpaid job is confirmed in Available Jobs.
 * @param {{
 *   lead: Record<string, unknown>,
 *   quoteId: string,
 *   quoteRef: string,
 *   quoteCreatedByConvert: boolean,
 *   quoteBefore: Record<string, unknown> | null,
 *   quoteIdBefore: string | null,
 * }} p
 */
async function markLeadConvertedAfterJobReady(p) {
  const wizard_data = buildConvertWizardData(p.lead, {
    quoteCreatedByConvert: p.quoteCreatedByConvert,
    quoteBefore: p.quoteBefore,
    quoteIdBefore: p.quoteIdBefore,
  })

  const updated = await updateCustomerLeadById(String(p.lead.id), {
    quote_id: p.quoteId,
    quote_ref: p.quoteRef,
    status: 'converted_to_booking',
    converted_at: new Date().toISOString(),
    recovery_stopped_at: null,
    wizard_data,
    last_activity_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  if (!updated) throw new Error('Job is ready but failed to mark the lead as converted.')
  return updated
}

/**
 * Convert lead → unpaid phone booking using saved lead details, then release to Available Jobs.
 * Atomic: lead is marked converted only after the job passes Available Jobs checks.
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
  const summary = getCustomerLeadBookingSummary(lead)
  const chargeable = resolveChargeableTotal(lead)
  const calculated = resolveCalculatedTotal(lead)

  const result = await convertCustomerLeadToBooking({ lead, createdBy })
  if (!releaseToAvailableJobs || !result.quoteId) {
    return { ...result, releasedToAvailableJobs: false }
  }

  if (result.alreadyConverted) {
    return { ...result, releasedToAvailableJobs: true, alreadyReleased: true }
  }

  let ready
  try {
    ready = await ensureLeadQuoteReadyForAvailableJobs(result.quoteId, {
      lead,
      createdBy,
      chargeable: chargeable ?? 0,
      calculated,
      summary,
    })
  } catch (e) {
    throw e
  }

  if (!ready.alreadyVisible) {
    try {
      await releaseAdminPhoneBookingToAvailableJobs(result.quoteId)
    } catch (e) {
      const msg = String(e?.message || e || '')
      if (!/already in Available Jobs/i.test(msg)) {
        const finalRow = await fetchQuoteByIdForAdmin(result.quoteId)
        const why = explainAvailableJobsBlocker(finalRow)
        throw new Error(
          `Job ${result.quoteRef} was created but could not enter Available Jobs (${why || msg}). Lead was not marked converted.`,
        )
      }
    }
  }

  const verified = await fetchQuoteByIdForAdmin(result.quoteId)
  if (!verified || !quotePassesAvailableJobsStrict(verified)) {
    const why = explainAvailableJobsBlocker(verified)
    throw new Error(
      `Job ${result.quoteRef} was created but is not visible in Available Jobs (${why}). Lead was not marked converted.`,
    )
  }

  const updatedLead = await markLeadConvertedAfterJobReady({
    lead,
    quoteId: result.quoteId,
    quoteRef: result.quoteRef,
    quoteCreatedByConvert: result.quoteCreatedByConvert,
    quoteBefore: result.quoteBefore,
    quoteIdBefore: result.quoteIdBefore,
  })

  return {
    ...result,
    lead: updatedLead,
    releasedToAvailableJobs: true,
    alreadyReleased: ready.alreadyVisible,
  }
}

/**
 * Stage unpaid phone booking as pending, then delete (RLS only allows pending deletes).
 * Falls back to cancelling so it leaves Available Jobs.
 * @param {string} quoteId
 * @returns {Promise<{ deleted: boolean, cancelled: boolean }>}
 */
async function removeUnpaidConvertedJob(quoteId) {
  // RLS delete requires operational_status = phone_booking_pending (released jobs use null).
  const { error: stageErr } = await supabase
    .from('quotes')
    .update({
      source: ADMIN_PHONE_BOOKING_SOURCE,
      operational_status: PHONE_BOOKING_PENDING_OPERATIONAL_STATUS,
      marketplace_visibility: 'hidden_from_partners',
      payment_status: 'unpaid',
      assigned_driver_id: null,
      assigned_driver_name: null,
      assigned_partner_id: null,
      bundled_journey_id: null,
      // Clear abandoned checkout refs so pending-delete RLS can match.
      stripe_session_id: null,
      stripe_payment_intent_id: null,
      paid_at: null,
    })
    .eq('id', quoteId)
    .eq('payment_status', 'unpaid')
  if (stageErr) {
    throw new Error(stageErr.message || 'Failed to stage job for undo.')
  }

  const { data: deletedRows, error: delErr } = await supabase
    .from('quotes')
    .delete()
    .eq('id', quoteId)
    .in('source', ADMIN_PHONE_BOOKING_SOURCES)
    .eq('operational_status', PHONE_BOOKING_PENDING_OPERATIONAL_STATUS)
    .eq('payment_status', 'unpaid')
    .select('id')

  if (delErr) {
    throw new Error(delErr.message || 'Failed to remove unpaid job.')
  }
  if (Array.isArray(deletedRows) && deletedRows.length > 0) {
    return { deleted: true, cancelled: false }
  }

  // Soft remove if RLS still blocks delete (e.g. residual Stripe columns).
  const { error: cancelErr } = await supabase
    .from('quotes')
    .update({
      status: 'Cancelled',
      operational_status: 'Cancelled',
      marketplace_visibility: 'cancelled',
      payment_status: 'unpaid',
      assigned_driver_id: null,
      assigned_driver_name: null,
      assigned_partner_id: null,
      bundled_journey_id: null,
    })
    .eq('id', quoteId)
  if (cancelErr) {
    throw new Error(cancelErr.message || 'Failed to cancel unpaid job after undo.')
  }
  return { deleted: false, cancelled: true }
}

/**
 * Undo an unpaid (non-card) lead → Available Jobs conversion.
 * Restores lead status and removes/unreleases the unpaid phone booking.
 * @param {{ lead: Record<string, unknown> }} params
 */
export async function revertCustomerLeadConversion({ lead }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }
  if (!lead?.id) throw new Error('Lead not found.')

  const quoteId = lead.quote_id ? String(lead.quote_id) : null
  let quote = null
  if (quoteId) {
    quote = await fetchQuoteByIdForAdmin(quoteId)
  }

  const gate = canRevertCustomerLeadConversion(lead, quote)
  if (!gate.ok) throw new Error(gate.reason || 'Cannot undo this conversion.')

  const snap = readConvertSnapshot(lead)
  const previousStatus = RESTORABLE_LEAD_STATUSES.has(String(snap?.previousStatus || ''))
    ? String(snap.previousStatus)
    : 'abandoned'

  let quoteDeleted = false
  let quoteUnreleased = false
  let quoteCancelled = false

  if (quoteId && quote) {
    const createdByConvert = snap?.quoteCreatedByConvert === true
    const hadPriorQuote =
      Boolean(snap?.quoteIdBefore) && String(snap.quoteIdBefore) === quoteId

    if (createdByConvert && !hadPriorQuote) {
      const removed = await removeUnpaidConvertedJob(quoteId)
      quoteDeleted = removed.deleted
      quoteCancelled = removed.cancelled
    } else if (snap?.quoteBefore && typeof snap.quoteBefore === 'object') {
      const before = snap.quoteBefore
      const { error } = await supabase
        .from('quotes')
        .update({
          source: before.source ?? quote.source,
          status: before.status ?? 'New',
          payment_status: before.payment_status ?? 'unpaid',
          operational_status:
            before.operational_status ?? PHONE_BOOKING_PENDING_OPERATIONAL_STATUS,
          marketplace_visibility: before.marketplace_visibility ?? 'hidden_from_partners',
          calculated_total: before.calculated_total ?? quote.calculated_total,
          estimated_total: before.estimated_total ?? quote.estimated_total,
          agreed_price: before.agreed_price ?? null,
          remaining_balance: before.remaining_balance ?? null,
          price_override_reason: before.price_override_reason ?? null,
          price_override_by: before.price_override_by || null,
          price_override_at: before.price_override_at ?? null,
          assigned_driver_id: null,
          assigned_driver_name: null,
          assigned_partner_id: null,
          bundled_journey_id: null,
        })
        .eq('id', quoteId)
      if (error) throw new Error(error.message || 'Failed to restore booking.')
      quoteUnreleased = true
    } else if (quoteIsAdminPhoneBooking(quote) || String(quote.payment_status || '') === 'unpaid') {
      // No usable snapshot — pull out of Available Jobs (or remove if phone booking).
      if (quoteIsAdminPhoneBooking(quote)) {
        const removed = await removeUnpaidConvertedJob(quoteId)
        quoteDeleted = removed.deleted
        quoteCancelled = removed.cancelled
        if (!removed.deleted) {
          quoteUnreleased = true
        }
      } else {
        const { error } = await supabase
          .from('quotes')
          .update({
            operational_status: PHONE_BOOKING_PENDING_OPERATIONAL_STATUS,
            marketplace_visibility: 'hidden_from_partners',
            source: ADMIN_PHONE_BOOKING_SOURCE,
            status: 'New',
            payment_status: 'unpaid',
            assigned_driver_id: null,
            assigned_driver_name: null,
            assigned_partner_id: null,
            bundled_journey_id: null,
          })
          .eq('id', quoteId)
        if (error) throw new Error(error.message || 'Failed to unrelease booking.')
        quoteUnreleased = true
      }
    } else {
      throw new Error('Linked booking is not an unpaid phone job — cannot undo safely.')
    }
  }

  const wd = wizardDataObject(lead)
  delete wd[CONVERT_SNAPSHOT_KEY]

  const leadPatch = {
    status: previousStatus,
    converted_at: null,
    recovery_stopped_at: null,
    wizard_data: wd,
    last_activity_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Only clear quote link when the booking row was actually deleted.
  if (quoteDeleted) {
    leadPatch.quote_id = null
    leadPatch.quote_ref = null
  }

  const updated = await updateCustomerLeadById(String(lead.id), leadPatch)
  if (!updated) throw new Error('Failed to restore lead.')

  return {
    lead: updated,
    previousStatus,
    quoteDeleted,
    quoteUnreleased,
    quoteCancelled,
    quoteId: quoteDeleted ? null : quoteId,
  }
}
