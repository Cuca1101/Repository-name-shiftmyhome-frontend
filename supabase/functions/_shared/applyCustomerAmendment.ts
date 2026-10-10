import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { sendResendEmail } from './resendClient.ts'
import { customerFirstName } from './jobCustomerNotify.ts'
import { buildPortalMagicUrl } from './customerPortalMagicLink.ts'
import {
  buildAppliedQuotePatch,
  dateSlotOpen,
  jobModificationLock,
  quotePatchTouchesCompletion,
  refundDue,
  resolvePaidAmendment,
} from '../../../src/lib/customerPortalModel.js'

type AmendmentRow = Record<string, unknown>
type QuoteRow = Record<string, unknown>

function proposedOf(row: AmendmentRow) {
  const proposed = row.proposed
  return proposed && typeof proposed === 'object' ? (proposed as Record<string, unknown>) : {}
}

async function slotStillOpen(supabase: SupabaseClient, quote: QuoteRow, proposed: Record<string, unknown>) {
  if (!proposed.dateChanged) return true
  const day = String(proposed.moveDate || '').slice(0, 10)
  if (!day) return false
  const { data: settingsRows } = await supabase.rpc('public_get_pricing_settings')
  const settings = Array.isArray(settingsRows) ? settingsRows[0]?.data || {} : {}
  const { data: counts } = await supabase.rpc('public_quote_day_slot_counts', { p_from: day, p_to: day })
  const booked = Array.isArray(counts) ? Number(counts[0]?.booked || 0) : 0
  return dateSlotOpen(settings, day, booked, String(quote.move_date || '').slice(0, 10))
}

async function driverBecameBusy(supabase: SupabaseClient, quote: QuoteRow, proposed: Record<string, unknown>) {
  if (!proposed.dateChanged || !quote.assigned_driver_id) return false
  const day = String(proposed.moveDate || '').slice(0, 10)
  const { data } = await supabase.rpc('customer_portal_driver_busy', {
    p_driver: quote.assigned_driver_id,
    p_date: day,
    p_exclude: quote.id,
  })
  return Boolean(data)
}

async function notifyCustomerUpdated(quote: QuoteRow, amendment: AmendmentRow) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceKey) return
  const changes = Array.isArray(amendment.changes) ? amendment.changes : []
  if (!changes.length) return
  await fetch(`${supabaseUrl}/functions/v1/notify-booking-updated`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      quote_id: quote.id,
      change_set_id: amendment.id,
      changes,
      quote_ref: quote.quote_ref || '',
    }),
  }).catch((error) => {
    console.error('[customer-amendment] notify failed', error instanceof Error ? error.message : error)
  })
}

async function emailReviewHold(supabase: SupabaseClient, quote: QuoteRow, amendment: AmendmentRow) {
  const email = String(quote.email || '').trim()
  if (!email) return
  const link = await buildPortalMagicUrl(supabase, email, `/portal/bookings/${quote.id}`)
  const url = link.ok ? link.url : ''
  const ref = String(quote.quote_ref || 'your booking')
  const subject = `[ShiftMyHome] We are checking a change to ${ref}`
  const html = `<p>Hi ${customerFirstName(quote.full_name)},</p>
    <p>Your confirmed booking ${ref} has not been changed. The team needs to check the date or driver before the update can go ahead.</p>
    ${url ? `<p><a href="${url}">View my booking</a></p>` : ''}`
  await sendResendEmail({
    to: email,
    subject,
    html,
    text: `Your confirmed booking ${ref} is unchanged while we check this change. ${url}`,
    logTag: 'customer-amendment-review',
  })
  const { data: admins } = await supabase.rpc('list_admin_notification_emails')
  const list = Array.isArray(admins) ? admins.filter(Boolean) : []
  if (list.length) {
    await sendResendEmail({
      to: list,
      subject: `[ShiftMyHome] Review customer change ${ref}`,
      html: `<p>Booking ${ref} has a paid or requested change that was not applied. The previous booking is still confirmed.</p>`,
      text: `Review customer change for ${ref}. Amendment ${amendment.id}.`,
      logTag: 'customer-amendment-admin',
    })
  }
}

/**
 * Apply a stored change after payment, or park it for admin if the slot or driver is no longer free.
 * Does not collect the original booking payment again.
 */
export async function applyPaidCustomerAmendment(
  supabase: SupabaseClient,
  args: { amendmentId: string; paymentIntentId?: string | null; sessionId?: string | null },
) {
  const now = new Date().toISOString()
  const patchClaim: Record<string, unknown> = {
    paid_at: now,
    updated_at: now,
  }
  if (args.paymentIntentId) patchClaim.stripe_payment_intent_id = args.paymentIntentId
  if (args.sessionId) patchClaim.stripe_checkout_session_id = args.sessionId

  const { data: claimed } = await supabase
    .from('customer_booking_amendments')
    .update(patchClaim)
    .eq('id', args.amendmentId)
    .eq('status', 'pending_payment')
    .is('paid_at', null)
    .select('*')
    .maybeSingle()

  if (!claimed) {
    const { data: existing } = await supabase
      .from('customer_booking_amendments')
      .select('*')
      .eq('id', args.amendmentId)
      .maybeSingle()
    if (!existing) return { ok: false, error: 'not_found' }
    if (existing.status === 'applied' || existing.status === 'paid_needs_review') {
      return { ok: true, already: true, status: existing.status }
    }
    if (existing.status === 'pending_payment' && existing.paid_at) {
      return finishApply(supabase, existing as AmendmentRow, true)
    }
    return { ok: false, error: 'not_pending' }
  }

  return finishApply(supabase, claimed as AmendmentRow, true)
}

export async function applyAdminCustomerAmendment(supabase: SupabaseClient, amendmentId: string) {
  const { data: row } = await supabase
    .from('customer_booking_amendments')
    .select('*')
    .eq('id', amendmentId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'not_found' }
  if (row.status === 'applied') return { ok: true, already: true, status: 'applied' }

  const delta = Number(row.payment_delta) || 0
  if (row.status === 'pending_approval' && delta >= 0.3 && !row.paid_at) {
    const now = new Date().toISOString()
    await supabase
      .from('customer_booking_amendments')
      .update({ status: 'pending_payment', updated_at: now })
      .eq('id', amendmentId)
      .eq('status', 'pending_approval')
    const { data: quote } = await supabase.from('quotes').select('id, email, full_name, quote_ref').eq('id', row.quote_id).maybeSingle()
    if (quote?.email) {
      const link = await buildPortalMagicUrl(supabase, String(quote.email), `/portal/bookings/${quote.id}`)
      const url = link.ok ? link.url : ''
      await sendResendEmail({
        to: String(quote.email),
        subject: `[ShiftMyHome] Confirm the change to ${quote.quote_ref || 'your booking'}`,
        html: `<p>Hi ${customerFirstName(quote.full_name)},</p><p>We can make the change you asked for. Please pay the price difference to confirm it. Your current booking stays as it is until then.</p>${url ? `<p><a href="${url}">View my booking</a></p>` : ''}`,
        text: `Pay the difference to confirm your booking change. ${url}`,
        logTag: 'customer-amendment-approved',
      })
    }
    return { ok: true, status: 'pending_payment' }
  }

  if (row.status !== 'pending_approval' && row.status !== 'paid_needs_review') {
    return { ok: false, error: 'not_ready' }
  }
  return finishApply(supabase, row as AmendmentRow, Boolean(row.paid_at))
}

async function finishApply(supabase: SupabaseClient, amendment: AmendmentRow, paymentCaptured: boolean) {
  const now = new Date().toISOString()
  const { data: gated } = await supabase
    .from('customer_booking_amendments')
    .update({ status: 'paid_needs_review', updated_at: now })
    .eq('id', amendment.id)
    .in('status', ['pending_payment', 'pending_approval'])
    .select('*')
    .maybeSingle()
  if (!gated) {
    return { ok: true, already: true, status: 'paid_needs_review' }
  }
  amendment = gated as AmendmentRow

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', amendment.quote_id)
    .maybeSingle()
  if (quoteError || !quote) return { ok: false, error: 'quote_not_found' }

  const proposed = proposedOf(amendment)
  const lock = jobModificationLock(quote)
  const dateAvailable = await slotStillOpen(supabase, quote, proposed)
  const driverBusy = await driverBecameBusy(supabase, quote, proposed)
  const decision = resolvePaidAmendment({
    locked: lock.locked,
    dateAvailable,
    driverNeedsReview: driverBusy,
  })

  if (!decision.applyToQuote) {
    await supabase
      .from('customer_booking_amendments')
      .update({ status: 'paid_needs_review', updated_at: now })
      .eq('id', amendment.id)
    await emailReviewHold(supabase, quote, amendment)
    return { ok: true, status: 'paid_needs_review', quoteUnchanged: true }
  }

  const hadAgreed = quote.agreed_price != null && String(quote.agreed_price).trim() !== ''
  const patch = buildAppliedQuotePatch({
    proposed: {
      moveDate: String(proposed.moveDate || '').slice(0, 10),
      arrivalWindow: proposed.arrivalWindow || null,
      arrivalType: proposed.arrivalType || null,
      arrivalTime: proposed.arrivalTime || null,
      inventory: proposed.inventory || [],
      inventoryText: proposed.inventoryText || null,
      crewSize: proposed.crewSize ?? null,
      total: Number(proposed.total),
      priceUnchanged: Boolean(proposed.priceUnchanged),
      addressChanged: Boolean(proposed.addressChanged),
      pickupAddress: proposed.pickupAddress || null,
      deliveryAddress: proposed.deliveryAddress || null,
      distanceMiles: proposed.distanceMiles,
    },
    amountPaid: quote.amount_paid,
    paymentDelta: paymentCaptured ? amendment.payment_delta : 0,
    hadAgreedPrice: hadAgreed,
  })
  if (quotePatchTouchesCompletion(patch)) {
    return { ok: false, error: 'refusing_completion_change' }
  }
  if (typeof proposed.details === 'string' && proposed.details.trim()) {
    patch.details = proposed.details
  }

  const { error: updateError } = await supabase.from('quotes').update(patch).eq('id', quote.id)
  if (updateError) {
    await supabase
      .from('customer_booking_amendments')
      .update({ status: paymentCaptured ? 'paid_needs_review' : amendment.status, updated_at: now })
      .eq('id', amendment.id)
    return { ok: false, error: updateError.message }
  }

  if (proposed.dateChanged && proposed.moveDate) {
    await supabase
      .from('job_assignments')
      .update({
        scheduled_date: `${String(proposed.moveDate).slice(0, 10)}T12:00:00.000Z`,
        updated_at: now,
      })
      .eq('quote_id', quote.id)
  }

  const due = refundDue(Number(proposed.total), Number(patch.amount_paid))
  await supabase
    .from('customer_booking_amendments')
    .update({
      status: 'applied',
      applied_at: now,
      updated_at: now,
      refund_due: due > 0 ? due : null,
    })
    .eq('id', amendment.id)

  await notifyCustomerUpdated(quote, amendment)
  return { ok: true, status: 'applied', quoteUnchanged: false }
}
