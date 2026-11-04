import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { assertAdminCaller } from '../_shared/verifyAdminCaller.ts'
import { guardStripeSecretKey, respondStripeConfigFailure } from '../_shared/stripeSecretGuard.ts'
import { STRIPE_LOCALE } from '../_shared/stripeMode.ts'
import { sendResendEmail } from '../_shared/resendClient.ts'
import { saveCustomerEmailArchive } from '../_shared/customerEmailArchive.ts'
import { balanceChargeForQuote } from '../_shared/applyBalancePayment.ts'

/**
 * Admin-only: email the customer a card link for the balance left after a deposit.
 * Does not change the deposit, the booking total, or the amount already paid.
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

function esc(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function gbp(n: number) {
  return `£${n.toFixed(2)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)

  const stripeGuard = guardStripeSecretKey()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const siteUrl = (Deno.env.get('SITE_URL') || 'https://www.shiftmyhome.co.uk').replace(/\/$/, '')

  if (!stripeGuard.ok) return respondStripeConfigFailure(jsonResponse, stripeGuard)
  if (!supabaseUrl || !serviceRole) return jsonResponse({ ok: false, error: 'server_misconfigured' }, 500)

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ') || !anonKey) return jsonResponse({ ok: false, error: 'unauthorized' }, 401)
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) return jsonResponse({ ok: false, error: 'unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceRole)
  const allowed = await assertAdminCaller(admin, userData.user)
  if (!allowed.ok) return jsonResponse({ ok: false, error: 'forbidden', message: allowed.message }, 403)

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400)
  }
  const quoteId = String(body.quoteId || '').trim()
  if (!quoteId) return jsonResponse({ ok: false, error: 'missing_quote_id' }, 400)

  const { data: row, error: rowErr } = await admin
    .from('quotes')
    .select(
      'id, quote_ref, email, full_name, payment_status, payment_type, amount_paid, agreed_price, estimated_total, remaining_balance, price_override_reason, cancelled_at, operational_status, status',
    )
    .eq('id', quoteId)
    .maybeSingle()
  if (rowErr || !row) return jsonResponse({ ok: false, error: 'not_found' }, 404)

  const status = String(row.payment_status || '').toLowerCase()
  const cancelled =
    Boolean(row.cancelled_at) ||
    String(row.operational_status || '').toLowerCase() === 'cancelled' ||
    String(row.status || '').toLowerCase() === 'cancelled'
  if (cancelled) return jsonResponse({ ok: false, error: 'booking_cancelled', message: 'This booking is cancelled.' }, 409)

  const charge = balanceChargeForQuote(row)
  if (status === 'paid' && (charge.remaining == null || charge.remaining < 0.3)) {
    return jsonResponse({ ok: false, error: 'already_paid', message: 'This booking is already paid in full.' }, 409)
  }
  if (charge.remaining == null || charge.remaining < 0.3 || charge.total == null) {
    return jsonResponse({ ok: false, error: 'no_balance', message: 'There is no remaining balance to collect.' }, 409)
  }

  const to = String(row.email || '').trim().toLowerCase()
  if (!to.includes('@') || to.endsWith('@shiftmyhome.local')) {
    return jsonResponse({ ok: false, error: 'missing_customer_email', message: 'This booking has no customer email.' }, 409)
  }

  const stripe = new Stripe(stripeGuard.key, { httpClient: Stripe.createFetchHttpClient() })
  const ref = String(row.quote_ref || '').trim()
  const name = String(row.full_name || '').trim()
  const metadata = {
    quote_id: String(row.id),
    quote_ref: ref,
    payment_type: 'balance',
    customer_email: to,
  }
  let checkoutUrl = ''
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: STRIPE_LOCALE,
      customer_email: to,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'gbp',
            unit_amount: Math.round(charge.remaining * 100),
            product_data: {
              name: `ShiftMyHome — remaining balance${ref ? ` ${ref}` : ''}`,
              description: charge.paid >= 0.3
                ? `Remaining balance after ${gbp(charge.paid)} already paid`
                : 'Remaining balance on this booking',
            },
          },
        },
      ],
      success_url: `${siteUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: ref ? `${siteUrl}/payment-cancelled?quote_ref=${encodeURIComponent(ref)}` : `${siteUrl}/payment-cancelled`,
      metadata,
      payment_intent_data: { metadata },
    })
    checkoutUrl = String(session.url || '')
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[send-balance-payment-email] stripe', message)
    return jsonResponse({ ok: false, error: 'stripe_error', message }, 502)
  }
  if (!checkoutUrl) return jsonResponse({ ok: false, error: 'stripe_error', message: 'Stripe did not return a payment link.' }, 502)

  const subject = `[ShiftMyHome] Please pay the remaining balance — ${ref || 'your booking'}`
  const greeting = name ? `Hi ${esc(name)},` : 'Hello,'
  const html = `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
<p>${greeting}</p>
<p>Your booking <strong>${esc(ref || '')}</strong> ${charge.paid >= 0.3 ? `has <strong>${gbp(charge.paid)}</strong> paid. The remaining balance is` : 'has a remaining balance of'} <strong>${gbp(charge.remaining)}</strong>.</p>
<p><a href="${esc(checkoutUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px">Pay remaining balance</a></p>
<p style="font-size:13px;color:#475569">Booking total ${gbp(charge.total)} · Paid ${gbp(charge.paid)} · Balance ${gbp(charge.remaining)}</p>
<p>ShiftMyHome</p>
</div>`
  const text = `${name ? `Hi ${name},` : 'Hello,'}\n\nYour booking ${ref} ${charge.paid >= 0.3 ? `has ${gbp(charge.paid)} paid. The remaining balance is` : 'has a remaining balance of'} ${gbp(charge.remaining)}.\n\nPay here: ${checkoutUrl}\n\nShiftMyHome`

  const sent = await sendResendEmail({
    to,
    subject,
    html,
    text,
    idempotencyKey: `balance-email-${row.id}-${Date.now()}`,
    logTag: 'balance-payment-email',
  })
  if (!sent.ok) return jsonResponse({ ok: false, error: 'email_failed', message: sent.error || 'The email could not be sent.' }, 502)

  const sentAt = new Date().toISOString()
  await saveCustomerEmailArchive(admin, {
    quoteId: String(row.id),
    eventKey: 'balance_payment_request',
    subject,
    recipientEmail: to,
    html,
    text,
    providerMessageId: sent.resendId || null,
    providerStatus: 'sent',
    sentAt,
  })

  return jsonResponse({
    ok: true,
    to,
    sent_at: sentAt,
    remaining_gbp: charge.remaining,
    paid_gbp: charge.paid,
    total_gbp: charge.total,
  })
})
