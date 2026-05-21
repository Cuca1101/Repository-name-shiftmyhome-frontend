import type Stripe from 'npm:stripe@14.21.0'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

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
  const resolvedPaymentType = paymentType === 'deposit' || paymentType === 'full' ? paymentType : 'full'

  if (!bookingId && !quoteId && !quoteRef) {
    return { ok: false, error: 'missing booking_id/quote_id/quote_ref in PaymentIntent metadata' }
  }

  const paidAt = new Date().toISOString()
  const paymentIntentId = pi.id

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
    const { data, error } = await supabase.from('quotes').update(quoteRow).eq('id', quoteId).select('id')
    if (!error) {
      updatedQuoteId = quoteId
      quoteRowsUpdated += Array.isArray(data) ? data.length : 0
    }
  }

  if (!updatedQuoteId && quoteRef) {
    const { data, error } = await supabase
      .from('quotes')
      .update(quoteRow)
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

  await insertActivity(supabase, {
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

  return { ok: true, booking_id: updatedBookingId, quote_id: updatedQuoteId }
}
