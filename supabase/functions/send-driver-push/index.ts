/**
 * Send FCM to a driver's device (drivers.push_token).
 *
 * Used when admin assigns/unassigns so the phone rings even if the app is
 * backgrounded (Chrome, locked, pocket).
 *
 * Secrets:
 *   FCM_SERVER_KEY — Firebase Cloud Messaging legacy server key
 *
 * Deploy: supabase functions deploy send-driver-push --project-ref <ref>
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { assertAdminCaller } from '../_shared/verifyAdminCaller.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Must match Notifee ANDROID_CHANNELS.jobs in the driver app. */
const ANDROID_JOBS_CHANNEL = 'smh_jobs_v3'
const ANDROID_DEFAULT_CHANNEL = 'smh_default_v3'

type RequestBody = {
  driverId: string
  title: string
  body: string
  type?: string
  quoteId?: string
  quoteRef?: string
  stopKey?: string
  data?: Record<string, string>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'method_not_allowed' }, 405)
  }

  try {
    const fcmKey = Deno.env.get('FCM_SERVER_KEY')
    if (!fcmKey) {
      return json({ success: false, error: 'FCM_SERVER_KEY not configured' }, 500)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const admin = createClient(supabaseUrl, serviceKey)

    const authHeader = req.headers.get('Authorization') ?? ''
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim()
    const isServiceRole = Boolean(bearer && bearer === serviceKey)

    if (!isServiceRole) {
      if (!bearer || !anonKey) {
        return json({ success: false, error: 'unauthorized' }, 401)
      }
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      })
      const { data: userData, error: userError } = await userClient.auth.getUser()
      if (userError || !userData?.user) {
        return json({ success: false, error: 'unauthorized' }, 401)
      }
      const gate = await assertAdminCaller(admin, userData.user)
      if (!gate.ok) {
        return json({ success: false, error: gate.error, message: gate.message }, 403)
      }
    }

    const body = (await req.json()) as RequestBody
    const { driverId, title, body: messageBody } = body

    if (!driverId || !title) {
      return json({ success: false, error: 'driverId and title required' }, 400)
    }

    const { data: driver, error: driverError } = await admin
      .from('drivers')
      .select('id, push_token')
      .eq('id', driverId)
      .maybeSingle()

    if (driverError || !driver?.push_token) {
      return json(
        {
          success: false,
          error: driverError?.message ?? 'No push_token for driver',
        },
        404,
      )
    }

    const eventType = body.type ?? 'new_job_assigned'
    const channelId =
      eventType === 'new_job_assigned' || eventType === 'urgent_alert'
        ? ANDROID_JOBS_CHANNEL
        : ANDROID_DEFAULT_CHANNEL

    const dataPayload: Record<string, string> = {
      type: eventType,
      title,
      body: messageBody ?? '',
      quote_id: body.quoteId ?? '',
      quote_ref: body.quoteRef ?? '',
      stop_key: body.stopKey ?? '',
      ...(body.data ?? {}),
    }

    // notification + data: Android shows system tray with channel sound when
    // the app is backgrounded/killed (JS may be suspended).
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
        notification: {
          title,
          body: messageBody ?? '',
          sound: 'default',
          android_channel_id: channelId,
          channel_id: channelId,
        },
        data: dataPayload,
        android: {
          priority: 'high',
          notification: {
            channel_id: channelId,
            sound: 'default',
            default_vibrate_timings: true,
            notification_priority: 'PRIORITY_MAX',
          },
        },
      }),
    })

    const fcmJson = await fcmRes.json()

    if (!fcmRes.ok || fcmJson.failure > 0) {
      return json(
        {
          success: false,
          error: JSON.stringify(fcmJson),
        },
        502,
      )
    }

    return json({
      success: true,
      messageId: fcmJson.multicast_id ?? fcmJson.message_id,
    })
  } catch (e) {
    return json(
      {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      },
      500,
    )
  }
})

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
