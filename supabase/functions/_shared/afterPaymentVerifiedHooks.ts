/**
 * Call from verify-payment-intent / stripe-webhook after quote payment is confirmed.
 * Sends idempotent admin "New Booking Confirmed" email via Resend.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type Stripe from 'npm:stripe@14.21.0'
import { sendAdminBookingNotificationIfNeeded } from './adminAvailableJobNotification.ts'

export async function runAfterPaymentVerifiedHooks(params: {
  supabase: SupabaseClient
  paymentIntent?: Stripe.PaymentIntent | null
  quoteId?: string | null
}) {
  const pi = params.paymentIntent
  if (pi && pi.status !== 'succeeded') {
    return { admin_notify: { ok: true, skipped: true, reason: 'payment_not_succeeded' } }
  }

  const adminNotify = await sendAdminBookingNotificationIfNeeded({
    supabase: params.supabase,
    quoteId: params.quoteId ?? null,
    paymentIntentId: pi?.id ?? null,
    stripePaymentIntent: pi ?? null,
  })

  return { admin_notify: adminNotify }
}
