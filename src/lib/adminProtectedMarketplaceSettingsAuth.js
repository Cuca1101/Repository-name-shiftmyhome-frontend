import { isSupabaseConfigured, supabase } from './supabase'
import { debugProtectedSettings } from './adminProtectedMarketplaceSettingsDebug'

/**
 * PostgREST may return boolean true/false; normalise without treating false as an error.
 * @param {unknown} data
 */
function rpcPinAccepted(data) {
  return data === true
}

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
 * @param {unknown} err
 */
function mapRpcError(err) {
  const msg = String(err?.message || err || '')
  const code = String(err?.code || '')

  if (
    code === 'PGRST202' ||
    msg.includes('Could not find the function') ||
    msg.includes('verify_marketplace_settings_pin')
  ) {
    return 'PIN verification RPC is unavailable. Apply migration 042 on Supabase or use admin password.'
  }
  if (
    code === '42501' ||
    msg.toLowerCase().includes('permission denied') ||
    msg.toLowerCase().includes('not authorized')
  ) {
    return 'Not authenticated. Sign in to admin again, then retry.'
  }
  if (msg.toLowerCase().includes('jwt') || msg.toLowerCase().includes('session')) {
    return 'Session expired. Sign in to admin again.'
  }
  return `Server verification failed: ${msg || 'unknown error'}`
}

/**
 * @param {string} edgeCode
 */
function mapEdgeError(edgeCode) {
  switch (edgeCode) {
    case 'invalid_pin':
      return 'Incorrect PIN.'
    case 'unauthorized':
      return 'Not authenticated. Sign in to admin again, then retry.'
    case 'pin_required':
      return 'Enter your PIN.'
    case 'server_misconfigured':
      return 'Server verification is misconfigured. Use admin password or contact support.'
    default:
      return edgeCode ? `Server verification failed (${edgeCode}).` : 'Server verification failed.'
  }
}

/** @returns {Promise<Record<string, string>|undefined>} */
async function sessionAuthHeaders() {
  if (!supabase) return undefined
  const { data, error } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (error || !token) return undefined
  return { Authorization: `Bearer ${token}` }
}

/**
 * @param {string} pin
 */
async function verifyPinViaRpc(pin) {
  const { data, error } = await supabase.rpc('verify_marketplace_settings_pin', { pin })
  debugProtectedSettings('rpc', {
    rpcData: data,
    rpcDataType: typeof data,
    rpcError: error?.message || null,
    rpcCode: error?.code || null,
  })
  return { accepted: rpcPinAccepted(data), error }
}

/**
 * @param {string} pin
 */
async function verifyPinViaEdgeFunction(pin) {
  const headers = await sessionAuthHeaders()
  debugProtectedSettings('edge-request', {
    hasSessionHeader: Boolean(headers?.Authorization),
    pinLength: pin.length,
  })

  const { data, error } = await supabase.functions.invoke('verify-admin-protected-settings', {
    body: { pin },
    headers,
  })

  debugProtectedSettings('edge-response', {
    ok: data?.ok,
    edgeError: data?.error || null,
    invokeError: error?.message || null,
  })

  if (data?.ok === true) {
    return { accepted: true, error: null, edgeCode: null }
  }

  const edgeCode = data?.error != null ? String(data.error) : null
  if (edgeCode) {
    return { accepted: false, error: null, edgeCode }
  }

  if (error) {
    const detail = await detailFromFunctionsInvokeError(error, '')
    if (detail === 'invalid_pin') {
      return { accepted: false, error: null, edgeCode: 'invalid_pin' }
    }
    if (detail === 'unauthorized') {
      return { accepted: false, error: null, edgeCode: 'unauthorized' }
    }
    return {
      accepted: false,
      error: new Error(detail || error.message || 'edge_invoke_failed'),
      edgeCode: null,
    }
  }

  return { accepted: false, error: null, edgeCode: 'invalid_pin' }
}

/**
 * @param {{ password?: string, pin?: string }} creds
 * @returns {Promise<{ ok: boolean, error?: string, method?: string }>}
 */
export async function verifyProtectedMarketplaceSettingsUnlock(creds) {
  const password = typeof creds.password === 'string' ? creds.password : ''
  const pin = typeof creds.pin === 'string' ? creds.pin.trim() : ''

  if (!password && !pin) {
    return { ok: false, error: 'Enter your admin password or PIN.' }
  }

  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      error: 'Supabase is not configured. Protected settings cannot be unlocked.',
    }
  }

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
  const hasSession = Boolean(sessionData?.session?.access_token)
  debugProtectedSettings('auth-state', {
    hasSession,
    sessionError: sessionErr?.message || null,
    method: password ? 'password' : 'pin',
    pinLength: pin ? pin.length : 0,
  })

  if (!hasSession) {
    return { ok: false, error: 'Not authenticated. Sign in to admin again, then retry.' }
  }

  if (password) {
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    const email = userData?.user?.email?.trim()
    if (userErr || !email) {
      return { ok: false, error: 'Sign in again to verify your password.' }
    }
    const { error: signErr } = await supabase.auth.signInWithPassword({ email, password })
    debugProtectedSettings('password-verify', { ok: !signErr, signError: signErr?.message || null })
    if (signErr) {
      return { ok: false, error: 'Incorrect password.' }
    }
    return { ok: true, method: 'password' }
  }

  const rpc = await verifyPinViaRpc(pin)
  if (rpc.accepted) {
    debugProtectedSettings('unlock-success', { method: 'rpc' })
    return { ok: true, method: 'rpc' }
  }

  if (rpc.error) {
    const rpcMsg = mapRpcError(rpc.error)
    debugProtectedSettings('rpc-failed', { rpcMsg })
    const edge = await verifyPinViaEdgeFunction(pin)
    if (edge.accepted) {
      debugProtectedSettings('unlock-success', { method: 'edge', afterRpcError: true })
      return { ok: true, method: 'edge' }
    }
    if (edge.edgeCode) {
      return { ok: false, error: mapEdgeError(edge.edgeCode) }
    }
    if (edge.error) {
      const edgeDetail = edge.error.message || ''
      if (
        edgeDetail.includes('Failed to send') ||
        edgeDetail.includes('Function not found') ||
        edgeDetail.includes('404')
      ) {
        return { ok: false, error: rpcMsg }
      }
      return { ok: false, error: mapEdgeError(edgeDetail) || rpcMsg }
    }
    return { ok: false, error: rpcMsg }
  }

  const edge = await verifyPinViaEdgeFunction(pin)
  if (edge.accepted) {
    debugProtectedSettings('unlock-success', { method: 'edge' })
    return { ok: true, method: 'edge' }
  }

  if (edge.edgeCode) {
    return { ok: false, error: mapEdgeError(edge.edgeCode) }
  }

  if (edge.error) {
    const msg = edge.error.message || ''
    if (msg.includes('Failed to send') || msg.includes('Function not found') || msg.includes('404')) {
      return {
        ok: false,
        error:
          'PIN verification service unavailable. Apply migration 042, deploy verify-admin-protected-settings, or use admin password.',
      }
    }
    return { ok: false, error: mapEdgeError(msg) || 'Server verification failed.' }
  }

  return { ok: false, error: 'Incorrect PIN.' }
}
