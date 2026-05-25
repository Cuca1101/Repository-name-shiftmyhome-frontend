import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { validateStripeSecretKey } from '../_shared/stripeMode.ts'
import { renderExtraChargeEmailTemplate } from '../_shared/extraChargeEmailTemplate.ts'
import { sendResendEmailMinimal } from '../_shared/postResendEmail.ts'

/**
 * Creates a Stripe PaymentIntent for an approved extra charge request
 * and sends the customer a payment link email via Resend.
 *
 * Called by admin panel after approving an extra charge amount.
 *
 * Secrets: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *          RESEND_API_KEY, RESEND_FROM_EMAIL (optional)
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
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = (Deno.env.get('RESEND_API_KEY') || '').trim()
  const resendFrom = (Deno.env.get('RESEND_FROM_EMAIL') || 'ShiftMyHome <onboarding@resend.dev>').trim()
  const siteUrl = (Deno.env.get('SITE_URL') || 'https://www.shiftmyhome.co.uk').trim()

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

  const request_id = String(body.request_id ?? '').trim()
  if (!request_id) {
    return jsonResponse({ error: 'request_id is required' }, 400)
  }

  const supabase = createClient(supabaseUrl, serviceRole)

  // Fetch the extra charge request
  const { data: ecr, error: fetchErr } = await supabase
    .from('extra_charge_requests')
    .select('*')
    .eq('id', request_id)
    .maybeSingle()

  if (fetchErr || !ecr) {
    return jsonResponse({ error: 'Extra charge request not found' }, 404)
  }

  if (ecr.status === 'paid') {
    return jsonResponse({ error: 'This extra charge has already been paid.' }, 409)
  }
  if (ecr.status === 'pending_customer_payment' && ecr.stripe_payment_intent_id) {
    return jsonResponse({
      ok: true,
      already_created: true,
      payment_intent_id: ecr.stripe_payment_intent_id,
      stripe_payment_link: ecr.stripe_payment_link,
    })
  }

  const approvedAmount = Number(ecr.approved_amount)
  if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
    return jsonResponse({ error: 'approved_amount must be set and > 0 before creating payment' }, 400)
  }

  const currency = String(ecr.currency || 'GBP').toLowerCase()
  const unitAmount = Math.round(approvedAmount * 100)
  if (unitAmount < 30) {
    return jsonResponse({ error: 'Amount too low for card payment (minimum £0.30)' }, 400)
  }

  const customerEmail = String(ecr.customer_email || body.customer_email || '').trim()
  const customerName = String(ecr.customer_name || body.customer_name || '').trim()
  const bookingRef = String(ecr.booking_reference || body.booking_reference || '').trim()

  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return jsonResponse({ error: 'Valid customer_email is required' }, 400)
  }

  const stripe = new Stripe(stripeKey, {
    httpClient: Stripe.createFetchHttpClient(),
  })

  const metadata: Record<string, string> = {
    extra_charge_request_id: request_id,
    job_id: ecr.job_id ? String(ecr.job_id) : '',
    quote_id: ecr.quote_id ? String(ecr.quote_id) : '',
    booking_reference: bookingRef,
    payment_type: 'extra_charge',
    customer_email: customerEmail,
    customer_name: customerName,
  }

  let intent: Stripe.PaymentIntent
  try {
    intent = await stripe.paymentIntents.create({
      amount: unitAmount,
      currency,
      automatic_payment_methods: { enabled: true },
      receipt_email: customerEmail || undefined,
      metadata,
      description: `Extra charges — booking ${bookingRef || ecr.job_id}`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return jsonResponse({ error: `Stripe error: ${msg}` }, 500)
  }

  // Create a payment link URL that uses the existing payment page
  const paymentLink = `${siteUrl}/payment-success?payment_intent=${encodeURIComponent(intent.id)}`
  // For extra charges we use a hosted Stripe payment link via checkout
  // Instead, create a Stripe Payment Link for simpler customer UX
  let stripePaymentLink = ''
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_intent_data: { metadata },
      line_items: [{
        price_data: {
          currency,
          unit_amount: unitAmount,
          product_data: {
            name: `Additional charges — ${bookingRef || 'Booking'}`,
            description: `Extra items added during your move${bookingRef ? ` (ref: ${bookingRef})` : ''}`,
          },
        },
        quantity: 1,
      }],
      customer_email: customerEmail,
      success_url: `${siteUrl}/payment-success?payment_intent=${encodeURIComponent(intent.id)}`,
      cancel_url: `${siteUrl}`,
      metadata,
    })
    stripePaymentLink = session.url || ''
  } catch (e) {
    console.error('[create-extra-charge-payment] Checkout session error, falling back to PI only:', e)
    stripePaymentLink = ''
  }

  // Update the extra charge request in DB
  const { error: updateErr } = await supabase
    .from('extra_charge_requests')
    .update({
      status: 'pending_customer_payment',
      stripe_payment_intent_id: intent.id,
      stripe_payment_link: stripePaymentLink || null,
      customer_email: customerEmail,
      customer_name: customerName,
      booking_reference: bookingRef,
      updated_at: new Date().toISOString(),
    })
    .eq('id', request_id)

  if (updateErr) {
    console.error('[create-extra-charge-payment] DB update error:', updateErr)
  }

  // Send customer email
  let emailSent = false
  let emailError = ''
  if (resendApiKey && stripePaymentLink) {
    try {
      const addedItems = Array.isArray(ecr.added_items) ? ecr.added_items : []
      const { subject, html, text } = renderExtraChargeEmailTemplate({
        bookingReference: bookingRef,
        customerName,
        approvedAmount,
        currency: ecr.currency || 'GBP',
        addedItems,
        paymentLink: stripePaymentLink,
        supportEmail: 'admin@shiftmyhome.co.uk',
      })

      const result = await sendResendEmailMinimal({
        logTag: 'create-extra-charge-payment',
        apiKey: resendApiKey,
        from: resendFrom,
        to: [customerEmail],
        subject,
        html,
        text,
        attachments: [],
      })
      emailSent = result.ok
      if (!result.ok) emailError = result.bodyText
    } catch (e) {
      emailError = e instanceof Error ? e.message : String(e)
      console.error('[create-extra-charge-payment] Email error:', emailError)
    }
  }

  console.log('[create-extra-charge-payment] success', {
    request_id,
    payment_intent_id: intent.id,
    amount: approvedAmount,
    email_sent: emailSent,
  })

  return jsonResponse({
    ok: true,
    payment_intent_id: intent.id,
    stripe_payment_link: stripePaymentLink || null,
    email_sent: emailSent,
    email_error: emailError || undefined,
  })
})
