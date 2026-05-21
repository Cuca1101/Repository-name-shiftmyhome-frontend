/**
 * Admin-only test send for Available Jobs email notifications (Resend via Edge Function).
 */

import { isSupabaseConfigured, supabase } from './supabase'

/**
 * @param {{ message?: string, context?: unknown }} error
 * @param {string} [fallback]
 */
async function detailFromFunctionsInvokeError(error, fallback = 'Request failed.') {
  let detail = error?.message || fallback
  const ctx = error?.context
  if (!ctx) return detail || fallback
  try {
    if (typeof ctx.json === 'function') {
      const j = await ctx.json()
      if (j?.error != null) return String(j.error)
      if (j?.message != null) return String(j.message)
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof Response !== 'undefined' && ctx instanceof Response) {
      const j = await ctx.clone().json()
      if (j?.error != null) return String(j.error)
      if (j?.message != null) return String(j.message)
    }
  } catch {
    /* ignore */
  }
  return detail || fallback
}

/**
 * Sends sample admin job notification email. Requires admin Supabase session.
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function sendAdminAvailableJobTestEmail() {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, message: 'Supabase is not configured.' }
  }

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
  if (sessionErr || !sessionData?.session?.access_token) {
    return { ok: false, message: 'Admin login required.' }
  }

  const { data, error } = await supabase.functions.invoke('send-admin-available-job-test-email', {
    body: {},
  })

  if (error) {
    const detail = await detailFromFunctionsInvokeError(error, 'Could not send test email.')
    return { ok: false, message: detail }
  }

  if (data?.ok === true && data?.email_sent !== false) {
    return { ok: true, message: 'Test email sent' }
  }

  const errMsg =
    (typeof data?.error === 'string' && data.error) ||
    (data?.skipped ? 'Test email was skipped.' : null) ||
    'Could not send test email.'
  return { ok: false, message: errMsg }
}
