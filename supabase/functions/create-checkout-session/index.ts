import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { validateStripeSecretKey } from '../_shared/stripeMode.ts'
import { formatGbpLabel, validateDepositAmountGbp } from '../_shared/stripeDepositAmount.ts'

/**
 * ShiftMyHome Checkout session creator.
 *
 * Keys:
 * - Frontend: VITE_STRIPE_PUBLISHABLE_KEY (pk_test_... in dev; pk_live_... in production)
 * - Backend (Supabase secrets only): STRIPE_SECRET_KEY (sk_test_... in dev; sk_live_... in production)
 *
 * Never put STRIPE_SECRET_KEY in frontend code or Vite env variables.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Columns allowed from public quote wizard (matches buildQuoteRowFromTemplateParams). */
const LEAD_KEYS = new Set([
  'quote_ref',
  'full_name',
  'phone',
  'email',
  'pickup_address',
  'delivery_address',
  'move_date',
  'service',
  'arrival_window',
  'distance_miles',
  'details',
  'pricing',
  'inventory_text',
  'inventory',
  'message',
  'status',
])

const STRIP_KEYS = new Set([
  'id',
  'created_at',
  'payment_status',
  'amount_paid',
  'stripe_session_id',
  'paid_at',
  'payment_type',
])

function sanitizeQuoteLead(raw: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (STRIP_KEYS.has(k) || !LEAD_KEYS.has(k)) continue
    o[k] = v
  }
  if (o.status == null || String(o.status).trim() === '') {
    o.status = 'New'
  }
  return o
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

function uuidLike(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

/**
 * Stripe Checkout rejects metadata keys whose values are empty strings.
 * The frontend often sends null booking_id / quote_id — never forward those as "".
 */
function stripeMetadata(entries: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(entries)) {
    const trimmed = value.trim()
    if (!trimmed) continue
    out[key] = trimmed.slice(0, 500)
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const siteUrl = (Deno.env.get('SITE_URL') || 'http://localhost:5173').replace(/\/$/, '')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  const stripeKeyCheck = validateStripeSecretKey(stripeKey)
  if (!stripeKeyCheck.ok) {
    return jsonResponse({ error: stripeKeyCheck.error || 'Invalid STRIPE_SECRET_KEY' }, 500)
  }
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'Server misconfigured: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const booking_id = String(body.booking_id ?? '').trim()
  const quote_id = String(body.quote_id ?? '').trim()
  const quote_ref = String(body.quote_ref ?? '').trim()
  const customer_email = String(body.customer_email ?? '').trim()
  const customer_name = String(body.customer_name ?? '').trim()
  const service_type = String(body.service_type ?? '').trim()
  const payment_type = body.payment_type
  const amount_gbp = Number(body.amount_gbp ?? body.amount)
  const quote_lead_raw = body.quote_lead

  if (!booking_id && !quote_id && !quote_ref) {
    return jsonResponse({ error: 'booking_id or quote_id or quote_ref is required' }, 400)
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) {
    return jsonResponse({ error: 'customer_email is invalid' }, 400)
  }
  if (payment_type !== 'deposit' && payment_type !== 'full') {
    return jsonResponse({ error: 'payment_type must be deposit or full' }, 400)
  }
  const requiresLeadPayload = !quote_id && !booking_id
  if (requiresLeadPayload && (!quote_lead_raw || typeof quote_lead_raw !== 'object' || Array.isArray(quote_lead_raw))) {
    return jsonResponse({ error: 'quote_lead object is required' }, 400)
  }

  const cleanLead =
    quote_lead_raw && typeof quote_lead_raw === 'object' && !Array.isArray(quote_lead_raw)
      ? sanitizeQuoteLead(quote_lead_raw as Record<string, unknown>)
      : null
  const leadRef = String(cleanLead?.quote_ref ?? '').trim()
  if (cleanLead && quote_ref && leadRef !== quote_ref) {
    return jsonResponse({ error: 'quote_ref must match quote_lead.quote_ref' }, 400)
  }

  const supabase = createClient(supabaseUrl, serviceRole)

  let existing:
    | {
        id: string
        payment_status: string | null
        status: string | null
        amount_paid: number | null
        stripe_session_id: string | null
        paid_at: string | null
        payment_type: string | null
      }
    | null = null

  if (quote_id && uuidLike(quote_id)) {
    const { data } = await supabase
      .from('quotes')
      .select('id, payment_status, status, amount_paid, stripe_session_id, paid_at, payment_type')
      .eq('id', quote_id)
      .maybeSingle()
    existing = data
  } else if (quote_ref) {
    const { data } = await supabase
      .from('quotes')
      .select('id, payment_status, status, amount_paid, stripe_session_id, paid_at, payment_type')
      .eq('quote_ref', quote_ref)
      .maybeSingle()
    existing = data
  }

  if (existing?.payment_status === 'paid') {
    return jsonResponse({ error: 'This quote is already fully paid.' }, 409)
  }
  if (existing?.payment_status === 'deposit_paid' && payment_type === 'deposit') {
    return jsonResponse({ error: 'A deposit has already been paid for this quote.' }, 409)
  }

  let merged: Record<string, unknown> | null = cleanLead ? { ...cleanLead } : null
  if (merged && existing?.payment_status === 'deposit_paid') {
    merged.status = existing.status ?? merged.status
    merged.payment_status = existing.payment_status
    merged.amount_paid = existing.amount_paid
    merged.stripe_session_id = existing.stripe_session_id
    merged.paid_at = existing.paid_at
    merged.payment_type = existing.payment_type
  }

  let gbp = round2(amount_gbp)
  const resolvedPaymentType: 'deposit' | 'full' = payment_type === 'deposit' ? 'deposit' : 'full'
  if (resolvedPaymentType === 'deposit') {
    const depositCheck = validateDepositAmountGbp(gbp, null)
    if (!depositCheck.ok) {
      return jsonResponse(
        { error: depositCheck.error || `Deposit amount must be ${formatGbpLabel(gbp)}` },
        400,
      )
    }
    gbp = depositCheck.amount ?? gbp
  } else {
    if (!Number.isFinite(gbp) || gbp <= 0 || gbp > 500_000) {
      return jsonResponse({ error: 'Invalid full payment amount' }, 400)
    }
  }

  const unitAmount = Math.round(gbp * 100)
  if (unitAmount < 30) {
    return jsonResponse({ error: 'Amount too low for card payment' }, 400)
  }

  let resolvedQuoteId = quote_id && uuidLike(quote_id) ? quote_id : ''
  if (merged) {
    const { data: saved, error: saveErr } = await supabase
      .from('quotes')
      .upsert(merged, { onConflict: 'quote_ref' })
      .select('id')
      .single()
    if (saveErr || !saved?.id) {
      return jsonResponse({ error: saveErr?.message ?? 'Could not save quote lead' }, 400)
    }
    resolvedQuoteId = String(saved.id)
  }

  const stripe = new Stripe(stripeKey, {
    httpClient: Stripe.createFetchHttpClient(),
  })

  const metadata = stripeMetadata({
    booking_id,
    quote_id: resolvedQuoteId || quote_id,
    quote_ref,
    payment_type: resolvedPaymentType,
    customer_email,
    service_type,
    customer_name,
  })

  const description =
    resolvedPaymentType === 'deposit'
      ? `${formatGbpLabel(gbp)} deposit for quote ${quote_ref}`
      : `Full payment for quote ${quote_ref}`

  const title =
    resolvedPaymentType === 'deposit'
      ? `ShiftMyHome — ${formatGbpLabel(gbp)} deposit`
      : 'ShiftMyHome — Full payment'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: customer_email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'gbp',
            unit_amount: unitAmount,
            product_data: {
              name: title,
              description,
            },
          },
        },
      ],
      success_url: `${siteUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/payment-cancelled`,
      metadata,
      payment_intent_data: {
        metadata,
      },
    })

    if (!session.url) {
      return jsonResponse({ error: 'Stripe did not return a checkout URL' }, 500)
    }

    // Save the Stripe session id as soon as Checkout is created (best-effort — payment still works via webhook metadata).
    if (booking_id && uuidLike(booking_id)) {
      const { error: jobErr } = await supabase
        .from('jobs')
        .update({ stripe_session_id: session.id })
        .eq('id', booking_id)
      if (jobErr) console.error('[create-checkout-session] jobs stripe_session_id update:', jobErr.message)
    }
    if (resolvedQuoteId && uuidLike(resolvedQuoteId)) {
      const { error: quoteErr } = await supabase
        .from('quotes')
        .update({
          stripe_session_id: session.id,
          payment_type: resolvedPaymentType,
        })
        .eq('id', resolvedQuoteId)
      if (quoteErr) console.error('[create-checkout-session] quotes stripe_session_id update:', quoteErr.message)
    } else if (quote_ref) {
      const { error: quoteErr } = await supabase
        .from('quotes')
        .update({
          stripe_session_id: session.id,
          payment_type: resolvedPaymentType,
        })
        .eq('quote_ref', quote_ref)
      if (quoteErr) console.error('[create-checkout-session] quotes stripe_session_id update by ref:', quoteErr.message)
    }

    return jsonResponse({
      checkout_url: session.url,
      url: session.url,
      quote_id: resolvedQuoteId || quote_id || null,
      booking_id: booking_id || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return jsonResponse({ error: msg }, 500)
  }
})
