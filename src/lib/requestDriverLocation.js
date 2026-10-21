import { isSupabaseConfigured, supabase } from './supabase'

/**
 * Ask one on-duty driver's phone for a 120 second location session.
 * @param {string} driverId
 */
export async function requestDriverLocation(driverId) {
  const id = String(driverId || '').trim()
  if (!id) return { ok: false, message: 'Choose a driver first.' }
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, message: 'Location requests are unavailable.' }
  }
  try {
    const { data, error } = await supabase.functions.invoke('request-driver-location', {
      body: { driverId: id },
    })
    if (error) {
      let code = ''
      try {
        const body = typeof error.context?.json === 'function' ? await error.context.json() : null
        code = body?.error != null ? String(body.error) : ''
      } catch {
        code = ''
      }
      return { ok: false, message: locateErrorMessage(code) }
    }
    const result = data && typeof data === 'object' ? data : null
    if (!result?.ok) {
      return { ok: false, message: locateErrorMessage(result?.error) }
    }
    return {
      ok: true,
      sessionId: result.sessionId != null ? String(result.sessionId) : '',
      requestedAt: result.requestedAt != null ? String(result.requestedAt) : '',
      expiresAt: result.expiresAt != null ? String(result.expiresAt) : '',
      pushDelivered: result.pushDelivered === true,
      pushError: result.pushError != null ? String(result.pushError) : '',
      pushNote: locatePushNote(result.pushDelivered === true, result.pushError),
    }
  } catch {
    return { ok: false, message: 'Location request failed.' }
  }
}

/**
 * Copy that matches the push result we actually received.
 * @param {boolean} pushDelivered
 * @param {unknown} pushError
 */
export function locatePushNote(pushDelivered, pushError) {
  if (pushDelivered) return ''
  const key = String(pushError || '')
  if (key === 'no_push_token') {
    return 'No push token is registered for this phone, so the background request was not sent.'
  }
  if (key === 'fcm_not_configured') {
    return 'Push is not configured on the server, so the background request was not sent.'
  }
  if (key === 'fcm_rejected') {
    return 'The push service rejected the request. The phone was not confirmed to receive it.'
  }
  return 'The background push was not delivered. Waiting to see if the phone sends a new position.'
}

function locateErrorMessage(code) {
  const key = String(code || '')
  if (key === 'off_duty') return 'Driver is off duty.'
  if (key === 'not_authenticated') return 'Driver is not signed in.'
  if (key === 'driver_not_found') return 'Driver was not found.'
  if (key === 'unauthorized' || key === 'forbidden') return 'Only an admin can request a location.'
  return 'Location request failed.'
}

/**
 * Drawer copy for one admin locate session.
 * Live starts only after a GPS sample taken at or after the request.
 * @param {{ phase?: string, requestedAt?: string, expiresAt?: string, error?: string, pushNote?: string } | null | undefined} session
 * @param {{ sampled_at?: string | null, updated_at?: string | null } | null | undefined} live
 * @param {number} [nowMs]
 * @returns {{ title: string, detail: string } | null}
 */
export function describeLocateSession(session, live, nowMs = Date.now()) {
  if (!session) return null
  if (session.phase === 'failed') {
    return { title: session.error || 'Location request failed.', detail: '' }
  }
  const requestedMs = Date.parse(String(session.requestedAt || ''))
  const expiresMs = Date.parse(String(session.expiresAt || ''))
  const sampleMs = Date.parse(String(live?.sampled_at || ''))
  const clock = formatLondonClock(live?.sampled_at || live?.updated_at)
  const lastKnown = clock ? `Last known location at ${clock}` : ''
  const expired = Number.isFinite(expiresMs) && nowMs >= expiresMs
  const confirmed = Number.isFinite(sampleMs) && Number.isFinite(requestedMs) && sampleMs >= requestedMs - 5000
  if (!Number.isFinite(requestedMs)) {
    return { title: 'Requesting location…', detail: lastKnown }
  }
  if (expired || !confirmed) {
    if (!confirmed && !expired) {
      return {
        title: 'Requesting location…',
        detail: [lastKnown, session.pushNote].filter(Boolean).join(' '),
      }
    }
    return {
      title: 'The phone did not send a new position.',
      detail: [lastKnown, session.pushNote].filter(Boolean).join(' '),
    }
  }
  const left = Math.max(0, Math.ceil((expiresMs - nowMs) / 1000))
  return { title: `Live · ${left}s left`, detail: '' }
}

export function formatLondonClock(iso) {
  const ms = iso ? Date.parse(String(iso)) : NaN
  if (!Number.isFinite(ms)) return ''
  return new Date(ms).toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
  })
}
