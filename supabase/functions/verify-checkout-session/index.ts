import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { updateQuoteFromCheckoutSession } from '../_shared/updateQuoteFromCheckoutSession.ts'
import { validateStripeSecretKey } from '../_shared/stripeMode.ts'

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
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  const stripeKeyCheck = validateStripeSecretKey(stripeKey)
  if (!stripeKeyCheck.ok) {
    return jsonResponse({ error: stripeKeyCheck.error || 'Invalid STRIPE_SECRET_KEY' }, 500)
  }
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
    session = await stripe.checkout.sessions.retrieve(session_id)
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

  const supabase = createClient(supabaseUrl, serviceRole)
  const result = await updateQuoteFromCheckoutSession(supabase, session, 'paid')

  return jsonResponse({
    ok: result.ok,
    updated: result.ok,
    error: result.error,
    payment_status: session.payment_status,
  })
})
