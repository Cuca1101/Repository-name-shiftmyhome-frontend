import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { updateQuoteFromPaymentIntent } from '../_shared/updateQuoteFromPaymentIntent.ts'
import { sendPaymentConfirmationWithPdfIfNeeded } from '../_shared/paymentConfirmationEmail.ts'
import { validateStripeSecretKey } from '../_shared/stripeMode.ts'

/**
 * Stripe webhook for ShiftMyHome (embedded Payment Element + PaymentIntent).
 *
 * Optional for customer-facing payments: quotes/jobs are updated by `verify-payment-intent`
 * when the customer reaches `/payment-success`. Configure this webhook for redundancy, emails,
 * and payments where the user closes the tab before the success page loads.
 *
 * Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *          RESEND_API_KEY, RESEND_FROM_EMAIL (optional)
 *
 * Stripe Dashboard → Developers → Webhooks → Add endpoint:
 *   URL: https://<project-ref>.functions.supabase.co/stripe-webhook
 * Events to send:
 *   - payment_intent.succeeded
 *   - payment_intent.payment_failed
 * Copy signing secret → STRIPE_WEBHOOK_SECRET
 */

Deno.serve(async (req) => {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const resendApiKey = (Deno.env.get('RESEND_API_KEY') || '').trim()
  const resendFrom = (Deno.env.get('RESEND_FROM_EMAIL') || 'ShiftMyHome <onboarding@resend.dev>').trim()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  const stripeKeyCheck = validateStripeSecretKey(stripeKey)
  if (!stripeKeyCheck.ok) {
    return new Response(JSON.stringify({ error: stripeKeyCheck.error || 'Invalid STRIPE_SECRET_KEY' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!webhookSecret || !supabaseUrl || !serviceRole) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const stripe = new Stripe(stripeKey, {
    httpClient: Stripe.createFetchHttpClient(),
  })

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing stripe-signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRole)

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent
    const result = await updateQuoteFromPaymentIntent(supabase, pi, 'paid')
    console.log('[stripe-webhook] quote update result', {
      quote_ref: typeof pi.metadata?.quote_ref === 'string' ? pi.metadata.quote_ref : null,
      payment_intent_id: pi.id,
      db_update_success: result.ok,
      rows_updated: result.ok ? 1 : 0,
      quote_id: result.quote_id ?? null,
    })

    try {
      await sendPaymentConfirmationWithPdfIfNeeded({
        supabase,
        paymentIntent: pi,
        updateResult: result,
        resendApiKey,
        resendFromEmail: resendFrom,
      })
      console.log('[stripe-webhook] payment email processed', { payment_intent_id: pi.id, quote_id: result.quote_id ?? null })
    } catch (e) {
      console.error('[stripe-webhook] payment email error', {
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack || '' : '',
        payment_intent_id: pi.id,
        quote_id: result.quote_id ?? null,
      })
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent
    await updateQuoteFromPaymentIntent(supabase, pi, 'failed')
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
