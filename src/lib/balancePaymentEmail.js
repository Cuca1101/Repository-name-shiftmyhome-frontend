import { supabase, isSupabaseConfigured } from './supabase'

const FN = 'send-balance-payment-email'

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

/**
 * Amount still due on the booking after the deposit. Ignores extra-charge adjustments.
 * @param {Record<string, unknown> | null | undefined} quote
 */
export function depositBalanceDue(quote) {
  const q = quote && typeof quote === 'object' ? quote : {}
  const status = String(q.payment_status || '').toLowerCase()
  const paidRaw = Number(q.amount_paid)
  const paid = Number.isFinite(paidRaw) && paidRaw > 0 ? round2(paidRaw) : 0
  const agreed = Number(q.agreed_price)
  const estimated = Number(q.estimated_total)
  const storedRemaining = Number(q.remaining_balance)
  const migrated =
    /^Migrated from remaining_balance/i.test(String(q.price_override_reason || '')) &&
    Number.isFinite(storedRemaining) &&
    Number.isFinite(agreed) &&
    Math.abs(agreed - storedRemaining) < 0.02

  let total = null
  if (migrated && Number.isFinite(storedRemaining)) total = round2(paid + Math.max(0, storedRemaining))
  else if (Number.isFinite(agreed) && agreed > paid + 0.009) total = round2(agreed)
  else if (Number.isFinite(estimated) && estimated > paid + 0.009) total = round2(estimated)
  else if (Number.isFinite(storedRemaining) && storedRemaining >= 0.3) total = round2(paid + storedRemaining)

  const remaining = total == null ? null : round2(Math.max(0, total - paid))
  const cancelled =
    Boolean(q.cancelled_at) ||
    String(q.operational_status || '').toLowerCase() === 'cancelled' ||
    String(q.status || '').toLowerCase() === 'cancelled'
  const fullyPaid = status === 'paid' && (remaining == null || remaining < 0.3)
  const email = String(q.email || '').trim()
  const show =
    !cancelled &&
    !fullyPaid &&
    remaining != null &&
    remaining >= 0.3 &&
    email.includes('@') &&
    !email.toLowerCase().endsWith('@shiftmyhome.local')

  return { show, total, paid, remaining, email }
}

/**
 * Email the customer a link to pay the remaining balance.
 * @param {string} quoteId
 */
export async function sendRemainingBalanceEmail(quoteId) {
  const base = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '')
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim().replace(/^["']|["']$/g, '')
  if (!base || !isSupabaseConfigured || !supabase) throw new Error('Supabase is not configured.')
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) throw new Error('Admin sign-in required or session expired.')
  const res = await fetch(`${base}/functions/v1/${FN}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ quoteId }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.message || 'The email could not be sent.')
  }
  return json
}
