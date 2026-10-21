import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { assertAdminCaller } from '../_shared/verifyAdminCaller.ts'
import { sendResendEmail } from '../_shared/resendClient.ts'
import { saveCustomerEmailArchive } from '../_shared/customerEmailArchive.ts'
import { siteBaseUrl } from '../_shared/jobCustomerNotify.ts'
import { guardStripeSecretKey, respondStripeConfigFailure } from '../_shared/stripeSecretGuard.ts'
import {
  PHONE_QUOTE_DEPOSIT_MIN_HOURS,
  phoneQuoteFinalTotal,
  phoneQuotePaymentOptions,
} from '../_shared/phoneQuotePaymentRules.ts'
import { arrivalText, buildPhoneQuoteEmail, inventoryRows, resolvePhoneQuoteLogoUrl } from '../_shared/phoneQuoteEmail.ts'

/**
 * Phone quotes created in Admin → New phone booking.
 *
 * Public (token):  { action: 'view', token }                       → quote summary + payment options
 *                  { action: 'create_payment', token, payment_type } → Stripe PaymentIntent client_secret
 * Admin (JWT):     { action: 'preview', quoteId, payment_type? }    → email subject + html, nothing sent
 *                  { action: 'send', quoteId, payment_type? }       → sends one email; omit payment_type for both pay buttons
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PHONE_SOURCES = ['phone_booking', 'admin_phone_booking']

const QUOTE_SELECT =
  'id, quote_ref, source, full_name, email, phone, pickup_address, delivery_address, move_date, arrival_time, arrival_window, service_type, service, crew_size, vehicle_size, inventory, estimated_total, agreed_price, amount_paid, remaining_balance, payment_status, payment_type, status, operational_status, cancelled_at, completed_at, quote_pay_token, quote_sent_at, quote_sent_count, quote_sent_total, distance_miles'

type QuoteRow = Record<string, unknown> & { id: string; quote_ref: string }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function newToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function isPhoneQuote(q: QuoteRow) {
  return PHONE_SOURCES.includes(String(q.source || '').trim())
}

function isClosed(q: QuoteRow) {
  const st = String(q.status || '').trim().toLowerCase()
  const op = String(q.operational_status || '').trim().toLowerCase()
  return Boolean(q.cancelled_at) || st === 'cancelled' || op === 'cancelled' || Boolean(q.completed_at) || op === 'completed'
}

function payUrl(token: string, paymentType = '') {
  const base = `${siteBaseUrl()}/quote/view/${encodeURIComponent(token)}`
  if (paymentType === 'deposit' || paymentType === 'full') return `${base}?pay=${paymentType}`
  return base
}

function paymentOptionsFor(q: QuoteRow) {
  return phoneQuotePaymentOptions({
    moveDate: q.move_date,
    arrivalTime: q.arrival_time,
    total: phoneQuoteFinalTotal(q),
    amountPaid: q.amount_paid,
    paymentStatus: q.payment_status,
  })
}

function publicView(q: QuoteRow) {
  const opts = paymentOptionsFor(q)
  return {
    quote_ref: q.quote_ref,
    first_name: String(q.full_name || '').trim().split(/\s+/)[0] || '',
    email: String(q.email || ''),
    pickup_address: q.pickup_address || '',
    delivery_address: q.delivery_address || '',
    move_date: q.move_date || null,
    arrival: arrivalText(q),
    service_type: q.service_type || q.service || '',
    crew_size: q.crew_size ?? null,
    vehicle_size: q.vehicle_size ?? null,
    inventory: inventoryRows(q),
    total: opts.total,
    payment_status: String(q.payment_status || 'unpaid'),
    payment_type: q.payment_type || null,
    amount_paid: opts.amountPaid,
    balance: opts.balance,
    closed: isClosed(q),
    options: {
      can_pay: opts.canPay && !isClosed(q),
      deposit_allowed: opts.depositAllowed && !isClosed(q),
      full_only_reason: opts.fullOnlyReason,
      deposit: opts.deposit,
      balance_after_deposit: opts.balanceAfterDeposit,
      hours_until_move: opts.hoursUntilMove,
      move_start: opts.moveStartIso,
      min_hours_for_deposit: PHONE_QUOTE_DEPOSIT_MIN_HOURS,
    },
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) return jsonResponse({ ok: false, error: 'server_misconfigured' }, 503)
  const admin = createClient(supabaseUrl, serviceKey)

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const action = String(body.action || '').trim()

  if (action === 'view' || action === 'create_payment') {
    const token = String(body.token || '').trim()
    if (token.length < 20) return jsonResponse({ ok: false, error: 'not_found' }, 404)
    const { data, error } = await admin.from('quotes').select(QUOTE_SELECT).eq('quote_pay_token', token).maybeSingle()
    if (error) return jsonResponse({ ok: false, error: 'lookup_failed' }, 500)
    const q = data as QuoteRow | null
    if (!q || !isPhoneQuote(q)) return jsonResponse({ ok: false, error: 'not_found' }, 404)

    if (action === 'view') return jsonResponse({ ok: true, quote: publicView(q) })

    const requested = String(body.payment_type || '').trim()
    if (requested !== 'deposit' && requested !== 'full') {
      return jsonResponse({ ok: false, error: 'invalid_payment_type' }, 400)
    }
    if (isClosed(q)) return jsonResponse({ ok: false, error: 'quote_closed' }, 409)
    const opts = paymentOptionsFor(q)
    if (opts.alreadyPaid) return jsonResponse({ ok: false, error: 'already_paid', quote: publicView(q) }, 409)
    if (!opts.canPay || opts.total == null) return jsonResponse({ ok: false, error: 'no_price' }, 409)
    if (requested === 'deposit' && !opts.depositAllowed) {
      return jsonResponse(
        {
          ok: false,
          error: 'deposit_not_allowed',
          message: 'A £50 deposit is only available when the total is more than £50.',
          quote: publicView(q),
        },
        409,
      )
    }

    const stripeGuard = guardStripeSecretKey()
    if (!stripeGuard.ok) return respondStripeConfigFailure(jsonResponse, stripeGuard)
    const stripe = new Stripe(stripeGuard.key, { httpClient: Stripe.createFetchHttpClient() })

    const amountGbp = requested === 'deposit' ? opts.deposit : opts.total
    const amountPence = Math.round(amountGbp * 100)
    try {
      const intent = await stripe.paymentIntents.create({
        amount: amountPence,
        currency: 'gbp',
        automatic_payment_methods: { enabled: true },
        receipt_email: String(q.email || '').trim() || undefined,
        metadata: {
          quote_id: q.id,
          quote_ref: q.quote_ref,
          payment_type: requested,
          customer_email: String(q.email || '').slice(0, 450),
          customer_name: String(q.full_name || '').slice(0, 450),
          service_type: String(q.service_type || q.service || '').slice(0, 450),
          phone_quote: '1',
          quote_total_gbp: opts.total.toFixed(2),
        },
        description:
          requested === 'deposit'
            ? `£${amountGbp.toFixed(2)} deposit — quote ${q.quote_ref}`
            : `Full payment — quote ${q.quote_ref}`,
      })
      if (!intent.client_secret) return jsonResponse({ ok: false, error: 'stripe_no_client_secret' }, 500)
      return jsonResponse({
        ok: true,
        client_secret: intent.client_secret,
        payment_intent_id: intent.id,
        payment_type: requested,
        amount_gbp: amountGbp,
        total_gbp: opts.total,
        balance_after_gbp: Math.max(0, Math.round((opts.total - amountGbp) * 100) / 100),
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[phone-quote] stripe create failed', msg)
      return jsonResponse({ ok: false, error: 'stripe_error', message: msg }, 502)
    }
  }

  if (action !== 'preview' && action !== 'send') {
    return jsonResponse({ ok: false, error: 'unknown_action' }, 400)
  }

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ') || !anonKey) return jsonResponse({ ok: false, error: 'unauthorized' }, 401)
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) return jsonResponse({ ok: false, error: 'unauthorized' }, 401)
  const allowed = await assertAdminCaller(admin, userData.user)
  if (!allowed.ok) return jsonResponse({ ok: false, error: 'forbidden' }, 403)

  const quoteId = String(body.quoteId || '').trim()
  if (!quoteId) return jsonResponse({ ok: false, error: 'missing_quote_id' }, 400)
  const { data: row, error: rowErr } = await admin.from('quotes').select(QUOTE_SELECT).eq('id', quoteId).maybeSingle()
  if (rowErr) return jsonResponse({ ok: false, error: 'lookup_failed' }, 500)
  const q = row as QuoteRow | null
  if (!q || !isPhoneQuote(q)) return jsonResponse({ ok: false, error: 'not_found' }, 404)
  if (phoneQuoteFinalTotal(q) == null) return jsonResponse({ ok: false, error: 'no_price' }, 409)

  let token = String(q.quote_pay_token || '').trim()
  if (!token) {
    token = newToken()
    const { error: tokErr } = await admin
      .from('quotes')
      .update({ quote_pay_token: token })
      .eq('id', q.id)
      .is('quote_pay_token', null)
    if (tokErr) return jsonResponse({ ok: false, error: 'token_save_failed' }, 500)
    const { data: again } = await admin.from('quotes').select('quote_pay_token').eq('id', q.id).maybeSingle()
    token = String(again?.quote_pay_token || token)
  }

  const requested = body.payment_type === 'deposit' || body.payment_type === 'full' ? body.payment_type : ''
  const opts = paymentOptionsFor(q)
  if (requested === 'deposit' && !opts.depositAllowed) {
    return jsonResponse({
      ok: false,
      error: 'deposit_not_available',
      message: 'A £50 deposit is only available when the total is more than £50. Send the full payment link instead.',
    }, 409)
  }
  const site = siteBaseUrl()
  const logoUrl = await resolvePhoneQuoteLogoUrl(site, Deno.env.get('COMPANY_LOGO_URL') || '')
  const email = buildPhoneQuoteEmail(q, {
    link: payUrl(token, requested),
    site,
    logoUrl,
    supportEmail: Deno.env.get('COMPANY_SUPPORT_EMAIL') || '',
    paymentChoice: requested,
  })
  const to = String(q.email || '').trim().toLowerCase()

  if (action === 'preview') {
    return jsonResponse({ ok: true, subject: email.subject, html: email.html, to, pay_url: email.link, total: email.total })
  }

  if (!to || !to.includes('@') || to.endsWith('@shiftmyhome.local')) {
    return jsonResponse({ ok: false, error: 'missing_customer_email' }, 409)
  }
  if (opts.alreadyPaid) return jsonResponse({ ok: false, error: 'already_paid' }, 409)

  const sentCount = Number(q.quote_sent_count) || 0
  const sent = await sendResendEmail({
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    idempotencyKey: `phone-quote-${q.id}-${sentCount + 1}`,
    logTag: 'phone-quote',
  })
  if (!sent.ok) return jsonResponse({ ok: false, error: 'email_failed', message: sent.error || '' }, 502)

  const sentAt = new Date().toISOString()
  await admin
    .from('quotes')
    .update({ quote_sent_at: sentAt, quote_sent_count: sentCount + 1, quote_sent_total: email.total })
    .eq('id', q.id)

  await saveCustomerEmailArchive(admin, {
    quoteId: q.id,
    eventKey: 'phone_quote_sent',
    subject: email.subject,
    recipientEmail: to,
    html: email.html,
    text: email.text,
    providerMessageId: sent.resendId || null,
    providerStatus: 'sent',
    sentAt,
  })

  return jsonResponse({ ok: true, sent_at: sentAt, to, pay_url: email.link, total: email.total, sent_count: sentCount + 1 })
})
