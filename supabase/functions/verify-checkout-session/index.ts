import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { updateQuoteFromCheckoutSession } from '../_shared/updateQuoteFromCheckoutSession.ts'
import { sendAdminBookingNotificationIfNeeded } from '../_shared/adminAvailableJobNotification.ts'
import { sendPaymentConfirmationWithPdfIfNeeded } from '../_shared/paymentConfirmationEmail.ts'
import { guardStripeSecretKey, respondStripeConfigFailure } from '../_shared/stripeSecretGuard.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const stripeGuard = guardStripeSecretKey()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!stripeGuard.ok) {
    return respondStripeConfigFailure(jsonResponse, stripeGuard)
  }
  const stripeKey = stripeGuard.key
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'Server misconfigured' }, 500)
  }

  let session_id = ''
  try {
    const j = await req.json()
    session_id = typeof j.session_id === 'string' ? j.session_id.trim() : ''
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  if (!session_id) {
    return jsonResponse({ error: 'session_id required' }, 400)
  }

  const stripe = new Stripe(stripeKey, {
    httpClient: Stripe.createFetchHttpClient(),
  })

  let session: Stripe.Checkout.Session
  try {
    if (session_id.startsWith('pi_')) {
      const list = await stripe.checkout.sessions.list({ payment_intent: session_id, limit: 1 })
      if (!list.data[0]) return jsonResponse({ error: 'No Checkout session for this payment' }, 404)
      session = list.data[0]
    } else {
      session = await stripe.checkout.sessions.retrieve(session_id)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return jsonResponse({ error: msg }, 400)
  }

  if (session.payment_status !== 'paid') {
    return jsonResponse({
      ok: true,
      payment_status: session.payment_status,
      updated: false,
    })
  }

  const metaPaymentType = String(session.metadata?.payment_type || '')
  if (metaPaymentType && metaPaymentType !== 'full' && metaPaymentType !== 'deposit') {
    return jsonResponse({ ok: false, error: 'Not a booking payment session' }, 400)
  }

  const supabase = createClient(supabaseUrl, serviceRole)
  const piId =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  let pi: Stripe.PaymentIntent | null = null
  if (piId) {
    try {
      pi = await stripe.paymentIntents.retrieve(piId)
    } catch (e) {
      console.error('[verify-checkout-session] payment intent lookup failed', piId, e)
    }
  }
  const result = await updateQuoteFromCheckoutSession(supabase, session, 'paid', {
    paidAtIso: pi?.created ? new Date(pi.created * 1000).toISOString() : null,
  })

  let confirmation_email: unknown
  if (result.ok && result.quote_id && pi) {
    try {
      confirmation_email = await sendPaymentConfirmationWithPdfIfNeeded({
        supabase,
        paymentIntent: pi,
        updateResult: result,
        resendApiKey: (Deno.env.get('RESEND_API_KEY') || '').trim(),
        resendFromEmail: (Deno.env.get('RESEND_FROM_EMAIL') || 'ShiftMyHome <onboarding@resend.dev>').trim(),
      })
    } catch (e) {
      console.error('[verify-checkout-session] confirmation email error', {
        message: e instanceof Error ? e.message : String(e),
        quote_id: result.quote_id,
      })
    }
  }

  let admin_notify: unknown
  if (result.ok && result.quote_id) {
    try {
      admin_notify = await sendAdminBookingNotificationIfNeeded({
        supabase,
        quoteId: result.quote_id,
        paymentIntentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent && typeof session.payment_intent === 'object'
              ? session.payment_intent.id
              : null,
      })
    } catch (e) {
      console.error('[verify-checkout-session] admin booking notify error', {
        message: e instanceof Error ? e.message : String(e),
        quote_id: result.quote_id,
      })
    }
  }

  return jsonResponse({
    ok: result.ok,
    updated: result.ok,
    error: result.error,
    quote_id: result.quote_id ?? null,
    quote_ref: session.metadata?.quote_ref || null,
    amount_gbp: (session.amount_total ?? 0) / 100,
    currency: session.currency || 'gbp',
    payment_status: session.payment_status,
    confirmation_email,
    admin_notify,
  })
})
