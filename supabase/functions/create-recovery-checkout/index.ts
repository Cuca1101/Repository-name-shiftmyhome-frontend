import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { guardStripeSecretKey, respondStripeConfigFailure } from '../_shared/stripeSecretGuard.ts'
import { STRIPE_LOCALE } from '../_shared/stripeMode.ts'
import { recoveryUrls } from '../_shared/quoteRecoveryEmail.ts'

/**
 * Create Stripe Checkout for abandoned / payment-failed quote recovery (Pay Now / Retry).
 * Body: { token: string } OR { lead_id: string } (admin)
 *
 * Charge amount: agreed_price (admin override) ?? estimated_total (engine quote).
 * When regenerating after a price change, expires the previous Checkout session.
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

/** Stripe Checkout rejects metadata keys whose values are empty strings. */
function stripeMetadata(entries: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(entries)) {
    const trimmed = value.trim()
    if (!trimmed) continue
    out[key] = trimmed.slice(0, 500)
  }
  return out
}

function uuidLike(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

function resolveChargeAmount(lead: Record<string, unknown>): number {
  if (lead.agreed_price != null && lead.agreed_price !== '') {
    const agreed = Number(lead.agreed_price)
    if (Number.isFinite(agreed) && agreed >= 0) return round2(agreed)
  }
  if (lead.estimated_total != null && lead.estimated_total !== '') {
    const estimated = Number(lead.estimated_total)
    if (Number.isFinite(estimated) && estimated >= 0) return round2(estimated)
  }
  if (lead.calculated_total != null && lead.calculated_total !== '') {
    const calculated = Number(lead.calculated_total)
    if (Number.isFinite(calculated) && calculated >= 0) return round2(calculated)
  }
  const wd =
    lead.wizard_data && typeof lead.wizard_data === 'object' && !Array.isArray(lead.wizard_data)
      ? (lead.wizard_data as Record<string, unknown>)
      : {}
  const s3 =
    wd.step3 && typeof wd.step3 === 'object' && !Array.isArray(wd.step3)
      ? (wd.step3 as Record<string, unknown>)
      : {}
  if (s3.estimatedTotal != null && s3.estimatedTotal !== '') {
    const fromWizard = Number(s3.estimatedTotal)
    if (Number.isFinite(fromWizard) && fromWizard >= 0) return round2(fromWizard)
  }
  return NaN
}

function wizardFromLead(lead: Record<string, unknown>): Record<string, unknown> {
  const wd =
    lead.wizard_data && typeof lead.wizard_data === 'object' && !Array.isArray(lead.wizard_data)
      ? (lead.wizard_data as Record<string, unknown>)
      : {}
  const s1 =
    wd.step1 && typeof wd.step1 === 'object' && !Array.isArray(wd.step1)
      ? (wd.step1 as Record<string, unknown>)
      : {}
  const s2 =
    wd.step2 && typeof wd.step2 === 'object' && !Array.isArray(wd.step2)
      ? (wd.step2 as Record<string, unknown>)
      : {}
  const s3 =
    wd.step3 && typeof wd.step3 === 'object' && !Array.isArray(wd.step3)
      ? (wd.step3 as Record<string, unknown>)
      : {}
  return { ...s1, ...s2, ...s3 }
}

/**
 * Ensure a quotes row exists so Stripe webhook can mark the booking paid.
 * Abandoned recovery leads often have quote_ref but no quote_id yet.
 */
async function ensureQuoteForRecoveryLead(
  supabase: ReturnType<typeof createClient>,
  lead: Record<string, unknown>,
  amount: number,
): Promise<string | null> {
  const existingId = lead.quote_id ? String(lead.quote_id).trim() : ''
  if (existingId && uuidLike(existingId)) return existingId

  const quoteRef = String(lead.quote_ref || lead.lead_ref || '').trim()
  if (quoteRef) {
    const { data: byRef } = await supabase
      .from('quotes')
      .select('id')
      .eq('quote_ref', quoteRef)
      .maybeSingle()
    if (byRef?.id) {
      const id = String(byRef.id)
      await supabase
        .from('customer_leads')
        .update({ quote_id: id, updated_at: new Date().toISOString() })
        .eq('id', String(lead.id))
      return id
    }
  }

  const wizard = wizardFromLead(lead)
  const crewRaw = Number(wizard.crewSize ?? wizard.crew_size)
  const crewSize = Number.isFinite(crewRaw) && crewRaw >= 1 ? Math.round(crewRaw) : null
  const distanceMiles =
    Number.isFinite(Number(wizard.distanceMiles)) ? Number(wizard.distanceMiles) : null

  const insertRow: Record<string, unknown> = {
    quote_ref: quoteRef || `SMH-REC-${String(lead.id).slice(0, 8)}`,
    full_name: String(lead.customer_name || wizard.fullName || 'Customer').trim() || 'Customer',
    email: String(lead.customer_email || wizard.email || '').trim() || 'recovery@shiftmyhome.local',
    phone: String(lead.customer_phone || wizard.phone || '').trim() || '00000000000',
    service: String(lead.service_type || wizard.serviceType || 'Removals').trim() || 'Removals',
    service_type: String(lead.service_type || wizard.serviceType || 'Removals').trim() || 'Removals',
    pickup_address: String(lead.pickup_address || wizard.pickupAddress || '').trim(),
    delivery_address: String(lead.delivery_address || wizard.deliveryAddress || '').trim(),
    move_date: String(lead.move_date || wizard.moveDate || '').trim() || null,
    arrival_window: String(wizard.arrivalWindow || wizard.arrivalSummary || '').trim() || null,
    distance_miles: distanceMiles,
    crew_size: crewSize,
    details: 'Created from quote recovery Pay Now',
    status: 'New',
    payment_status: 'unpaid',
    amount_paid: 0,
    estimated_total: amount,
    calculated_total: Number.isFinite(Number(lead.calculated_total))
      ? Number(lead.calculated_total)
      : amount,
    agreed_price: Number.isFinite(Number(lead.agreed_price)) ? Number(lead.agreed_price) : amount,
    remaining_balance: amount,
    source: 'quote_recovery',
  }

  const { data: inserted, error } = await supabase.from('quotes').insert(insertRow).select('id').single()
  if (error || !inserted?.id) {
    console.error('[create-recovery-checkout] ensure quote insert failed', error?.message || error)
    return null
  }

  const id = String(inserted.id)
  await supabase
    .from('customer_leads')
    .update({ quote_id: id, updated_at: new Date().toISOString() })
    .eq('id', String(lead.id))
  return id
}

async function expireCheckoutSession(stripe: Stripe, sessionId: string | null | undefined) {
  const id = String(sessionId || '').trim()
  if (!id) return
  try {
    await stripe.checkout.sessions.expire(id)
  } catch (err) {
    // Already expired/completed — ignore
    console.warn('[create-recovery-checkout] expire previous session', id, err)
  }
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

  // Block only when fully paid / recovery permanently stopped without an unpaid booking.
  let linkedQuotePaid = false
  if (lead.quote_id) {
    const { data: quote } = await supabase
      .from('quotes')
      .select('id, payment_status, amount_paid, remaining_balance, agreed_price, estimated_total')
      .eq('id', String(lead.quote_id))
      .maybeSingle()
    const ps = String(quote?.payment_status || '').toLowerCase()
    linkedQuotePaid = ps === 'paid' || ps === 'fully_paid' || ps === 'succeeded'
  }

  if (linkedQuotePaid) {
    return jsonResponse({ error: 'Booking already paid' }, 400)
  }

  // Public token: still block permanently stopped recovery unless admin lead_id path.
  if (token && !leadId && lead.recovery_stopped_at && lead.status === 'converted_to_booking') {
    // Allow pay link for converted-but-unpaid bookings created by admin.
  }

  const amount = resolveChargeAmount(lead)
  if (!Number.isFinite(amount) || amount < 1) {
    return jsonResponse({ error: 'Quote total unavailable — set an admin agreed price or resume the quote' }, 400)
  }

  const quoteRef = String(lead.quote_ref || lead.lead_ref || '').trim()
  const email = String(lead.customer_email || '').trim()
  const name = String(lead.customer_name || '').trim()
  const resumeToken = String(lead.resume_token || '')
  const { resumeUrl } = recoveryUrls(resumeToken)

  const ensuredQuoteId = await ensureQuoteForRecoveryLead(supabase, lead, amount)
  if (ensuredQuoteId) {
    lead.quote_id = ensuredQuoteId
  }

  // Invalidate previous checkout if amount changed or regenerating.
  const previousSessionId = String(lead.stripe_checkout_session_id || '').trim()
  const previousAmount = Number(lead.stripe_payment_link_amount)
  if (previousSessionId && (!Number.isFinite(previousAmount) || Math.abs(previousAmount - amount) > 0.009)) {
    await expireCheckoutSession(stripe, previousSessionId)
  } else if (previousSessionId) {
    // Regenerating same amount — expire old open session so only one live link.
    await expireCheckoutSession(stripe, previousSessionId)
  }

  const amountPence = Math.round(round2(amount) * 100)
  const calculatedRaw =
    lead.calculated_total != null && lead.calculated_total !== ''
      ? Number(lead.calculated_total)
      : lead.estimated_total != null && lead.estimated_total !== ''
        ? Number(lead.estimated_total)
        : NaN
  const agreedRaw =
    lead.agreed_price != null && lead.agreed_price !== '' ? Number(lead.agreed_price) : NaN
  const calculated = Number.isFinite(calculatedRaw) ? calculatedRaw : NaN
  const agreed = Number.isFinite(agreedRaw) ? agreedRaw : NaN
  const hasOverride =
    Number.isFinite(agreed) && Number.isFinite(calculated) && Math.abs(agreed - calculated) > 0.009

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
              description: String(
                hasOverride
                  ? `Admin agreed price £${amount.toFixed(2)} (calculated £${calculated.toFixed(2)}) — ${lead.route_label || lead.service_type || 'Removals'}`
                  : lead.route_label || lead.service_type || 'Removals booking',
              ).slice(0, 200),
            },
          },
        },
      ],
      success_url: `${siteUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/payment-cancelled?resume=${encodeURIComponent(resumeToken)}${
        quoteRef ? `&quote_ref=${encodeURIComponent(quoteRef)}` : ''
      }`,
      metadata: stripeMetadata({
        quote_ref: quoteRef,
        quote_id: lead.quote_id ? String(lead.quote_id) : '',
        customer_lead_id: String(lead.id),
        payment_type: 'full',
        recovery: '1',
        customer_name: name,
        agreed_price: Number.isFinite(agreed) ? String(agreed) : '',
        calculated_total: Number.isFinite(calculated) ? String(calculated) : '',
        admin_price_override: hasOverride ? '1' : '0',
      }),
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

  // Persist live checkout link on the lead for audit / invalidate-on-change.
  try {
    await supabase
      .from('customer_leads')
      .update({
        stripe_checkout_session_id: session.id,
        stripe_payment_link_url: session.url,
        stripe_payment_link_amount: amount,
        quote_id: lead.quote_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', String(lead.id))
  } catch (persistErr) {
    console.warn('[create-recovery-checkout] persist session id failed', persistErr)
  }

  // Keep linked quote remaining_balance aligned with charge amount.
  if (lead.quote_id) {
    try {
      await supabase
        .from('quotes')
        .update({
          remaining_balance: amount,
          agreed_price: Number.isFinite(agreed) ? agreed : amount,
          estimated_total: amount,
          stripe_session_id: session.id,
        })
        .eq('id', String(lead.quote_id))
    } catch (qErr) {
      console.warn('[create-recovery-checkout] quote sync failed', qErr)
    }
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
    calculated_total: Number.isFinite(calculated) ? calculated : null,
    agreed_price: Number.isFinite(agreed) ? agreed : null,
    resume_url: resumeUrl,
  })
})
