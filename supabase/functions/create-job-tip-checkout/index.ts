import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { guardStripeSecretKey, respondStripeConfigFailure } from '../_shared/stripeSecretGuard.ts'
import { STRIPE_LOCALE } from '../_shared/stripeMode.ts'
import { tipUrl, trackingUrl } from '../_shared/jobCustomerNotify.ts'

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const stripeGuard = guardStripeSecretKey()
  if (!stripeGuard.ok) return respondStripeConfigFailure(jsonResponse, stripeGuard)

  const siteUrl = (Deno.env.get('SITE_URL') || 'https://www.shiftmyhome.co.uk').replace(/\/$/, '')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRole) return jsonResponse({ error: 'Server misconfigured' }, 500)

  const body = await req.json().catch(() => ({}))
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  const amountGbp = Number(body?.amount_gbp)
  if (!token) return jsonResponse({ error: 'token required' }, 400)
  if (!Number.isFinite(amountGbp) || amountGbp < 1 || amountGbp > 500) {
    return jsonResponse({ error: 'Enter a tip between £1 and £500' }, 400)
  }

  const supabase = createClient(supabaseUrl, serviceRole)
  const { data: portal } = await supabase.rpc('public_get_job_tracking', { p_token: token })
  if (!portal?.ok) return jsonResponse({ error: portal?.error || 'invalid_token' }, 400)
  if (!portal.completed) return jsonResponse({ error: 'Tips are only available after the job is completed' }, 400)

  const { data: tok } = await supabase
    .from('job_tracking_tokens')
    .select('quote_id')
    .eq('token', token)
    .maybeSingle()
  if (!tok?.quote_id) return jsonResponse({ error: 'invalid_token' }, 400)

  const { data: quote } = await supabase.from('quotes').select('*').eq('id', tok.quote_id).maybeSingle()
  if (!quote) return jsonResponse({ error: 'not_found' }, 404)

  const stripe = new Stripe(stripeGuard.key, { apiVersion: '2023-10-16' })
  const amountPence = Math.round(amountGbp * 100)

  const { data: tipRow, error: tipErr } = await supabase
    .from('job_tips')
    .insert({
      quote_id: quote.id,
      driver_id: quote.assigned_driver_id || null,
      tracking_token: token,
      amount_gbp: amountGbp,
      status: 'pending',
      customer_email: quote.email || null,
    })
    .select('id')
    .single()

  if (tipErr || !tipRow) return jsonResponse({ error: tipErr?.message || 'tip_create_failed' }, 500)

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    locale: STRIPE_LOCALE,
    customer_email: String(quote.email || '').trim() || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'gbp',
          unit_amount: amountPence,
          product_data: {
            name: `Optional tip — ${quote.quote_ref || 'ShiftMyHome'}`,
            description: 'Optional tip for your driver. Separate from your booking payment.',
          },
        },
      },
    ],
    success_url: `${siteUrl}/track/${token}/tip?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: tipUrl(token),
    metadata: {
      tip_id: String(tipRow.id),
      quote_id: String(quote.id),
      quote_ref: String(quote.quote_ref || '').slice(0, 200),
      payment_type: 'tip',
      tracking_token: token,
    },
  })

  await supabase
    .from('job_tips')
    .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
    .eq('id', tipRow.id)

  return jsonResponse({ ok: true, url: session.url, session_id: session.id, resume: trackingUrl(token) })
})
