/**
 * Admin-only 120s locate request for one on-duty driver.
 * Sends a data-only high-priority FCM message so a backgrounded phone can
 * start GPS without a visible job notification.
 *
 * Secret: FCM_SERVER_KEY (legacy Firebase server key).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { assertAdminCaller } from '../_shared/verifyAdminCaller.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LOCATE_MS = 120_000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const admin = createClient(supabaseUrl, serviceKey)
    const authHeader = req.headers.get('Authorization') ?? ''
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!bearer || !anonKey) {
      return json({ ok: false, error: 'unauthorized' }, 401)
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData?.user) {
      return json({ ok: false, error: 'unauthorized' }, 401)
    }
    const gate = await assertAdminCaller(admin, userData.user)
    if (!gate.ok) {
      return json({ ok: false, error: gate.error, message: gate.message }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const driverId = String(body?.driverId || '').trim()
    if (!driverId) {
      return json({ ok: false, error: 'driver_required' }, 400)
    }

    const { data: driver, error: driverError } = await admin
      .from('drivers')
      .select('id, user_id, active, duty_status, push_token')
      .eq('id', driverId)
      .maybeSingle()

    if (driverError || !driver) {
      return json({ ok: false, error: 'driver_not_found' }, 404)
    }
    if (driver.active === false || !driver.user_id) {
      return json({ ok: false, error: 'not_authenticated', message: 'Driver is not signed in.' }, 403)
    }
    if (String(driver.duty_status || '').toLowerCase() !== 'on_duty') {
      return json({ ok: false, error: 'off_duty', message: 'Driver is off duty.' }, 403)
    }

    const requestedAt = new Date()
    const expiresAt = new Date(requestedAt.getTime() + LOCATE_MS)
    const { data: session, error: sessionError } = await admin
      .from('driver_locate_sessions')
      .insert({
        driver_id: driverId,
        requested_by: userData.user.id,
        requested_at: requestedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        status: 'pending',
      })
      .select('id, requested_at, expires_at')
      .single()

    if (sessionError || !session) {
      return json({ ok: false, error: sessionError?.message || 'session_failed' }, 500)
    }

    const fcmKey = Deno.env.get('FCM_SERVER_KEY')
    if (!fcmKey) {
      return json({
        ok: true,
        sessionId: session.id,
        requestedAt: session.requested_at,
        expiresAt: session.expires_at,
        pushDelivered: false,
        pushError: 'fcm_not_configured',
      })
    }
    if (!driver.push_token) {
      return json({
        ok: true,
        sessionId: session.id,
        requestedAt: session.requested_at,
        expiresAt: session.expires_at,
        pushDelivered: false,
        pushError: 'no_push_token',
      })
    }

    const fcmRes = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${fcmKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: driver.push_token,
        priority: 'high',
        content_available: true,
        data: {
          type: 'location_request',
          session_id: String(session.id),
          expires_at: String(session.expires_at),
          requested_at: String(session.requested_at),
        },
      }),
    })
    const fcmJson = await fcmRes.json().catch(() => ({}))
    const pushDelivered = fcmRes.ok && !(Number(fcmJson?.failure) > 0)
    if (!pushDelivered) {
      return json({
        ok: true,
        sessionId: session.id,
        requestedAt: session.requested_at,
        expiresAt: session.expires_at,
        pushDelivered: false,
        pushError: 'fcm_rejected',
      })
    }

    return json({
      ok: true,
      sessionId: session.id,
      requestedAt: session.requested_at,
      expiresAt: session.expires_at,
      pushDelivered: true,
    })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
