/**
 * Parse Supabase Edge Function invoke errors into user-facing messages.
 * @param {{ message?: string, context?: unknown, name?: string }} error
 * @param {string} [fallback]
 */
export async function detailFromFunctionsInvokeError(error, fallback = 'Request failed.') {
  const generic = 'Failed to send a request to the Edge Function'
  let detail = error?.message || fallback

  if (detail === generic || detail.includes('Failed to send a request')) {
    detail = fallback
  }

  const ctx = error?.context
  if (!ctx) {
    if (error?.message && error.message !== generic) return error.message
    return detail || fallback
  }

  try {
    if (typeof ctx.json === 'function') {
      const j = await ctx.json()
      if (j?.message != null) return String(j.message)
      if (j?.error != null) return String(j.error)
      if (j?.ok === false && j?.message) return String(j.message)
    }
  } catch {
    /* ignore */
  }

  try {
    if (typeof Response !== 'undefined' && ctx instanceof Response) {
      const status = ctx.status
      const j = await ctx.clone().json().catch(() => null)
      if (j?.message != null) return String(j.message)
      if (j?.error != null) return String(j.error)
      if (status === 404) {
        return 'Edge Function not found — deploy admin-create-driver in Supabase (Dashboard → Edge Functions).'
      }
      if (status === 401) return 'Admin sign-in required or session expired.'
      if (status === 403) return j?.message || 'You do not have permission for this action.'
      if (status >= 500) return j?.message || `Server error (${status}). Check Edge Function logs.`
      return j?.message || `Request failed (HTTP ${status}).`
    }
  } catch {
    /* ignore */
  }

  return detail || fallback
}

/**
 * Invoke options for admin Edge Functions — uses signed-in admin JWT (not anon-only).
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {Record<string, unknown>} body
 */
export async function buildAdminFunctionInvokeOpts(client, body) {
  const { data } = await client.auth.getSession()
  const token = data?.session?.access_token
  if (!token) {
    throw new Error('Admin sign-in required — sign in again and retry.')
  }
  return {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
}
