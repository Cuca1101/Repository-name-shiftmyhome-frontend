import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14.21.0'
import { guardStripeSecretKey, respondStripeConfigFailure } from '../_shared/stripeSecretGuard.ts'
import {
  callerOwnsQuote,
  commitCustomerEdit,
  evaluateCustomerEdit,
  loadCustomerQuote,
  startPaymentForAmendment,
} from '../_shared/customerAmendmentFlow.ts'
import {
  applyAdminCustomerAmendment,
  applyPaidCustomerAmendment,
} from '../_shared/applyCustomerAmendment.ts'

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

function isAdmin(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null) {
  const role = String(user?.app_metadata?.role || user?.user_metadata?.role || '').toLowerCase()
  return role === 'admin'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  if (!supabaseUrl || !serviceKey || !anonKey) return jsonResponse({ ok: false, error: 'Server misconfigured' }, 500)

  const header = req.headers.get('Authorization') || ''
  const jwt = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!jwt) return jsonResponse({ ok: false, error: 'Sign in to continue.' }, 401)

  const supabase = createClient(supabaseUrl, serviceKey)
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
  if (userError || !userData.user) return jsonResponse({ ok: false, error: 'Sign in to continue.' }, 401)
  const user = userData.user

  const body = await req.json().catch(() => ({}))
  const action = String(body?.action || '').trim()
  const quoteId = String(body?.quote_id || '').trim()

  try {
    if (action === 'approve' || action === 'decline') {
      if (!isAdmin(user)) return jsonResponse({ ok: false, error: 'Only the team can review this change.' }, 403)
      const amendmentId = String(body?.amendment_id || '').trim()
      if (!amendmentId) return jsonResponse({ ok: false, error: 'Missing change.' }, 400)
      if (action === 'decline') {
        const { data: row } = await supabase
          .from('customer_booking_amendments')
          .select('id, paid_at, payment_delta, status')
          .eq('id', amendmentId)
          .maybeSingle()
        if (!row || row.status === 'applied') return jsonResponse({ ok: false, error: 'This change cannot be declined.' }, 400)
        const refund = row.paid_at ? Number(row.payment_delta) || 0 : null
        await supabase
          .from('customer_booking_amendments')
          .update({
            status: 'rejected',
            refund_due: refund && refund > 0 ? refund : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', amendmentId)
          .neq('status', 'applied')
        return jsonResponse({ ok: true, status: 'rejected', quoteUnchanged: true })
      }
      const result = await applyAdminCustomerAmendment(supabase, amendmentId)
      return jsonResponse(result, result.ok ? 200 : 400)
    }

    if (!quoteId) return jsonResponse({ ok: false, error: 'Missing booking.' }, 400)
    const quote = await loadCustomerQuote(supabase, quoteId)
    if (!quote) return jsonResponse({ ok: false, error: 'Booking not found.' }, 404)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const kindResult = await userClient.rpc('account_session_kind')
    const kind = !kindResult.error && typeof kindResult.data === 'string'
      ? kindResult.data
      : (isAdmin(user) ? 'admin' : 'customer')
    if (kind === 'driver' || kind === 'none') {
      return jsonResponse({ ok: false, error: 'Booking not found.' }, 404)
    }

    let actedAs: 'customer' | 'admin' = 'customer'
    let returnCustomerId = ''
    if (kind === 'admin') {
      const adminCustomerId = String(body?.admin_customer_id || '').trim()
      if (!adminCustomerId) {
        return jsonResponse({ ok: false, error: 'Open this booking from Admin → Customers.' }, 403)
      }
      const { data: customer } = await supabase.from('customers').select('id, email').eq('id', adminCustomerId).maybeSingle()
      if (!customer || !(callerOwnsQuote(customer.email, quote) || quote.customer_id === customer.id)) {
        return jsonResponse({ ok: false, error: 'Booking not found.' }, 404)
      }
      actedAs = 'admin'
      returnCustomerId = adminCustomerId
    } else if (!callerOwnsQuote(user.email, quote)) {
      const { data: owner } = await supabase
        .from('customers')
        .select('id')
        .eq('email', String(user.email || '').trim().toLowerCase())
        .maybeSingle()
      if (!owner || quote.customer_id !== owner.id) {
        return jsonResponse({ ok: false, error: 'Booking not found.' }, 404)
      }
    }

    if (action === 'preview') {
      const result = await evaluateCustomerEdit(supabase, quote, body?.edits || {})
      return jsonResponse(result, result.ok ? 200 : 400)
    }

    if (action === 'commit') {
      const stripeGuard = guardStripeSecretKey()
      if (!stripeGuard.ok) return respondStripeConfigFailure(jsonResponse, stripeGuard)
      const result = await commitCustomerEdit({
        supabase,
        stripeKey: stripeGuard.key,
        quote,
        edits: body?.edits || {},
        expectedTotal: body?.expected_total == null ? null : Number(body.expected_total),
        userId: user.id,
        actedAs,
        returnCustomerId,
      })
      return jsonResponse(result, result.ok ? 200 : 400)
    }

    if (action === 'pay') {
      const stripeGuard = guardStripeSecretKey()
      if (!stripeGuard.ok) return respondStripeConfigFailure(jsonResponse, stripeGuard)
      const result = await startPaymentForAmendment({
        supabase,
        stripeKey: stripeGuard.key,
        quote,
        amendmentId: String(body?.amendment_id || ''),
        returnCustomerId,
      })
      return jsonResponse(result, result.ok ? 200 : 400)
    }

    if (action === 'abandon') {
      const amendmentId = String(body?.amendment_id || '').trim()
      if (!amendmentId) return jsonResponse({ ok: true, quoteUnchanged: true })
      await supabase
        .from('customer_booking_amendments')
        .update({ status: 'abandoned', updated_at: new Date().toISOString() })
        .eq('id', amendmentId)
        .eq('quote_id', quoteId)
        .eq('status', 'pending_payment')
        .is('paid_at', null)
      return jsonResponse({ ok: true, quoteUnchanged: true })
    }

    if (action === 'confirm_payment') {
      const stripeGuard = guardStripeSecretKey()
      if (!stripeGuard.ok) return respondStripeConfigFailure(jsonResponse, stripeGuard)
      const sessionId = String(body?.session_id || '').trim()
      if (!sessionId) return jsonResponse({ ok: false, error: 'Missing payment session.' }, 400)
      const stripe = new Stripe(stripeGuard.key, { apiVersion: '2023-10-16' })
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      const amendmentId = String(session.metadata?.customer_booking_amendment_id || '')
      const sessionQuote = String(session.metadata?.quote_id || '')
      if (!amendmentId || sessionQuote !== quoteId || session.metadata?.payment_type !== 'customer_booking_amendment') {
        return jsonResponse({ ok: false, error: 'Payment does not match this booking.' }, 400)
      }
      if (session.payment_status !== 'paid') {
        return jsonResponse({ ok: true, status: 'payment_failed', quoteUnchanged: true })
      }
      const result = await applyPaidCustomerAmendment(supabase, {
        amendmentId,
        paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        sessionId,
      })
      return jsonResponse(result, result.ok ? 200 : 400)
    }

    return jsonResponse({ ok: false, error: 'Unknown action.' }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update the booking.'
    console.error('[customer-booking-amend]', message)
    return jsonResponse({ ok: false, error: message }, 500)
  }
})
