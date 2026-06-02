import { supabase, isSupabaseConfigured } from './supabase'
import { assertStripePublishableKeyConfigured } from './stripeConfig'
import { detailFromFunctionsInvokeError } from './functionsInvokeError'
import { sanitizePaymentErrorMessage } from './paymentErrorMessage'

/**
 * Edge Functions JWT gateway expects `Bearer <JWT>`. Use legacy anon key (`eyJ…`), not service role.
 * @returns {Record<string, string>|undefined}
 */
function functionsInvokeHeaders() {
  const raw = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim().replace(/^["']|["']$/g, '')
  if (raw.startsWith('eyJ')) {
    return { Authorization: `Bearer ${raw}` }
  }
  return undefined
}

function assertStripeFrontendKey() {
  assertStripePublishableKeyConfigured()
}

/**
 * Creates a PaymentIntent via Edge Function and returns client_secret for the embedded card form.
 * STRIPE_SECRET_KEY stays on Supabase only (Edge Function secrets).
 *
 * @param {Record<string, unknown>} body
 * @returns {Promise<{ clientSecret: string, paymentIntentId: string }>}
 */
export async function createPaymentIntent(body) {
  assertStripeFrontendKey()

  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }

  const invokeOpts = { body }
  const fnHeaders = functionsInvokeHeaders()
  if (fnHeaders) invokeOpts.headers = fnHeaders

  const { data, error } = await supabase.functions.invoke('create-payment-intent', invokeOpts)

  if (error) {
    throw new Error(
      await detailFromFunctionsInvokeError(error, 'Could not start payment.', { sanitizeStripe: true }),
    )
  }

  if (data?.error) {
    throw new Error(sanitizePaymentErrorMessage(String(data.error)))
  }

  const clientSecret = data?.client_secret
  const paymentIntentId = data?.payment_intent_id
  if (!clientSecret || typeof clientSecret !== 'string') {
    throw new Error('No client_secret returned from server.')
  }
  if (!paymentIntentId || typeof paymentIntentId !== 'string') {
    throw new Error('No payment_intent_id returned from server.')
  }

  return { clientSecret, paymentIntentId }
}

/**
 * After payment, confirms the PaymentIntent with the payment processor and updates the quote in the database.
 *
 * @param {string} paymentIntentId PaymentIntent id (pi_...)
 * @returns {Promise<Record<string, unknown>>}
 */
export async function verifyPaymentIntent(paymentIntentId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }
  if (!paymentIntentId) return { ok: false, skipped: true }

  const verifyOpts = { body: { payment_intent_id: paymentIntentId } }
  const verifyHeaders = functionsInvokeHeaders()
  if (verifyHeaders) verifyOpts.headers = verifyHeaders

  const { data, error } = await supabase.functions.invoke('verify-payment-intent', verifyOpts)

  if (error) {
    throw new Error(
      await detailFromFunctionsInvokeError(error, 'Could not verify payment.', { sanitizeStripe: true }),
    )
  }

  return data
}

/**
 * Notify admin inbox (Resend) after payment verified — idempotent on server.
 * @param {{ paymentIntentId?: string, quoteId?: string }} params
 */
export { notifyAdminAvailableJobAfterPayment, scheduleAdminAvailableJobNotification } from './adminAvailableJobNotify'
