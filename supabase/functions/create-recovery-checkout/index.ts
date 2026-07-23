import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { guardStripeSecretKey, respondStripeConfigFailure } from '../_shared/stripeSecretGuard.ts'
import { STRIPE_LOCALE } from '../_shared/stripeMode.ts'
import { recoveryUrls } from '../_shared/quoteRecoveryEmail.ts'

/**
 * Create Stripe Checkout for abandoned / payment-failed quote recovery (Pay Now / Retry).
 * Body: { token: string } OR { lead_id: string } (admin)
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

function round2(n: number) {
  return Math.round(n * 100) / 100
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const stripeGuard = guardStripeSecretKey()
  const siteUrl = (Deno.env.get('SITE_URL') || 'https://www.shiftmyhome.co.uk').replace(/\/$/, '')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!stripeGuard.ok) return respondStripeConfigFailure(jsonResponse, stripeGuard)
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'Server misconfigured' }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceRole)
  const stripe = new Stripe(stripeGuard.key, { apiVersion: '2023-10-16' })

  let token = ''
  let leadId = ''
  if (req.method === 'GET') {
    const url = new URL(req.url)
    token = (url.searchParams.get('token') || '').trim()
  } else {
    const body = await req.json().catch(() => ({}))
    token = typeof body?.token === 'string' ? body.token.trim() : ''
    leadId = typeof body?.lead_id === 'string' ? body.lead_id.trim() : ''
  }

  let lead: Record<string, unknown> | null = null
  if (token) {
    const { data } = await supabase.from('customer_leads').select('*').eq('resume_token', token).maybeSingle()
    lead = data
  } else if (leadId) {
    const { data } = await supabase.from('customer_leads').select('*').eq('id', leadId).maybeSingle()
    lead = data
  }

  if (!lead) return jsonResponse({ error: 'Lead not found' }, 404)
  if (lead.status === 'converted_to_booking' || lead.recovery_stopped_at) {
    return jsonResponse({ error: 'Already converted' }, 400)
  }

  const amount = Number(lead.estimated_total)
  if (!Number.isFinite(amount) || amount < 1) {
    return jsonResponse({ error: 'Quote total unavailable — resume the quote to continue' }, 400)
  }

  const quoteRef = String(lead.quote_ref || lead.lead_ref || '').trim()
  const email = String(lead.customer_email || '').trim()
  const name = String(lead.customer_name || '').trim()
  const resumeToken = String(lead.resume_token || '')
  const { resumeUrl } = recoveryUrls(resumeToken)

  const amountPence = Math.round(round2(amount) * 100)
  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: STRIPE_LOCALE,
      customer_email: email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'gbp',
            unit_amount: amountPence,
            product_data: {
              name: `ShiftMyHome move${quoteRef ? ` (${quoteRef})` : ''}`,
              description: String(lead.route_label || lead.service_type || 'Removals booking').slice(0, 200),
            },
          },
        },
      ],
      success_url: `${siteUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/payment-cancelled?resume=${encodeURIComponent(resumeToken)}`,
      metadata: {
        quote_ref: quoteRef.slice(0, 500),
        quote_id: lead.quote_id ? String(lead.quote_id) : '',
        customer_lead_id: String(lead.id),
        payment_type: 'full',
        recovery: '1',
        customer_name: name.slice(0, 200),
      },
    })
  } catch (stripeErr) {
    const message = stripeErr instanceof Error ? stripeErr.message : String(stripeErr)
    console.error('[create-recovery-checkout] Stripe session create failed', {
      leadId: lead.id,
      quoteRef,
      amountPence,
      error: message,
    })
    return jsonResponse({ error: 'Stripe checkout failed', detail: message }, 502)
  }

  if (resumeToken) {
    try {
      await supabase.rpc('public_track_recovery_event', {
        p_token: resumeToken,
        p_event: 'payment_click',
      })
    } catch (trackErr) {
      console.error('[create-recovery-checkout] payment_click track failed', trackErr)
    }
  }

  if (req.method === 'GET' && session.url) {
    return Response.redirect(session.url, 303)
  }

  return jsonResponse({
    ok: true,
    url: session.url,
    session_id: session.id,
    amount: amountPence / 100,
    resume_url: resumeUrl,
  })
})
