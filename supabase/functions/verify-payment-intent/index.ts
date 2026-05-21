import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { updateQuoteFromPaymentIntent } from '../_shared/updateQuoteFromPaymentIntent.ts'
import { sendPaymentConfirmationWithPdfIfNeeded } from '../_shared/paymentConfirmationEmail.ts'
import { validateStripeSecretKey } from '../_shared/stripeMode.ts'

/**
 * Verifies succeeded PaymentIntent, updates quote/job and sends booking confirmation PDF email.
 * Secrets: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL (optional)
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
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const resendApiKey = (Deno.env.get('RESEND_API_KEY') || '').trim()
  const resendFrom = (Deno.env.get('RESEND_FROM_EMAIL') || 'ShiftMyHome <onboarding@resend.dev>').trim()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  const stripeKeyCheck = validateStripeSecretKey(stripeKey)
  if (!stripeKeyCheck.ok) {
    return jsonResponse({ error: stripeKeyCheck.error || 'Invalid STRIPE_SECRET_KEY' }, 500)
  }
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'Server misconfigured' }, 500)
  }

  let payment_intent_id = ''
  try {
    const j = await req.json()
    payment_intent_id = typeof j.payment_intent_id === 'string' ? j.payment_intent_id.trim() : ''
    if (!payment_intent_id && typeof j.payment_intent === 'string') {
      payment_intent_id = j.payment_intent.trim()
    }
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  if (!payment_intent_id) {
    return jsonResponse({ error: 'payment_intent_id required' }, 400)
  }

  const stripe = new Stripe(stripeKey, {
    httpClient: Stripe.createFetchHttpClient(),
  })

  let pi: Stripe.PaymentIntent
  try {
    pi = await stripe.paymentIntents.retrieve(payment_intent_id)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return jsonResponse({ error: msg }, 400)
  }

  if (pi.status !== 'succeeded') {
    return jsonResponse({
      ok: true,
      updated: false,
      payment_status: pi.status,
    })
  }

  const supabase = createClient(supabaseUrl, serviceRole)
  const result = await updateQuoteFromPaymentIntent(supabase, pi, 'paid')

  let quote_ref =
    typeof pi.metadata?.quote_ref === 'string' ? pi.metadata.quote_ref.trim() : ''
  if (!quote_ref && result.quote_id) {
    const { data } = await supabase.from('quotes').select('quote_ref').eq('id', result.quote_id).maybeSingle()
    if (data?.quote_ref && typeof data.quote_ref === 'string') {
      quote_ref = data.quote_ref.trim()
    }
  }

  let email_sent = false
  let email_reason: string | undefined
  let email_debug: unknown
  let email_error: string | undefined
  try {
    const emailRes = await sendPaymentConfirmationWithPdfIfNeeded({
      supabase,
      paymentIntent: pi,
      updateResult: result,
      resendApiKey,
      resendFromEmail: resendFrom,
    })
    email_sent = emailRes.sent
    email_reason = typeof emailRes.reason === 'string' ? emailRes.reason : undefined
    email_debug = emailRes.debug
    console.log('[verify-payment-intent] email result', emailRes)
  } catch (e) {
    email_error = e instanceof Error ? e.message : String(e)
    console.error('[verify-payment-intent] email send error', {
      message: email_error,
      stack: e instanceof Error ? e.stack || '' : '',
      payment_intent_id: payment_intent_id,
      quote_id: result.quote_id ?? null,
    })
  }

  return jsonResponse({
    ok: result.ok,
    updated: result.ok,
    error: result.error,
    payment_status: pi.status,
    quote_ref: quote_ref || undefined,
    email_sent,
    email_reason,
    email_debug,
    email_error,
  })
})
