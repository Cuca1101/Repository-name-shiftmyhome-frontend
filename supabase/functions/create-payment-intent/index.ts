import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { validateStripeSecretKey } from '../_shared/stripeMode.ts'
import { formatGbpLabel, validateDepositAmountGbp } from '../_shared/stripeDepositAmount.ts'

/**
 * ShiftMyHome — creates a Stripe PaymentIntent for embedded Payment Element.
 *
 * Secrets (Supabase Dashboard → Edge Functions → Secrets): STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Frontend env only: VITE_STRIPE_PUBLISHABLE_KEY (pk_test_… / pk_live_…)
 *
 * Test keys: sk_test_… | Live later: sk_live_… (rotate secrets only; never expose to frontend)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LEAD_KEYS = new Set([
  'quote_ref',
  'full_name',
  'phone',
  'email',
  'pickup_address',
  'delivery_address',
  'move_date',
  'service',
  'service_type',
  'arrival_window',
  'distance_miles',
  'details',
  'pricing',
  'inventory_text',
  'inventory',
  'message',
  'status',
  'crew_size',
  'vehicle_size',
  'estimated_total',
  'remaining_balance',
])

const STRIP_KEYS = new Set([
  'id',
  'created_at',
  'payment_status',
  'amount_paid',
  'stripe_session_id',
  'stripe_payment_intent_id',
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

function stripeMetadata(entries: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(entries)) {
    const trimmed = value.trim()
    if (!trimmed) continue
    out[key] = trimmed.slice(0, 500)
  }
  return out
}

async function persistQuotePaymentLink(params: {
  supabase: ReturnType<typeof createClient>
  quoteId: string
  quoteRef: string
  leadRef: string
  paymentIntentId: string
  paymentType: 'deposit' | 'full'
  checkoutSessionId: string | null
}) {
  const { supabase, quoteId, quoteRef, leadRef, paymentIntentId, paymentType, checkoutSessionId } = params
  const refs = [quoteRef, leadRef].filter(Boolean)
  const updatePayload: Record<string, unknown> = {
    stripe_payment_intent_id: paymentIntentId,
    payment_type: paymentType,
    payment_status: paymentType === 'deposit' ? 'pending_deposit_verification' : 'pending_payment_verification',
  }
  if (checkoutSessionId) {
    updatePayload.stripe_session_id = checkoutSessionId
    updatePayload.stripe_checkout_session_id = checkoutSessionId
  }

  let rowsUpdated = 0
  let dbUpdateSuccess = false
  let updateError = ''

  const updateById = async () => {
    if (!(quoteId && uuidLike(quoteId))) return
    const { data, error } = await supabase.from('quotes').update(updatePayload).eq('id', quoteId).select('id')
    if (error) {
      updateError = error.message || String(error)
      return
    }
    rowsUpdated += Array.isArray(data) ? data.length : 0
    if (rowsUpdated > 0) dbUpdateSuccess = true
  }

  const updateByRef = async (ref: string) => {
    const { data, error } = await supabase.from('quotes').update(updatePayload).eq('quote_ref', ref).select('id')
    if (error) {
      updateError = error.message || String(error)
      return
    }
    rowsUpdated += Array.isArray(data) ? data.length : 0
    if (rowsUpdated > 0) dbUpdateSuccess = true
  }

  await updateById()
  for (const ref of refs) {
    if (!dbUpdateSuccess) await updateByRef(ref)
  }

  console.log('[create-payment-intent] quote payment persistence', {
    quote_ref: quoteRef || leadRef || null,
    payment_intent_id: paymentIntentId,
    db_update_success: dbUpdateSuccess,
    rows_updated: rowsUpdated,
    quote_id: quoteId || null,
    error: updateError || null,
  })

  return { dbUpdateSuccess, rowsUpdated, updateError }
}

function parsePoundsFromText(text: string, patterns: RegExp[]) {
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) {
      const n = Number(m[1].replace(/,/g, ''))
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function parseInventoryRows(inventoryText: string, inventoryRaw?: unknown) {
  const rows: Array<{ item_name: string; quantity: number; volume_m3: number | null; weight_category: string | null; notes: string | null }> = []
  const normalizeSegments = (text: string) =>
    String(text || '')
      .split(/[\r\n]+|•/g)
      .map((s) => s.trim().replace(/^[-*·•]\s*/, ''))
      .filter((s) => s && !/^inventory[:\s]*$/i.test(s))

  const parseSegment = (segment: string) => {
    const qtyMatch = segment.match(/(?:×|x)\s*(\d+)/i) || segment.match(/^(\d+)\s*(?:×|x)\s*/i)
    const qty = qtyMatch?.[1] ? Number(qtyMatch[1]) : 1
    const sizeMatch = segment.match(/\b(large|medium|small)\b/i)
    const heavyMatch = /\bheavy\b/i.test(segment)
    const parenContent = segment.match(/\(([^)]*)\)/g)?.join(' ') || ''
    const notesRaw = [sizeMatch?.[1], heavyMatch ? 'Heavy' : '', parenContent.replace(/[^)]*m[³3][^)]*/gi, '').replace(/[()]/g, '').trim()]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
    const name = segment
      .replace(/(?:×|x)\s*\d+/gi, '')
      .replace(/^\d+\s*(?:×|x)\s*/i, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
    if (!name) return null
    return {
      item_name: name,
      quantity: Number.isFinite(qty) && qty > 0 ? Math.round(qty) : 1,
      volume_m3: null,
      weight_category: heavyMatch ? 'heavy' : null,
      notes: notesRaw.join(' | ') || null,
    }
  }

  if (Array.isArray(inventoryRaw)) {
    for (const item of inventoryRaw as Array<Record<string, unknown>>) {
      const name = String(item.item_name ?? item.name ?? '').trim()
      if (!name) continue
      const q = Number(item.quantity ?? item.qty ?? 1)
      const v = Number(item.line_volume_m3 ?? item.volume_m3 ?? item.volume ?? NaN)
      rows.push({
        item_name: name,
        quantity: Number.isFinite(q) && q > 0 ? Math.round(q) : 1,
        volume_m3: Number.isFinite(v) ? v : null,
        weight_category: item.weight_type ? String(item.weight_type) : null,
        notes: [String(item.size_category ?? '').trim(), String(item.notes ?? '').trim()].filter(Boolean).join(' | ') || null,
      })
    }
  }
  const lines = normalizeSegments(inventoryText)
  for (const line of lines) {
    const parsed = parseSegment(line)
    if (parsed) rows.push(parsed)
  }
  const dedup = new Map<string, (typeof rows)[number]>()
  for (const r of rows) {
    const key = `${r.item_name}|${r.quantity}|${r.notes ?? ''}|${r.weight_category ?? ''}`
    if (!dedup.has(key)) dedup.set(key, r)
  }
  return [...dedup.values()]
}

async function syncStructuredQuoteData(
  supabase: ReturnType<typeof createClient>,
  quoteId: string,
  lead: Record<string, unknown> | null,
  paymentType: 'deposit' | 'full',
  amountPaid: number,
) {
  if (!lead) return
  const details = String(lead.details ?? '')
  const serviceType = String(lead.service ?? lead.service_type ?? '').trim() || null
  const arrivalWindow = String(lead.arrival_window ?? '').trim() || null
  const crewCount = Number(lead.crew_size ?? NaN)
  const crew = Number.isFinite(crewCount) ? crewCount : null
  const vehicleSize = String(lead.vehicle_size ?? '').trim() || null
  const pricingText = String(lead.pricing ?? '')
  const totalPrice =
    parsePoundsFromText(pricingText, [/Estimated total[^0-9]*([0-9][0-9,]*\.?[0-9]{0,2})/i, /Total[^0-9]*([0-9][0-9,]*\.?[0-9]{0,2})/i]) ??
    null
  const remaining = paymentType === 'deposit' && totalPrice != null ? Math.max(0, totalPrice - amountPaid) : 0

  await supabase
    .from('quotes')
    .update({
      service_type: serviceType,
      estimated_total: totalPrice,
      remaining_balance: remaining,
    })
    .eq('id', quoteId)

  const pickupAddress = String(lead.pickup_address ?? '').trim()
  const deliveryAddress = String(lead.delivery_address ?? '').trim()
  const commonContact = {
    contact_name: String(lead.full_name ?? '').trim() || null,
    contact_phone: String(lead.phone ?? '').trim() || null,
    date_time_window: arrivalWindow,
  }

  const upsertStop = async (stopType: 'pickup' | 'delivery', address: string) => {
    await supabase
      .from('quote_stops')
      .upsert(
        {
          quote_id: quoteId,
          stop_type: stopType,
          ...commonContact,
          address_line_1: address || null,
          floor: (() => {
            const m = details.match(new RegExp(`${stopType === 'pickup' ? 'Pickup' : 'Delivery'} floor:\\s*(.+)`, 'i'))
            return m?.[1]?.trim() || null
          })(),
          lift_available: details.toLowerCase().includes('lift: yes') ? true : details.toLowerCase().includes('lift: no') ? false : null,
          parking_type: (() => {
            const m = details.match(/Parking \/ vehicle access:\s*(.+)/i)
            return m?.[1]?.trim() || null
          })(),
          walking_distance: (() => {
            const m = details.match(/Walking distance \(van to door\):\s*(.+)/i)
            return m?.[1]?.trim() || null
          })(),
          access_notes: details || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'quote_id,stop_type' },
      )
  }
  await upsertStop('pickup', pickupAddress)
  await upsertStop('delivery', deliveryAddress)

  const inventoryRows = parseInventoryRows(String(lead.inventory_text ?? ''), lead.inventory)
  await supabase.from('quote_inventory_items').delete().eq('quote_id', quoteId)
  if (inventoryRows.length) {
    await supabase.from('quote_inventory_items').insert(
      inventoryRows.map((r) => ({
        quote_id: quoteId,
        ...r,
      })),
    )
  }

  const specialInstruction = (() => {
    const m = details.match(/Special instructions:\s*(.+)/i)
    return m?.[1]?.trim() || ''
  })()
  await supabase.from('quote_requirements').delete().eq('quote_id', quoteId)
  if (specialInstruction) {
    await supabase.from('quote_requirements').insert({
      quote_id: quoteId,
      requirement_type: 'special_instruction',
      description: specialInstruction,
    })
  }

  await supabase
    .from('quote_pricing')
    .upsert(
      {
        quote_id: quoteId,
        crew_count: crew,
        crew_label: crew ? `${crew} ${crew === 1 ? 'Man' : 'Men'}` : null,
        vehicle_size: vehicleSize,
        deposit_amount: paymentType === 'deposit' ? round2(amountPaid) : 50,
        total_price: totalPrice,
        remaining_balance: remaining,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'quote_id' },
    )
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
  const checkout_session_id = String(body.stripe_checkout_session_id ?? body.stripe_session_id ?? '').trim()
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
  const pricingTextForTotal = cleanLead ? String(cleanLead.pricing ?? '') : ''
  const estimatedTotalFromLead =
    parsePoundsFromText(pricingTextForTotal, [
      /Estimated total[^0-9]*([0-9][0-9,]*\.?[0-9]{0,2})/i,
      /Total[^0-9]*([0-9][0-9,]*\.?[0-9]{0,2})/i,
    ]) ??
    (cleanLead?.estimated_total != null && Number.isFinite(Number(cleanLead.estimated_total))
      ? Number(cleanLead.estimated_total)
      : null)

  if (resolvedPaymentType === 'deposit') {
    const depositCheck = validateDepositAmountGbp(gbp, estimatedTotalFromLead)
    if (!depositCheck.ok) {
      const msg =
        depositCheck.error ||
        (Number.isFinite(gbp)
          ? `Deposit amount must be ${formatGbpLabel(gbp)}`
          : 'Invalid deposit amount')
      return jsonResponse({ error: msg }, 400)
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
    const ref = String(merged.quote_ref ?? '').trim()
    if (!ref) {
      return jsonResponse({ error: 'quote_lead.quote_ref is required' }, 400)
    }
    let saved: { id: string } | null = null
    let saveErr: { message?: string } | null = null
    if (existing?.id) {
      const res = await supabase.from('quotes').update(merged).eq('id', existing.id).select('id').single()
      saved = res.data
      saveErr = res.error
    } else {
      const res = await supabase.from('quotes').insert(merged).select('id').single()
      saved = res.data
      saveErr = res.error
    }
    if (saveErr || !saved?.id) {
      return jsonResponse({ error: saveErr?.message ?? 'Could not save quote lead' }, 400)
    }
    resolvedQuoteId = String(saved.id)
  }

  if (resolvedQuoteId && uuidLike(resolvedQuoteId)) {
    await syncStructuredQuoteData(supabase, resolvedQuoteId, merged, resolvedPaymentType, gbp)
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

  try {
    const intent = await stripe.paymentIntents.create({
      amount: unitAmount,
      currency: 'gbp',
      automatic_payment_methods: { enabled: true },
      receipt_email: customer_email || undefined,
      metadata,
      description:
        resolvedPaymentType === 'deposit'
          ? `${formatGbpLabel(gbp)} deposit — quote ${quote_ref}`
          : `Full payment — quote ${quote_ref}`,
    })

    if (!intent.client_secret) {
      return jsonResponse({ error: 'Stripe did not return client_secret' }, 500)
    }

    if (booking_id && uuidLike(booking_id)) {
      const { error: jobErr } = await supabase
        .from('jobs')
        .update({ stripe_payment_intent_id: intent.id })
        .eq('id', booking_id)
      if (jobErr) console.error('[create-payment-intent] jobs PI update:', jobErr.message)
    }
    await persistQuotePaymentLink({
      supabase,
      quoteId: resolvedQuoteId || quote_id,
      quoteRef: quote_ref,
      leadRef,
      paymentIntentId: intent.id,
      paymentType: resolvedPaymentType,
      checkoutSessionId: checkout_session_id || null,
    })

    return jsonResponse({
      client_secret: intent.client_secret,
      payment_intent_id: intent.id,
      quote_id: resolvedQuoteId || quote_id || null,
      booking_id: booking_id || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return jsonResponse({ error: msg }, 500)
  }
})
