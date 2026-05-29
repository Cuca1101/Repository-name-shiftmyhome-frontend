/**
 * Shared: approve extra charge + Stripe checkout (no customer email — sent after payment via webhook).
 */
import Stripe from 'npm:stripe@14.21.0'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export type ExtraChargeRow = Record<string, unknown>

export function normalizeAddedItemsForEmail(raw: unknown): {
  name?: string
  quantity?: number
  volume_m3?: number
  notes?: string
  line_amount_gbp?: number
  line_price_label?: string
}[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const qty = Number(o.quantity) || 1
    const vol = o.volume_m3 ?? o.volume_per_unit_m3
    const lineAmt = o.line_amount_gbp != null ? Number(o.line_amount_gbp) : NaN
    const notesParts: string[] = []
    if (vol != null && Number.isFinite(Number(vol))) {
      notesParts.push(`${Number(vol)} m³`)
    }
    if (Number.isFinite(lineAmt) && lineAmt > 0) {
      notesParts.push(`£${lineAmt.toFixed(2)}`)
    } else if (o.line_price_label) {
      notesParts.push(String(o.line_price_label))
    }
  return {
      name: String(o.name || 'Item'),
      quantity: qty,
      volume_m3: vol != null ? Number(vol) : undefined,
      notes: notesParts.length ? notesParts.join(' · ') : String(o.notes || '—'),
      line_amount_gbp: Number.isFinite(lineAmt) ? lineAmt : undefined,
      line_price_label: o.line_price_label != null ? String(o.line_price_label) : undefined,
    }
  })
}

export async function enrichExtraChargeFromQuote(
  supabase: SupabaseClient,
  ecr: ExtraChargeRow,
): Promise<{ customerEmail: string; customerName: string; bookingRef: string }> {
  let customerEmail = String(ecr.customer_email || '').trim()
  let customerName = String(ecr.customer_name || '').trim()
  let bookingRef = String(ecr.booking_reference || '').trim()

  const quoteId = ecr.quote_id ? String(ecr.quote_id) : ''
  if (quoteId && (!customerEmail || !customerName || !bookingRef)) {
    const { data: q } = await supabase
      .from('quotes')
      .select('email, full_name, quote_ref')
      .eq('id', quoteId)
      .maybeSingle()
    if (q) {
      if (!customerEmail) customerEmail = String(q.email || '').trim()
      if (!customerName) customerName = String(q.full_name || '').trim()
      if (!bookingRef) bookingRef = String(q.quote_ref || '').trim()
    }
  }
  return { customerEmail, customerName, bookingRef }
}

export function resolveApprovedAmount(ecr: ExtraChargeRow, bodyAmount?: unknown): number {
  const fromBody = bodyAmount != null ? Number(bodyAmount) : NaN
  if (Number.isFinite(fromBody) && fromBody > 0) return fromBody
  const approved = Number(ecr.approved_amount)
  if (Number.isFinite(approved) && approved > 0) return approved
  const estimated = Number(ecr.estimated_amount)
  if (Number.isFinite(estimated) && estimated > 0) return estimated
  return 0
}

export type ProcessExtraChargeResult = {
  ok: boolean
  error?: string
  already_created?: boolean
  payment_intent_id?: string
  stripe_payment_link?: string | null
  approved_amount?: number
}

export async function processExtraChargePayment(opts: {
  supabase: SupabaseClient
  stripeKey: string
  siteUrl: string
  requestId: string
  body?: Record<string, unknown>
}): Promise<ProcessExtraChargeResult> {
  const { supabase, stripeKey, siteUrl, requestId } = opts
  const body = opts.body ?? {}

  const { data: ecr, error: fetchErr } = await supabase
    .from('extra_charge_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle()

  if (fetchErr || !ecr) {
    return { ok: false, error: 'Extra charge request not found' }
  }

  const row = ecr as ExtraChargeRow

  if (String(row.status) === 'paid') {
    return { ok: false, error: 'This extra charge has already been paid.' }
  }

  if (String(row.status) === 'pending_customer_payment' && row.stripe_payment_intent_id) {
    return {
      ok: true,
      already_created: true,
      payment_intent_id: String(row.stripe_payment_intent_id),
      stripe_payment_link: row.stripe_payment_link != null ? String(row.stripe_payment_link) : null,
    }
  }

  const approvedAmount = resolveApprovedAmount(row, body.approved_amount ?? body.approvedAmount)
  if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
    return { ok: false, error: 'No valid amount (estimated or approved) for this request.' }
  }

  const enriched = await enrichExtraChargeFromQuote(supabase, row)
  const customerEmail = String(
    body.customer_email || body.customerEmail || enriched.customerEmail || '',
  ).trim()
  const customerName = String(
    body.customer_name || body.customerName || enriched.customerName || '',
  ).trim()
  const bookingRef = String(
    body.booking_reference || body.bookingReference || enriched.bookingRef || '',
  ).trim()

  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return {
      ok: false,
      error: 'Customer email missing on booking. Add email on quote in admin, then retry.',
    }
  }

  const currency = String(row.currency || 'GBP').toLowerCase()
  const unitAmount = Math.round(approvedAmount * 100)
  if (unitAmount < 30) {
    return { ok: false, error: 'Amount too low for card payment (minimum £0.30)' }
  }

  const stripe = new Stripe(stripeKey, {
    httpClient: Stripe.createFetchHttpClient(),
  })

  const metadata: Record<string, string> = {
    extra_charge_request_id: requestId,
    job_id: row.job_id ? String(row.job_id) : '',
    quote_id: row.quote_id ? String(row.quote_id) : '',
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
      receipt_email: customerEmail,
      metadata,
      description: `Extra charges — booking ${bookingRef || requestId}`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Stripe error: ${msg}` }
  }

  let stripePaymentLink = ''
  const addedItemsNormalized = normalizeAddedItemsForEmail(row.added_items)
  const itemsSummary = addedItemsNormalized
    .map((i) => `${i.name} ×${i.quantity ?? 1}`)
    .join(', ')
    .slice(0, 500)

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_intent_data: { metadata },
      line_items: [{
        price_data: {
          currency,
          unit_amount: unitAmount,
          product_data: {
            name: `Additional charges — ${bookingRef || 'Your move'}`,
            description: itemsSummary || 'Extra items added during your move',
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
    console.error('[extraChargePayment] Checkout session error:', e)
  }

  const { error: updateErr } = await supabase
    .from('extra_charge_requests')
    .update({
      status: 'pending_customer_payment',
      approved_amount: approvedAmount,
      stripe_payment_intent_id: intent.id,
      stripe_payment_link: stripePaymentLink || null,
      customer_email: customerEmail,
      customer_name: customerName,
      booking_reference: bookingRef,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updateErr) {
    console.error('[extraChargePayment] DB update error:', updateErr)
  }

  return {
    ok: true,
    payment_intent_id: intent.id,
    stripe_payment_link: stripePaymentLink || null,
    approved_amount: approvedAmount,
  }
}
