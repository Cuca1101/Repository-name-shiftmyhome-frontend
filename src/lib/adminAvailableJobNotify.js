/**
 * Fire-and-forget admin email when a paid job enters Available Jobs.
 * Server enforces eligibility + idempotency (admin_notified_at).
 */

import { isSupabaseConfigured, supabase } from './supabase'

function functionsInvokeHeaders() {
  const raw = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim().replace(/^["']|["']$/g, '')
  if (raw.startsWith('eyJ')) {
    return { Authorization: `Bearer ${raw}` }
  }
  return undefined
}

/**
 * @param {{ paymentIntentId?: string, quoteId?: string }} params
 * @returns {Promise<Record<string, unknown>>}
 */
export async function notifyAdminAvailableJobAfterPayment(params = {}) {
  const paymentIntentId = String(params.paymentIntentId || '').trim()
  const quoteId = String(params.quoteId || '').trim()

  if (!paymentIntentId && !quoteId) {
    return { ok: false, skipped: true, reason: 'missing_ids' }
  }

  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, skipped: true, reason: 'supabase_not_configured' }
  }

  const body = {}
  if (paymentIntentId) body.payment_intent_id = paymentIntentId
  if (quoteId) body.quote_id = quoteId

  const invokeOpts = { body }
  const fnHeaders = functionsInvokeHeaders()
  if (fnHeaders) invokeOpts.headers = fnHeaders

  try {
    const { data, error } = await supabase.functions.invoke('notify-admin-available-job', invokeOpts)
    if (error) {
      console.warn('[admin-available-job] invoke error', error.message)
      return { ok: false, error: error.message }
    }
    return data && typeof data === 'object' ? data : { ok: true }
  } catch (err) {
    console.warn('[admin-available-job] invoke failed', err)
    return { ok: false, error: err?.message || 'invoke_failed' }
  }
}

/**
 * Non-blocking wrapper — never throws to payment / quote flows.
 * @param {{ paymentIntentId?: string, quoteId?: string }} params
 */
export function scheduleAdminAvailableJobNotification(params = {}) {
  void notifyAdminAvailableJobAfterPayment(params).catch(() => {})
}
