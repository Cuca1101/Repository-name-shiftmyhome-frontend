import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { sendResendEmail } from './resendClient.ts'

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
}

function gbp(n: number) {
  return `£${n.toFixed(2)}`
}

type QuotePayRow = {
  id: string
  quote_ref: string | null
  email: string | null
  full_name: string | null
  amount_paid: number | null
  agreed_price: number | null
  estimated_total: number | null
  remaining_balance: number | null
  payment_status: string | null
  price_override_reason: string | null
}

/**
 * Booking total the customer agreed. A migrated row stored the balance in agreed_price.
 */
export function balanceChargeForQuote(row: {
  amount_paid?: unknown
  agreed_price?: unknown
  estimated_total?: unknown
  remaining_balance?: unknown
  price_override_reason?: unknown
}) {
  const paid = Math.max(0, Number(row.amount_paid) || 0)
  const agreed = Number(row.agreed_price)
  const estimated = Number(row.estimated_total)
  const storedRemaining = Number(row.remaining_balance)
  const migrated =
    /^Migrated from remaining_balance/i.test(asText(row.price_override_reason)) &&
    Number.isFinite(storedRemaining) &&
    Number.isFinite(agreed) &&
    Math.abs(agreed - storedRemaining) < 0.02

  let total: number | null = null
  if (migrated && Number.isFinite(storedRemaining)) {
    total = round2(paid + Math.max(0, storedRemaining))
  } else if (Number.isFinite(agreed) && agreed > paid + 0.009) {
    total = round2(agreed)
  } else if (Number.isFinite(estimated) && estimated > paid + 0.009) {
    total = round2(estimated)
  } else if (Number.isFinite(storedRemaining) && storedRemaining >= 0.3) {
    total = round2(paid + storedRemaining)
  }

  if (total == null) return { total: null, paid: round2(paid), remaining: null }
  const remaining = round2(Math.max(0, total - paid))
  return { total, paid: round2(paid), remaining }
}

async function alreadyLogged(supabase: SupabaseClient, paymentIntentId: string) {
  const { data } = await supabase
    .from('admin_activity_logs')
    .select('id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .eq('event_type', 'balance_payment_received')
    .limit(1)
  return Array.isArray(data) && data.length > 0
}

async function sendBalanceReceipt(
  row: QuotePayRow,
  received: number,
  remaining: number,
  paymentIntentId: string,
) {
  const to = asText(row.email).toLowerCase()
  if (!to.includes('@')) return
  const ref = asText(row.quote_ref) || 'your booking'
  const name = asText(row.full_name) || 'there'
  const settled = remaining <= 0.009
  const subject = `[ShiftMyHome] Remaining balance received — ${ref}`
  const text = settled
    ? `Hi ${name}, we received ${gbp(received)} for ${ref}. The booking is now paid in full.`
    : `Hi ${name}, we received ${gbp(received)} for ${ref}. Remaining balance: ${gbp(remaining)}.`
  const html = `<p>Hi ${name},</p><p>We received <strong>${gbp(received)}</strong> for booking <strong>${ref}</strong>.</p><p>${
    settled ? 'This booking is now paid in full.' : `Remaining balance: <strong>${gbp(remaining)}</strong>.`
  }</p><p>ShiftMyHome</p>`
  await sendResendEmail({
    to,
    subject,
    html,
    text,
    idempotencyKey: `balance-receipt-${paymentIntentId}`,
    logTag: 'balance-payment-receipt',
  })
}

/**
 * Add a remaining-balance card payment on top of the deposit.
 * Does not replace amount_paid, the original payment time, or the deposit payment id.
 */
export async function applyBalancePayment(
  supabase: SupabaseClient,
  input: { quoteId?: string; quoteRef?: string; paymentIntentId: string; amountGbp: number },
): Promise<{ ok: boolean; error?: string; quote_id?: string | null; already?: boolean }> {
  const paymentIntentId = asText(input.paymentIntentId)
  const amountGbp = round2(Math.max(0, Number(input.amountGbp) || 0))
  if (!paymentIntentId || amountGbp < 0.3) {
    return { ok: false, error: 'invalid_balance_payment' }
  }

  const quoteId = asText(input.quoteId)
  const quoteRef = asText(input.quoteRef)
  const select =
    'id, quote_ref, email, full_name, amount_paid, agreed_price, estimated_total, remaining_balance, payment_status, price_override_reason'
  const lookup = supabase.from('quotes').select(select)
  const { data, error } = await (quoteId ? lookup.eq('id', quoteId) : lookup.eq('quote_ref', quoteRef)).maybeSingle()
  if (error || !data?.id) return { ok: false, error: error?.message || 'quote_not_found' }
  const row = data as QuotePayRow

  if (await alreadyLogged(supabase, paymentIntentId)) {
    return { ok: true, already: true, quote_id: row.id }
  }

  const charge = balanceChargeForQuote(row)
  const status = asText(row.payment_status).toLowerCase()
  if (status === 'paid' && (charge.remaining == null || charge.remaining <= 0.009)) {
    return { ok: true, already: true, quote_id: row.id }
  }

  const existingPaid = Math.max(0, Number(row.amount_paid) || 0)
  const cap = charge.total != null ? charge.total : round2(existingPaid + amountGbp)
  const newPaid = round2(Math.min(cap, existingPaid + amountGbp))
  const remaining = round2(Math.max(0, cap - newPaid))
  const patch = {
    amount_paid: newPaid,
    remaining_balance: remaining,
    payment_status: remaining <= 0.009 ? 'paid' : 'deposit_paid',
  }

  let update = supabase.from('quotes').update(patch).eq('id', row.id)
  update = row.amount_paid == null ? update.is('amount_paid', null) : update.eq('amount_paid', row.amount_paid)
  const { data: updated, error: updateError } = await update.select('id')
  if (updateError) return { ok: false, error: updateError.message, quote_id: row.id }
  if (!Array.isArray(updated) || updated.length === 0) {
    if (await alreadyLogged(supabase, paymentIntentId)) {
      return { ok: true, already: true, quote_id: row.id }
    }
    const { data: again } = await supabase.from('quotes').select('amount_paid').eq('id', row.id).maybeSingle()
    const againPaid = Number(again?.amount_paid)
    if (Number.isFinite(againPaid) && againPaid + 0.02 >= newPaid) {
      return { ok: true, already: true, quote_id: row.id }
    }
    return { ok: false, error: 'balance_update_conflict', quote_id: row.id }
  }

  await supabase.from('admin_activity_logs').insert({
    level: 'info',
    event_type: 'balance_payment_received',
    message: `Remaining balance payment of ${gbp(amountGbp)} received. Paid is now ${gbp(newPaid)}.`,
    quote_id: row.id,
    stripe_payment_intent_id: paymentIntentId,
    metadata: {
      quote_ref: row.quote_ref,
      amount_gbp: amountGbp,
      amount_paid: newPaid,
      remaining_balance: remaining,
    },
  })

  try {
    await sendBalanceReceipt(row, amountGbp, remaining, paymentIntentId)
  } catch (e) {
    console.error('[applyBalancePayment] receipt email', e instanceof Error ? e.message : e)
  }

  return { ok: true, quote_id: row.id }
}
