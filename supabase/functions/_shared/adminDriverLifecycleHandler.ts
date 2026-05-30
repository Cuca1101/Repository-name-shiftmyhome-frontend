import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { assertAdminCaller } from './verifyAdminCaller.ts'
import {
  cleanupDriverFleetLinks,
  driverHasFleetHistory,
} from './driverHistoryCheck.ts'

export const lifecycleCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function lifecycleJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...lifecycleCorsHeaders, 'Content-Type': 'application/json' },
  })
}

export type LifecycleAction = 'disable' | 'enable' | 'reactivate' | 'archive' | 'delete'

async function verifyAdminRequest(req: Request) {
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    return { error: lifecycleJson({ ok: false, error: 'unauthorized', message: 'Admin sign-in required.' }, 401) }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return { error: lifecycleJson({ ok: false, error: 'server_misconfigured' }, 503) }
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user?.id) {
    return {
      error: lifecycleJson(
        { ok: false, error: 'unauthorized', message: 'Invalid or expired admin session.' },
        401,
      ),
    }
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const adminCheck = await assertAdminCaller(admin, userData.user)
  if (!adminCheck.ok) {
    return { error: lifecycleJson({ ok: false, error: adminCheck.error, message: adminCheck.message }, 403) }
  }

  return { admin, user: userData.user }
}

async function fetchDriver(admin: SupabaseClient, driverId: string) {
  const { data, error } = await admin.from('drivers').select('*').eq('id', driverId).maybeSingle()
  if (error || !data?.id) return null
  return data
}

async function updateDriverLifecycle(
  admin: SupabaseClient,
  driverId: string,
  fleetStatus: string,
  active: boolean,
  successMessage: string,
) {
  const { data, error } = await admin
    .from('drivers')
    .update({
      fleet_status: fleetStatus,
      active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', driverId)
    .select('*')
    .single()

  if (error || !data) {
    return lifecycleJson(
      {
        ok: false,
        error: 'driver_update_failed',
        message: error?.message || 'Could not update driver.',
      },
      400,
    )
  }

  return lifecycleJson({
    ok: true,
    action: fleetStatus === 'Active' ? 'enable' : fleetStatus === 'Archived' ? 'archive' : 'disable',
    message: successMessage,
    driverId,
    driver: data,
  })
}

async function deleteDriverAdmin(
  admin: SupabaseClient,
  driverId: string,
  deleteAuthUser: boolean,
  forceCleanup: boolean,
) {
  const driverRow = await fetchDriver(admin, driverId)
  if (!driverRow) {
    return lifecycleJson({ ok: false, error: 'driver_not_found', message: 'Driver not found.' }, 404)
  }

  let history = await driverHasFleetHistory(admin, driverId)

  if (history.hasHistory && forceCleanup) {
    const cleaned = await cleanupDriverFleetLinks(admin, driverId)
    if (!cleaned.ok) {
      return lifecycleJson(
        {
          ok: false,
          error: 'driver_cleanup_failed',
          message: cleaned.message,
        },
        400,
      )
    }
    history = await driverHasFleetHistory(admin, driverId)
    if (history.hasHistory) {
      console.warn(
        '[deleteDriverAdmin] leftover links after cleanup, proceeding:',
        history.reasons.join(','),
      )
    }
  } else if (history.hasHistory) {
    return lifecycleJson(
      {
        ok: false,
        error: 'driver_has_history',
        message:
          'Driver still has linked records. Confirm delete again to clear driver-only data and remove the profile.',
        reasons: history.reasons,
        canForceDelete: true,
      },
      409,
    )
  }

  const authUserId = driverRow.user_id != null ? String(driverRow.user_id) : ''

  const { error: deleteRowErr } = await admin.from('drivers').delete().eq('id', driverId)
  if (deleteRowErr) {
    return lifecycleJson(
      {
        ok: false,
        error: 'driver_delete_failed',
        message: deleteRowErr.message || 'Could not delete driver record.',
      },
      400,
    )
  }

  if (deleteAuthUser && authUserId) {
    const { error: authDelErr } = await admin.auth.admin.deleteUser(authUserId)
    if (authDelErr) {
      return lifecycleJson({
        ok: true,
        partial: true,
        action: 'delete',
        message: 'Driver deleted, but Auth user could not be removed.',
        driverId,
        authDeleteError: authDelErr.message,
      })
    }
  }

  return lifecycleJson({
    ok: true,
    action: 'delete',
    message: 'Driver deleted',
    driverId,
    authUserDeleted: Boolean(deleteAuthUser && authUserId),
  })
}

export async function handleAdminDriverLifecycle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: lifecycleCorsHeaders })
  }

  if (req.method !== 'POST') {
    return lifecycleJson({ ok: false, error: 'method_not_allowed' }, 405)
  }

  try {
    const verified = await verifyAdminRequest(req)
    if ('error' in verified && verified.error) return verified.error
    if (!('admin' in verified) || !verified.admin) {
      return lifecycleJson({ ok: false, error: 'internal_error', message: 'Server error.' }, 500)
    }
    const admin = verified.admin

    const body = await req.json().catch(() => ({}))
    const driverId = String(body?.driver_id || body?.driverId || '').trim()
    const action = String(body?.action || '').trim().toLowerCase() as LifecycleAction
    const deleteAuthUser = body?.delete_auth_user !== false && body?.deleteAuthUser !== false
    const forceCleanup = body?.force_cleanup === true || body?.forceCleanup === true

    if (!driverId) {
      return lifecycleJson({ ok: false, error: 'driver_id_required', message: 'Driver id is required.' }, 400)
    }

    const existing = await fetchDriver(admin!, driverId)
    if (!existing) {
      return lifecycleJson({ ok: false, error: 'driver_not_found', message: 'Driver not found.' }, 404)
    }

    switch (action) {
      case 'disable':
        return updateDriverLifecycle(admin, driverId, 'Suspended', false, 'Driver disabled')
      case 'enable':
      case 'reactivate':
        return updateDriverLifecycle(admin, driverId, 'Active', true, 'Driver enabled')
      case 'archive':
        return updateDriverLifecycle(admin, driverId, 'Archived', false, 'Driver archived')
      case 'delete':
        return deleteDriverAdmin(admin, driverId, deleteAuthUser, forceCleanup)
      default:
        return lifecycleJson(
          {
            ok: false,
            error: 'invalid_action',
            message: 'Invalid action. Use disable, enable, reactivate, archive, or delete.',
          },
          400,
        )
    }
  } catch (e) {
    console.error('[admin-driver-lifecycle]', e)
    return lifecycleJson({ ok: false, error: 'internal_error', message: 'Server error.' }, 500)
  }
}
