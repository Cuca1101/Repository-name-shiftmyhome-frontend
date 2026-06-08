import { isSupabaseConfigured, supabase } from './supabase'
import {
  buildAdminFunctionInvokeOpts,
  detailFromFunctionsInvokeError,
} from './functionsInvokeError'

const FN = 'admin-manage-auth-roles'

/** @param {string} code */
function mapAuthRolesError(code) {
  switch (String(code || '')) {
    case 'unauthorized':
      return 'Admin session expired — sign in again at /admin/login.'
    case 'forbidden':
      return 'Only admin accounts can manage user roles.'
    case 'user_not_found':
      return 'User not found.'
    case 'cannot_demote_self':
      return 'You cannot remove your own admin access from this screen.'
    case 'invalid_role':
      return 'Role must be admin, driver, or none.'
    case 'list_failed':
      return 'Could not list auth users — check Edge Function logs.'
    case 'update_failed':
      return 'Could not update user role — try again.'
    case 'server_misconfigured':
      return 'Edge Function is missing Supabase secrets (URL / service role key).'
    default:
      return ''
  }
}

/**
 * @param {string} fnUrl
 * @param {string} anonKey
 * @param {string} accessToken
 * @param {Record<string, unknown>} body
 */
async function invokeAuthRolesViaFetch(fnUrl, anonKey, accessToken, body) {
  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      (typeof payload.message === 'string' && payload.message) ||
      mapAuthRolesError(payload.error) ||
      (res.status === 401
        ? 'Admin sign-in required or session expired.'
        : res.status === 404
          ? `Edge Function "${FN}" not found — deploy it in Supabase Dashboard → Edge Functions.`
          : `Request failed (HTTP ${res.status}).`)
    throw new Error(msg)
  }
  return payload && typeof payload === 'object' ? payload : {}
}

async function invoke(body) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }

  const invokeOpts = await buildAdminFunctionInvokeOpts(supabase, body)
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token || ''

  let data = null
  let error = null
  ;({ data, error } = await supabase.functions.invoke(FN, invokeOpts))

  if (error) {
    const parsed = await detailFromFunctionsInvokeError(error, '')
    const isNetwork =
      error?.name === 'FunctionsFetchError' ||
      error?.name === 'FunctionsRelayError' ||
      (parsed && /network error|relay error|failed to send/i.test(parsed))

    if (isNetwork && accessToken) {
      const baseUrl = String(import.meta.env.VITE_SUPABASE_URL || '')
        .trim()
        .replace(/\/$/, '')
      const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
      if (baseUrl && anonKey.startsWith('eyJ')) {
        try {
          const payload = await invokeAuthRolesViaFetch(
            `${baseUrl}/functions/v1/${FN}`,
            anonKey,
            accessToken,
            body,
          )
          if (!payload.ok) {
            throw new Error(
              payload.message || mapAuthRolesError(payload.error) || 'Request failed.',
            )
          }
          return payload
        } catch (fetchErr) {
          throw new Error(fetchErr?.message || parsed || 'Could not reach user roles service.')
        }
      }
    }

    throw new Error(
      parsed ||
        mapAuthRolesError(
          typeof error?.context === 'object' && error.context && 'error' in error.context
            ? error.context.error
            : '',
        ) ||
        'Could not load user roles. Sign in again as admin, then retry.',
    )
  }

  const payload = data && typeof data === 'object' ? data : {}
  if (!payload.ok) {
    throw new Error(
      payload.message || mapAuthRolesError(payload.error) || 'Request failed.',
    )
  }
  return payload
}

/** @returns {Promise<{ users: object[], page: number, per_page: number, total?: number, role_counts?: object }>} */
export async function fetchAuthUsersForAdmin({ listAll = true } = {}) {
  return invoke({ action: 'list', list_all: listAll, page: 1, per_page: 100 })
}

/**
 * @param {string} userId
 * @param {'admin' | 'driver' | 'none'} role
 */
export async function setAuthUserRoleAdmin(userId, role) {
  return invoke({ action: 'set_role', user_id: userId, role })
}
