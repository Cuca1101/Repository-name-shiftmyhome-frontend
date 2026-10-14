import type Stripe from 'npm:stripe@14.21.0'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { omitStatusIfQuoteCompleted } from './preserveCompletedQuoteStatus.ts'
import { backfillRecoveryQuoteFromLead } from './recoveryQuoteBackfill.ts'

type PaymentEventKind = 'paid' | 'failed'

async function insertActivity(
  supabase: SupabaseClient,
  payload: {
    level?: 'info' | 'warning' | 'error'
    event_type: string
    message: string
    booking_id?: string | null
    quote_id?: string | null
    stripe_payment_intent_id?: string | null
    metadata?: Record<string, unknown>
  },
) {
  await supabase.from('admin_activity_logs').insert({
    level: payload.level ?? 'info',
    event_type: payload.event_type,
    message: payload.message,
    booking_id: payload.booking_id ?? null,
    quote_id: payload.quote_id ?? null,
    stripe_session_id: null,
    stripe_payment_intent_id: payload.stripe_payment_intent_id ?? null,
    metadata: payload.metadata ?? {},
  })
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Phone quote paid from /quote/view/:token: balance = agreed total − paid, and the booking
 * leaves the New phone booking inbox for Available Jobs (same as "Send to Available Jobs").
 * Safe to run twice (webhook + verify) — writes the same values.
 */
async function syncPhoneQuoteAfterPayment(
  supabase: SupabaseClient,
  quoteId: string,
  pi: Stripe.PaymentIntent,
  amountPaid: number,
) {
  const metaTotal = Number(asString(pi.metadata?.quote_total_gbp))
  let total = Number.isFinite(metaTotal) && metaTotal > 0 ? metaTotal : NaN
  if (!Number.isFinite(total)) {
    const { data } = await supabase.from('quotes').select('agreed_price, estimated_total').eq('id', quoteId).maybeSingle()
    const agreed = Number(data?.agreed_price)
    const est = Number(data?.estimated_total)
    total = Number.isFinite(agreed) && agreed > 0 ? agreed : est
  }
  if (Number.isFinite(total)) {
    const balance = Math.max(0, Math.round((total - amountPaid) * 100) / 100)
    const { error } = await supabase.from('quotes').update({ remaining_balance: balance }).eq('id', quoteId)
    if (error) console.error('[updateQuoteFromPaymentIntent] phone quote balance', error.message)
  }
  const { error: relErr } = await supabase
    .from('quotes')
    .update({ operational_status: null, marketplace_visibility: 'hidden_from_partners' })
    .eq('id', quoteId)
    .eq('operational_status', 'phone_booking_pending')
  if (relErr) console.error('[updateQuoteFromPaymentIntent] phone quote release', relErr.message)
}

/**
 * Updates quotes/jobs after Stripe Payment Element flow (PaymentIntent events).
 */
export async function updateQuoteFromPaymentIntent(
  supabase: SupabaseClient,
  pi: Stripe.PaymentIntent,
  eventKind: PaymentEventKind,
): Promise<{ ok: boolean; error?: string; booking_id?: string | null; quote_id?: string | null }> {
  const bookingId = asString(pi.metadata?.booking_id)
  const quoteId = asString(pi.metadata?.quote_id)
  const quoteRef = asString(pi.metadata?.quote_ref)
  const paymentType = asString(pi.metadata?.payment_type)
  if (paymentType === 'customer_booking_amendment') {
    return { ok: false, error: 'amendment_payment' }
  }
  const resolvedPaymentType = paymentType === 'deposit' || paymentType === 'full' ? paymentType : 'full'

  if (!bookingId && !quoteId && !quoteRef) {
    return { ok: false, error: 'missing booking_id/quote_id/quote_ref in PaymentIntent metadata' }
  }

  const paymentIntentId = pi.id

  // Re-processing (webhook retry + verify) must keep the original payment time.
  let existingPaidAt: string | null = null
  let alreadyRecorded = false
  if (eventKind === 'paid' && (quoteId || quoteRef)) {
    const lookup = supabase.from('quotes').select('paid_at, payment_status, stripe_payment_intent_id')
    const { data: existing } = await (quoteId ? lookup.eq('id', quoteId) : lookup.eq('quote_ref', quoteRef)).maybeSingle()
    const ps = asString(existing?.payment_status).toLowerCase()
    if (existing?.paid_at && (ps === 'paid' || ps === 'deposit_paid')) existingPaidAt = String(existing.paid_at)
    alreadyRecorded = Boolean(existingPaidAt && existing?.stripe_payment_intent_id === paymentIntentId)
  }
  const paidAt = existingPaidAt || new Date().toISOString()

  const amountPaid =
    eventKind === 'paid'
      ? Math.max(0, (typeof pi.amount_received === 'number' ? pi.amount_received : pi.amount ?? 0) / 100)
      : 0

  const quoteRow =
    eventKind === 'paid'
      ? {
          status: resolvedPaymentType === 'deposit' ? 'deposit_paid' : 'Booked',
          payment_status: resolvedPaymentType === 'deposit' ? 'deposit_paid' : 'paid',
          amount_paid: amountPaid,
          stripe_payment_intent_id: paymentIntentId,
          paid_at: paidAt,
          payment_type: resolvedPaymentType,
        }
      : {
          payment_status: 'failed',
          stripe_payment_intent_id: paymentIntentId,
        }

  const jobRow =
    eventKind === 'paid'
      ? {
          payment_status: 'paid',
          booking_status: 'confirmed',
          status: 'Booked',
          amount_paid: amountPaid,
          stripe_payment_intent_id: paymentIntentId,
          paid_at: paidAt,
        }
      : {
          payment_status: 'failed',
          stripe_payment_intent_id: paymentIntentId,
        }

  const quotePatch = await omitStatusIfQuoteCompleted(
    supabase,
    { quoteId, quoteRef },
    quoteRow,
  )

  let updatedQuoteId: string | null = null
  let updatedBookingId: string | null = null
  let quoteRowsUpdated = 0
  let jobRowsUpdated = 0

  if (bookingId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingId)) {
    const { data, error } = await supabase.from('jobs').update(jobRow).eq('id', bookingId).select('id')
    if (!error) {
      updatedBookingId = bookingId
      jobRowsUpdated += Array.isArray(data) ? data.length : 0
    }
  }

  if (quoteId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(quoteId)) {
    const { data, error } = await supabase.from('quotes').update(quotePatch).eq('id', quoteId).select('id')
    if (!error) {
      updatedQuoteId = quoteId
      quoteRowsUpdated += Array.isArray(data) ? data.length : 0
    }
  }

  if (!updatedQuoteId && quoteRef) {
    const { data, error } = await supabase
      .from('quotes')
      .update(quotePatch)
      .eq('quote_ref', quoteRef)
      .select('id')
      .maybeSingle()
    if (!error && data?.id) {
      updatedQuoteId = String(data.id)
      quoteRowsUpdated += 1
    }
  }

  console.log('[updateQuoteFromPaymentIntent] persistence', {
    quote_ref: quoteRef || null,
    payment_intent_id: paymentIntentId,
    db_update_success: Boolean(updatedQuoteId || updatedBookingId),
    rows_updated: quoteRowsUpdated + jobRowsUpdated,
    quote_rows_updated: quoteRowsUpdated,
    job_rows_updated: jobRowsUpdated,
  })

  if (!updatedQuoteId && !updatedBookingId) {
    return { ok: false, error: 'could not find booking/quote for PaymentIntent metadata' }
  }

  if (
    eventKind === 'paid' &&
    updatedQuoteId &&
    (asString(pi.metadata?.phone_quote) === '1' || asString(pi.metadata?.recovery) === '1')
  ) {
    await syncPhoneQuoteAfterPayment(supabase, updatedQuoteId, pi, amountPaid)
  }

  const leadId = asString(pi.metadata?.customer_lead_id)
  if (eventKind === 'paid' && updatedQuoteId && leadId && asString(pi.metadata?.recovery) === '1') {
    try {
      await backfillRecoveryQuoteFromLead(supabase, updatedQuoteId, leadId)
    } catch (e) {
      console.error('[updateQuoteFromPaymentIntent] recovery quote backfill failed', e)
    }
  }

  if (!alreadyRecorded) await insertActivity(supabase, {
    level: eventKind === 'paid' ? 'info' : 'warning',
    event_type: eventKind === 'paid' ? 'stripe_payment_intent_succeeded' : 'stripe_payment_intent_failed',
    message:
      eventKind === 'paid'
        ? 'Stripe PaymentIntent succeeded (embedded Payment Element).'
        : 'Stripe PaymentIntent failed.',
    booking_id: updatedBookingId,
    quote_id: updatedQuoteId,
    stripe_payment_intent_id: paymentIntentId,
    metadata: {
      quote_ref: quoteRef || null,
      payment_type: resolvedPaymentType,
      amount: pi.amount ?? null,
      currency: pi.currency ?? null,
    },
  })

  try {
    if (eventKind === 'paid') {
      await supabase.rpc('stop_customer_lead_recovery', {
        p_quote_ref: quoteRef || null,
        p_quote_id: updatedQuoteId,
        p_session_id: null,
      })
    } else {
      await supabase.rpc('mark_customer_lead_payment_failed', {
        p_quote_ref: quoteRef || null,
        p_quote_id: updatedQuoteId,
        p_session_id: null,
      })
    }
  } catch (e) {
    console.error('[updateQuoteFromPaymentIntent] customer_lead recovery sync failed', e)
  }

  return { ok: true, booking_id: updatedBookingId, quote_id: updatedQuoteId }
}
