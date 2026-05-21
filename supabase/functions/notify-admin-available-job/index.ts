import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendAdminAvailableJobNotificationIfNeeded } from '../_shared/adminAvailableJobNotification.ts'

/**
 * Sends admin email when a paid quote enters Available Jobs.
 * Invoke after verify-payment-intent (client or server).
 *
 * Body: { payment_intent_id?: string, quote_id?: string }
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, STRIPE_SECRET_KEY (when using PI)
 */

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
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ ok: false, error: 'server_misconfigured' }, 503)
    }

    const body = await req.json().catch(() => ({}))
    const paymentIntentId =
      typeof body?.payment_intent_id === 'string' ? body.payment_intent_id.trim() : ''
    const quoteId = typeof body?.quote_id === 'string' ? body.quote_id.trim() : ''

    if (!paymentIntentId && !quoteId) {
      return jsonResponse({ ok: false, error: 'payment_intent_id_or_quote_id_required' }, 400)
    }

    let stripePi: Stripe.PaymentIntent | null = null
    if (paymentIntentId) {
      const stripeKey = (Deno.env.get('STRIPE_SECRET_KEY') || '').trim()
      if (!stripeKey) {
        return jsonResponse({ ok: false, error: 'stripe_not_configured' }, 503)
      }
      const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
      stripePi = await stripe.paymentIntents.retrieve(paymentIntentId)
      if (stripePi.status !== 'succeeded') {
        return jsonResponse({ ok: true, skipped: true, reason: 'payment_not_succeeded' })
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const result = await sendAdminAvailableJobNotificationIfNeeded({
      supabase,
      quoteId: quoteId || null,
      paymentIntentId: paymentIntentId || null,
      stripePaymentIntent: stripePi,
    })

    return jsonResponse(result, result.ok ? 200 : 500)
  } catch (e) {
    console.error('[notify-admin-available-job]', e)
    return jsonResponse(
      { ok: false, error: e instanceof Error ? e.message : 'notify_failed' },
      500,
    )
  }
})
