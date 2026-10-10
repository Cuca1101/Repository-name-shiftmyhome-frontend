/**
 * Fire-and-forget FCM to a driver via Edge Function `send-driver-push`.
 * Required for audible alerts when the driver app is backgrounded / screen off.
 */

import { isSupabaseConfigured, supabase } from './supabase'

/**
 * @param {{
 *   driverId: string,
 *   title: string,
 *   body?: string,
 *   type?: string,
 *   quoteId?: string,
 *   quoteRef?: string,
 *   stopKey?: string,
 *   data?: Record<string, string>,
 * }} params
 * @returns {Promise<{ success: boolean, skipped?: boolean, error?: string, messageId?: string }>}
 */
export async function sendDriverPush(params) {
  const driverId = String(params?.driverId || '').trim()
  const title = String(params?.title || '').trim()
  if (!driverId || !title) {
    return { success: false, skipped: true, error: 'missing_driver_or_title' }
  }
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, skipped: true, error: 'supabase_not_configured' }
  }

  const body = {
    driverId,
    title,
    body: String(params.body || ''),
    type: params.type || 'new_job_assigned',
    quoteId: params.quoteId ? String(params.quoteId) : undefined,
    quoteRef: params.quoteRef ? String(params.quoteRef) : undefined,
    stopKey: params.stopKey ? String(params.stopKey) : undefined,
    data: params.data,
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-driver-push', { body })
    if (error) {
      console.warn('[sendDriverPush]', error.message)
      return { success: false, error: error.message }
    }
    const result = data && typeof data === 'object' ? data : null
    if (result?.success === false) {
      console.warn('[sendDriverPush]', result.error || 'failed')
      return { success: false, error: result.error || 'send-driver-push failed' }
    }
    return {
      success: true,
      messageId: result?.messageId != null ? String(result.messageId) : undefined,
    }
  } catch (err) {
    console.warn('[sendDriverPush] invoke failed', err)
    return { success: false, error: err?.message || 'invoke_failed' }
  }
}

/**
 * @param {string} driverId
 * @param {Record<string, unknown>} [quote]
 * @param {{ type?: string }} [opts]
 */
export async function notifyDriverJobAssignedPush(driverId, quote, opts = {}) {
  const quoteRef =
    quote?.quote_ref != null
      ? String(quote.quote_ref)
      : quote?.reference != null
        ? String(quote.reference)
        : ''
  const quoteId = quote?.id != null ? String(quote.id) : ''
  const label = quoteRef || 'a new job'
  return sendDriverPush({
    driverId,
    title: 'New job assigned',
    body: `You have been assigned ${label}. Open ShiftMyHome Driver for details.`,
    type: opts.type || 'new_job_assigned',
    quoteId: quoteId || undefined,
    quoteRef: quoteRef || undefined,
  })
}

/**
 * @param {string} driverId
 * @param {Record<string, unknown>} [quote]
 */
export async function notifyDriverJobRemovedPush(driverId, quote) {
  const quoteRef =
    quote?.quote_ref != null
      ? String(quote.quote_ref)
      : quote?.reference != null
        ? String(quote.reference)
        : ''
  const quoteId = quote?.id != null ? String(quote.id) : ''
  const label = quoteRef || 'a job'
  return sendDriverPush({
    driverId,
    title: 'Job removed',
    body: `${label} is no longer assigned to you.`,
    type: 'job_removed',
    quoteId: quoteId || undefined,
    quoteRef: quoteRef || undefined,
  })
}
