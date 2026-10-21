// deno-lint-ignore-file no-explicit-any
/**
 * Server-side price for an accepted customer offer.
 * The charged amount always comes from customer_offers, never from the browser.
 */

const PAYABLE = new Set(['accepted', 'counter_accepted'])

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function money(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return round2(n)
}

export function isoWeekday(isoDate: string) {
  const match = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const dt = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(dt.getTime())) return null
  return dt.getDay()
}

function slotCapacity(settings: Record<string, unknown>, isoDate: string) {
  const day = isoWeekday(isoDate)
  if (day == null) return null
  const raw = settings.dailyJobSlots
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const slots = raw as Record<string, unknown>
  const value = slots[day] ?? slots[String(day)]
  if (value == null || value === '') return null
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

function rewriteEstimatedTotal(pricing: string, agreed: number) {
  const label = `Estimated total: £${agreed.toFixed(2)}`
  const text = String(pricing || '')
  if (/Estimated total/i.test(text)) {
    return text.replace(/Estimated total\s*:\s*£?\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?/i, label)
  }
  return text ? `${text}\n${label}` : label
}

async function expireOffer(supabase: any, row: Record<string, unknown>) {
  const history = Array.isArray(row.history) ? [...row.history] : []
  history.push({
    type: 'expired',
    status: 'expired',
    amount: money(row.agreed_amount ?? row.counter_amount ?? row.proposed_amount),
    actor: 'system',
    actor_label: 'System',
    at: new Date().toISOString(),
  })
  await supabase
    .from('customer_offers')
    .update({ status: 'expired', history, updated_at: new Date().toISOString() })
    .eq('id', row.id)
    .in('status', ['pending', 'accepted', 'countered', 'counter_accepted'])
}

export async function refreshLeadOfferFlag(supabase: any, leadId: string | null) {
  if (!leadId) return
  const { count } = await supabase
    .from('customer_offers')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', leadId)
    .in('status', ['pending', 'countered'])
    .gt('expires_at', new Date().toISOString())
  await supabase
    .from('customer_leads')
    .update({ pending_offer: (count || 0) > 0, updated_at: new Date().toISOString() })
    .eq('id', leadId)
}

/**
 * Load a payable offer and the amount Stripe must charge.
 * Full payment uses the stored agreed total. Deposit uses pricing settings.
 */
export async function prepareCustomerOfferCheckout(
  supabase: any,
  opts: { token: string; paymentType: 'deposit' | 'full' },
): Promise<
  | {
      ok: true
      offerId: string
      leadId: string | null
      quoteRef: string
      agreed: number
      chargeGbp: number
      paymentType: 'deposit' | 'full'
      lead: Record<string, unknown>
      packageId: string
      packageFee: number
      volumeM3: number
      activePaymentIntentId: string
      customerEmail: string
      customerName: string
      serviceType: string
    }
  | { ok: false; status: number; error: string }
> {
  const token = String(opts.token || '').trim()
  if (token.length < 20) return { ok: false, status: 404, error: 'This offer link is not valid.' }

  const { data, error } = await supabase
    .from('customer_offers')
    .select('*')
    .eq('view_token', token)
    .maybeSingle()
  if (error) return { ok: false, status: 503, error: 'Could not load this offer. Please try again.' }
  const row = data as Record<string, unknown> | null
  if (!row) return { ok: false, status: 404, error: 'This offer link is not valid.' }

  if (row.booked_at || row.status === 'booked') {
    return { ok: false, status: 409, error: 'This offer has already been booked.' }
  }

  const expiresAt = Date.parse(String(row.expires_at || ''))
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    if (row.status !== 'expired') await expireOffer(supabase, row)
    return { ok: false, status: 409, error: 'This offer has expired. Please ask us for a new quote.' }
  }

  if (!PAYABLE.has(String(row.status || ''))) {
    return { ok: false, status: 409, error: 'This offer is not ready for payment yet.' }
  }

  const agreed = money(row.agreed_amount)
  if (agreed == null || agreed <= 0) {
    return { ok: false, status: 409, error: 'This offer does not have an agreed total yet.' }
  }

  const snapshot = row.move_snapshot && typeof row.move_snapshot === 'object'
    ? (row.move_snapshot as Record<string, unknown>)
    : {}
  const identity = snapshot.identity && typeof snapshot.identity === 'object'
    ? (snapshot.identity as Record<string, unknown>)
    : {}
  const moveDate = String(identity.moveDate || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(moveDate)) {
    return { ok: false, status: 409, error: 'This offer is missing a move date. Please ask us to review it again.' }
  }

  const { data: pricingRow, error: pricingErr } = await supabase
    .from('pricing_settings')
    .select('data')
    .eq('id', 1)
    .maybeSingle()
  if (pricingErr) return { ok: false, status: 503, error: 'Could not check availability. Please try again.' }
  const settings =
    pricingRow?.data && typeof pricingRow.data === 'object' && !Array.isArray(pricingRow.data)
      ? (pricingRow.data as Record<string, unknown>)
      : {}

  const capacity = slotCapacity(settings, moveDate)
  if (capacity != null) {
    const { data: counts, error: slotErr } = await supabase.rpc('public_quote_day_slot_counts', {
      p_from: moveDate,
      p_to: moveDate,
    })
    if (slotErr) return { ok: false, status: 503, error: 'Could not check availability. Please try again.' }
    const booked = Math.max(
      0,
      Number((counts || []).find((item: { move_date?: string }) => String(item.move_date || '').slice(0, 10) === moveDate)?.booked) || 0,
    )
    if (booked >= capacity) {
      return {
        ok: false,
        status: 409,
        error: 'That moving date is now fully booked. The agreed price cannot be used for a different date — please send a new offer.',
      }
    }
  }

  const quoteRef = String(row.quote_ref || '').trim()
  if (quoteRef) {
    const { data: existing } = await supabase
      .from('quotes')
      .select('payment_status')
      .eq('quote_ref', quoteRef)
      .maybeSingle()
    const paid = String(existing?.payment_status || '')
    if (paid === 'paid' || (paid === 'deposit_paid' && opts.paymentType === 'deposit')) {
      return { ok: false, status: 409, error: 'A payment has already been taken for this quote.' }
    }
  }

  const depositRaw = Number(settings.depositAmount)
  const deposit = Number.isFinite(depositRaw) && depositRaw > 0 ? round2(depositRaw) : 0
  let paymentType = opts.paymentType
  let chargeGbp = agreed
  if (paymentType === 'deposit') {
    if (!(deposit > 0) || deposit >= agreed - 0.009) {
      return {
        ok: false,
        status: 400,
        error: 'A deposit is not available for this agreed total. Please pay the full agreed amount.',
      }
    }
    chargeGbp = deposit
  }

  const storedLead =
    row.quote_lead && typeof row.quote_lead === 'object' && !Array.isArray(row.quote_lead)
      ? { ...(row.quote_lead as Record<string, unknown>) }
      : {}
  const original = money(row.original_total)
  storedLead.quote_ref = quoteRef || storedLead.quote_ref
  storedLead.estimated_total = agreed
  storedLead.pricing = rewriteEstimatedTotal(String(storedLead.pricing || ''), agreed)
  storedLead.agreed_price = agreed
  if (original != null) storedLead.calculated_total = original
  storedLead.price_override_reason = 'Accepted customer offer'
  storedLead.price_override_at = new Date().toISOString()
  storedLead.remaining_balance = paymentType === 'deposit' ? round2(Math.max(0, agreed - chargeGbp)) : 0
  storedLead.move_date = moveDate
  if (!storedLead.status) storedLead.status = 'New'

  const packageId = String(identity.packageTier || 'standard')
  const packageFee = money(identity.packageFee) || 0
  const volumeM3 = money(identity.volumeM3) || 0

  return {
    ok: true,
    offerId: String(row.id),
    leadId: row.lead_id ? String(row.lead_id) : null,
    quoteRef,
    agreed,
    chargeGbp,
    paymentType,
    lead: storedLead,
    packageId,
    packageFee,
    volumeM3,
    activePaymentIntentId: String(row.active_payment_intent_id || ''),
    customerEmail: String(row.customer_email || storedLead.email || '').trim().toLowerCase(),
    customerName: String(row.customer_name || storedLead.full_name || '').trim(),
    serviceType: String(storedLead.service_type || storedLead.service || '').trim(),
  }
}

export async function markCustomerOfferBooked(supabase: any, offerId: string) {
  const id = String(offerId || '').trim()
  if (!id) return
  const { data } = await supabase.from('customer_offers').select('id, lead_id, history, status, booked_at').eq('id', id).maybeSingle()
  if (!data || data.booked_at) return
  const history = Array.isArray(data.history) ? [...data.history] : []
  history.push({
    type: 'booked',
    status: 'booked',
    actor: 'customer',
    actor_label: 'Customer',
    at: new Date().toISOString(),
  })
  await supabase
    .from('customer_offers')
    .update({
      status: 'booked',
      booked_at: new Date().toISOString(),
      history,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  await refreshLeadOfferFlag(supabase, data.lead_id ? String(data.lead_id) : null)
}
