import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { guardStripeSecretKey, respondStripeConfigFailure } from '../_shared/stripeSecretGuard.ts'
import { STRIPE_LOCALE } from '../_shared/stripeMode.ts'
import { trackingUrl } from '../_shared/jobCustomerNotify.ts'

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

/** Public tip page success/cancel URLs — prefer SITE_URL, fall back to production www. */
function tipSiteBaseUrl() {
  const raw = (Deno.env.get('SITE_URL') || 'https://www.shiftmyhome.co.uk').trim().replace(/\/$/, '')
  if (raw.startsWith('https://') || raw.startsWith('http://')) return raw
  return 'https://www.shiftmyhome.co.uk'
}

function isJobCompleted(quote: {
  operational_status?: unknown
  status?: unknown
  completed_at?: unknown
}) {
  if (quote?.completed_at) return true
  const op = String(quote?.operational_status || '')
    .trim()
    .toLowerCase()
  const st = String(quote?.status || '')
    .trim()
    .toLowerCase()
  return op.includes('completed') || st.includes('completed')
}

/**
 * Public tip Checkout — authenticated only by the secure tracking token (no user JWT).
 * Do NOT use public_get_job_tracking here: that RPC gates on payment_status and returns
 * not_paid for completed jobs whose booking payment_status was never flipped to paid,
 * which blocks optional tips incorrectly.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const stripeGuard = guardStripeSecretKey()
    if (!stripeGuard.ok) return respondStripeConfigFailure(jsonResponse, stripeGuard)

    const siteUrl = tipSiteBaseUrl()
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

    const amountPence = Math.round(amountGbp * 100)
    if (!Number.isFinite(amountPence) || amountPence < 100) {
      return jsonResponse({ error: 'Enter a tip between £1 and £500' }, 400)
    }

    const supabase = createClient(supabaseUrl, serviceRole)

    const { data: tok, error: tokErr } = await supabase
      .from('job_tracking_tokens')
      .select('quote_id, token, expires_at, revoked_at')
      .eq('token', token)
      .maybeSingle()

    if (tokErr) {
      console.error('[create-job-tip-checkout] token lookup error', tokErr.message)
      return jsonResponse({ error: 'Could not validate tip link' }, 500)
    }
    if (!tok?.quote_id) return jsonResponse({ error: 'invalid_token' }, 400)
    if (tok.revoked_at) return jsonResponse({ error: 'revoked' }, 400)
    if (tok.expires_at && new Date(tok.expires_at).getTime() < Date.now()) {
      return jsonResponse({ error: 'expired' }, 400)
    }

    const { data: quote, error: quoteErr } = await supabase
      .from('quotes')
      .select('id, quote_ref, full_name, email, assigned_driver_id, status, operational_status, completed_at')
      .eq('id', tok.quote_id)
      .maybeSingle()

    if (quoteErr) {
      console.error('[create-job-tip-checkout] quote lookup error', quoteErr.message)
      return jsonResponse({ error: 'Could not load booking' }, 500)
    }
    if (!quote) return jsonResponse({ error: 'not_found' }, 404)

    if (!isJobCompleted(quote)) {
      return jsonResponse({ error: 'Tips are only available after the job is completed' }, 400)
    }

    console.log('[create-job-tip-checkout] creating session', {
      quote_id: quote.id,
      quote_ref: quote.quote_ref,
      amount_gbp: amountGbp,
      amount_pence: amountPence,
      site_url: siteUrl,
    })

    const quoteRef = String(quote.quote_ref || '').trim()
    const customerName = String(quote.full_name || '').trim()

    const { data: tipRow, error: tipErr } = await supabase
      .from('job_tips')
      .insert({
        quote_id: quote.id,
        driver_id: quote.assigned_driver_id || null,
        tracking_token: token,
        amount_gbp: amountGbp,
        currency: 'gbp',
        status: 'pending',
        customer_email: quote.email || null,
        quote_ref: quoteRef || null,
        customer_name: customerName || null,
      })
      .select('id')
      .single()

    if (tipErr || !tipRow) {
      console.error('[create-job-tip-checkout] tip insert failed', tipErr?.message)
      return jsonResponse({ error: tipErr?.message || 'tip_create_failed' }, 500)
    }

    const tipPageUrl = `${siteUrl}/track/${token}/tip`
    const stripe = new Stripe(stripeGuard.key, { apiVersion: '2023-10-16' })
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
      success_url: `${tipPageUrl}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: tipPageUrl,
      metadata: {
        tip_id: String(tipRow.id),
        booking_id: String(quote.id),
        quote_id: String(quote.id),
        quote_ref: quoteRef.slice(0, 200),
        booking_ref: quoteRef.slice(0, 200),
        customer_name: customerName.slice(0, 200),
        payment_type: 'tip',
        tracking_token: token,
        amount_gbp: String(amountGbp),
        amount_pence: String(amountPence),
      },
    })

    await supabase
      .from('job_tips')
      .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
      .eq('id', tipRow.id)

    if (!session.url) {
      console.error('[create-job-tip-checkout] Stripe session missing url', session.id)
      return jsonResponse({ error: 'stripe_session_missing_url' }, 500)
    }

    console.log('[create-job-tip-checkout] ok', {
      tip_id: tipRow.id,
      session_id: session.id,
      amount_pence: amountPence,
    })

    return jsonResponse({
      ok: true,
      url: session.url,
      session_id: session.id,
      resume: trackingUrl(token),
      amount_gbp: amountGbp,
      amount_pence: amountPence,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[create-job-tip-checkout] unhandled', message)
    return jsonResponse({ error: 'checkout_failed', detail: message }, 500)
  }
})
