import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendResendEmail } from '../_shared/resendClient.ts'
import { buildJobCustomerEmailHtml, trackingUrl } from '../_shared/jobCustomerNotify.ts'

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

/** Confirm tip after Stripe Checkout success (idempotent). */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const stripeKey = (Deno.env.get('STRIPE_SECRET_KEY') || '').trim()
  if (!supabaseUrl || !serviceRole || !stripeKey) {
    return jsonResponse({ error: 'Server misconfigured' }, 500)
  }

  const body = await req.json().catch(() => ({}))
  const sessionId = typeof body?.session_id === 'string' ? body.session_id.trim() : ''
  if (!sessionId) return jsonResponse({ error: 'session_id required' }, 400)

  const Stripe = (await import('npm:stripe@14.21.0')).default
  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    return jsonResponse({ ok: false, error: 'not_paid' }, 400)
  }

  const tipId = String(session.metadata?.tip_id || '').trim()
  const quoteId = String(session.metadata?.quote_id || '').trim()
  if (!tipId) return jsonResponse({ error: 'missing tip metadata' }, 400)

  const supabase = createClient(supabaseUrl, serviceRole)
  const { data: tip } = await supabase.from('job_tips').select('*').eq('id', tipId).maybeSingle()
  if (!tip) return jsonResponse({ error: 'tip_not_found' }, 404)

  if (tip.status !== 'paid') {
    const paidAt = new Date().toISOString()
    await supabase
      .from('job_tips')
      .update({
        status: 'paid',
        paid_at: paidAt,
        stripe_payment_intent_id:
          typeof session.payment_intent === 'string' ? session.payment_intent : tip.stripe_payment_intent_id,
        updated_at: paidAt,
      })
      .eq('id', tipId)

    const qid = quoteId || tip.quote_id
    const { data: paidTips } = await supabase
      .from('job_tips')
      .select('amount_gbp')
      .eq('quote_id', qid)
      .eq('status', 'paid')
    const tipTotal = (paidTips || []).reduce((s, t) => s + Number(t.amount_gbp || 0), 0)

    await supabase
      .from('quotes')
      .update({ tip_total_gbp: tipTotal, tip_paid_at: paidAt })
      .eq('id', qid)

    const { data: quote } = await supabase.from('quotes').select('email, full_name, quote_ref').eq('id', qid).maybeSingle()
    const email = String(quote?.email || tip.customer_email || '').trim()
    const token = String(tip.tracking_token || session.metadata?.tracking_token || '')
    if (email) {
      const html = buildJobCustomerEmailHtml({
        title: 'Tip payment received',
        intro: `Hi ${String(quote?.full_name || 'there')}, thank you — your optional tip of £${Number(tip.amount_gbp).toFixed(2)} has been received.`,
        rows: [
          { label: 'Booking', value: String(quote?.quote_ref || '') },
          { label: 'Tip amount', value: `£${Number(tip.amount_gbp).toFixed(2)}` },
        ],
        primaryCta: token ? { label: 'View My Booking', url: trackingUrl(token) } : undefined,
      })
      await sendResendEmail({
        to: email,
        subject: `[ShiftMyHome] Tip received (${quote?.quote_ref || 'booking'})`,
        html,
        text: `Tip of £${Number(tip.amount_gbp).toFixed(2)} received.`,
        logTag: 'job-tip-confirmation',
      })
    }
  }

  return jsonResponse({ ok: true, tip_id: tipId, amount_gbp: tip.amount_gbp })
})
