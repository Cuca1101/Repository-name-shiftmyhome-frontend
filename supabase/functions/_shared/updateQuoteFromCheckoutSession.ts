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
    stripe_session_id?: string | null
    stripe_payment_intent_id?: string | null
    metadata?: Record<string, unknown>
  },
) {
  // Best-effort logging: payment updates must not fail if log table is unavailable.
  await supabase.from('admin_activity_logs').insert({
    level: payload.level ?? 'info',
    event_type: payload.event_type,
    message: payload.message,
    booking_id: payload.booking_id ?? null,
    quote_id: payload.quote_id ?? null,
    stripe_session_id: payload.stripe_session_id ?? null,
    stripe_payment_intent_id: payload.stripe_payment_intent_id ?? null,
    metadata: payload.metadata ?? {},
  })
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePaymentIntentId(session: Stripe.Checkout.Session): string | null {
  const raw = session.payment_intent
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  if (raw && typeof raw === 'object' && typeof raw.id === 'string' && raw.id.trim()) {
    return raw.id.trim()
  }
  return null
}

export async function updateQuoteFromCheckoutSession(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session,
  eventKind: PaymentEventKind = 'paid',
): Promise<{ ok: boolean; error?: string; booking_id?: string | null; quote_id?: string | null }> {
  const bookingId = asString(session.metadata?.booking_id)
  const quoteId = asString(session.metadata?.quote_id)
  const quoteRef = asString(session.metadata?.quote_ref)
  const paymentType = asString(session.metadata?.payment_type)
  const paymentIntentId = normalizePaymentIntentId(session)
  const paidAt = new Date().toISOString()

  // "payment_type" is required by the existing quote flow. For generic booking checkout,
  // default to "full" when this metadata is not present.
  const resolvedPaymentType = paymentType === 'deposit' || paymentType === 'full' ? paymentType : 'full'

  if (!bookingId && !quoteId && !quoteRef) {
    return { ok: false, error: 'missing booking_id/quote_id/quote_ref in metadata' }
  }

  const amountPaid = Math.max(0, (session.amount_total ?? 0) / 100)
  const sessionId = asString(session.id)

  const quoteRow =
    eventKind === 'paid'
      ? {
          status: resolvedPaymentType === 'deposit' ? 'deposit_paid' : 'Booked',
          payment_status: resolvedPaymentType === 'deposit' ? 'deposit_paid' : 'paid',
          amount_paid: amountPaid,
          stripe_session_id: sessionId || null,
          stripe_payment_intent_id: paymentIntentId,
          paid_at: paidAt,
          payment_type: resolvedPaymentType,
        }
      : {
          payment_status: 'failed',
          stripe_session_id: sessionId || null,
          stripe_payment_intent_id: paymentIntentId,
        }

  const jobRow =
    eventKind === 'paid'
      ? {
          payment_status: 'paid',
          booking_status: 'confirmed',
          status: 'Booked',
          amount_paid: amountPaid,
          stripe_session_id: sessionId || null,
          stripe_payment_intent_id: paymentIntentId,
          paid_at: paidAt,
        }
      : {
          payment_status: 'failed',
          stripe_session_id: sessionId || null,
          stripe_payment_intent_id: paymentIntentId,
        }

  let updatedQuoteId: string | null = null
  let updatedBookingId: string | null = null

  if (bookingId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingId)) {
    const { error } = await supabase.from('jobs').update(jobRow).eq('id', bookingId)
    if (!error) {
      updatedBookingId = bookingId
    }
  }

  if (quoteId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(quoteId)) {
    const { error } = await supabase.from('quotes').update(quoteRow).eq('id', quoteId)
    if (!error) {
      updatedQuoteId = quoteId
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
    }
  }

  if (!updatedQuoteId && !updatedBookingId) {
    return { ok: false, error: 'could not find booking/quote for Stripe metadata' }
  }

  await insertActivity(supabase, {
    level: eventKind === 'paid' ? 'info' : 'warning',
    event_type: eventKind === 'paid' ? 'stripe_payment_received' : 'stripe_payment_failed',
    message:
      eventKind === 'paid'
        ? 'Stripe Checkout payment received and booking/quote updated.'
        : 'Stripe payment failed (payment_intent.payment_failed).',
    booking_id: updatedBookingId,
    quote_id: updatedQuoteId,
    stripe_session_id: sessionId || null,
    stripe_payment_intent_id: paymentIntentId,
    metadata: {
      quote_ref: quoteRef || null,
      payment_type: resolvedPaymentType,
      amount_total: session.amount_total ?? null,
      currency: session.currency ?? null,
    },
  })

  return { ok: true, booking_id: updatedBookingId, quote_id: updatedQuoteId }
}
