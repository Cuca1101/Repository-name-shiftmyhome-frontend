import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import type { User } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { assertAdminCaller } from './verifyAdminCaller.ts'

export const createDriverCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function createDriverJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...createDriverCorsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeEmail(email: unknown) {
  return String(email || '')
    .trim()
    .toLowerCase()
}

export type CreateDriverAccountBody = {
  full_name?: string
  fullName?: string
  email?: string
  phone?: string
  vehicle_type?: string
  vehicleType?: string
  vehicle_registration?: string
  vehicleRegistration?: string
  temporary_password?: string
  temporaryPassword?: string
  active?: boolean
}

/**
 * Admin-only: create Supabase Auth user + public.drivers row (service role on server).
 */
export async function handleCreateDriverAccount(
  req: Request,
  adminClientFactory: (url: string, serviceKey: string) => SupabaseClient = (url, key) => createClient(url, key),
): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: createDriverCorsHeaders })
  }

  if (req.method !== 'POST') {
    return createDriverJson({ ok: false, error: 'method_not_allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return createDriverJson({ ok: false, error: 'unauthorized', message: 'Admin sign-in required.' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return createDriverJson({ ok: false, error: 'server_misconfigured' }, 503)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user?.id) {
      return createDriverJson(
        { ok: false, error: 'unauthorized', message: 'Invalid or expired admin session.' },
        401,
      )
    }

    const admin = adminClientFactory(supabaseUrl, serviceKey)
    const adminCheck = await assertAdminCaller(admin, userData.user as User)
    if (!adminCheck.ok) {
      return createDriverJson({ ok: false, error: adminCheck.error, message: adminCheck.message }, 403)
    }

    const body = (await req.json().catch(() => ({}))) as CreateDriverAccountBody
    const fullName = String(body?.full_name || body?.fullName || '').trim()
    const email = normalizeEmail(body?.email)
    const phone = String(body?.phone || '').trim()
    const vehicleType = String(body?.vehicle_type || body?.vehicleType || '').trim()
    const vehicleRegistration = String(
      body?.vehicle_registration || body?.vehicleRegistration || '',
    ).trim()
    const password = String(body?.temporary_password || body?.temporaryPassword || '')
    const active = body?.active !== false

    if (!fullName) {
      return createDriverJson({ ok: false, error: 'full_name_required', message: 'Full name is required.' }, 400)
    }
    if (!email || !email.includes('@')) {
      return createDriverJson({ ok: false, error: 'email_required', message: 'Valid email is required.' }, 400)
    }
    if (!password || password.length < 8) {
      return createDriverJson(
        { ok: false, error: 'password_min_8', message: 'Temporary password must be at least 8 characters.' },
        400,
      )
    }

    const { data: existingDriver } = await admin
      .from('drivers')
      .select('id')
      .ilike('email', email)
      .maybeSingle()

    if (existingDriver?.id) {
      return createDriverJson(
        { ok: false, error: 'driver_email_exists', message: 'A driver with this email already exists.' },
        409,
      )
    }

    const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'driver' },
      user_metadata: { role: 'driver', full_name: fullName },
    })

    if (createErr || !createdUser?.user?.id) {
      const msg = createErr?.message || 'auth_create_failed'
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
        return createDriverJson(
          { ok: false, error: 'auth_email_exists', message: 'This email is already registered in Auth.' },
          409,
        )
      }
      return createDriverJson({ ok: false, error: 'auth_create_failed', message: msg }, 400)
    }

    const userId = createdUser.user.id
    const fleetStatus = active ? 'Active' : 'Inactive'

    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      full_name: fullName,
      email,
      phone: phone || null,
      vehicle_type: vehicleType || null,
      fleet_status: fleetStatus,
      active,
      notes: null,
      rating: null,
      updated_at: new Date().toISOString(),
    }
    if (vehicleRegistration) {
      insertPayload.vehicle_registration = vehicleRegistration
    }

    const { data: driverRow, error: driverErr } = await admin
      .from('drivers')
      .insert(insertPayload)
      .select('*')
      .single()

    if (driverErr || !driverRow) {
      await admin.auth.admin.deleteUser(userId)
      return createDriverJson(
        {
          ok: false,
          error: 'driver_insert_failed',
          message: driverErr?.message || 'Could not create driver profile.',
        },
        400,
      )
    }

    return createDriverJson({
      ok: true,
      success: true,
      message: 'Driver account created',
      userId,
      driverId: driverRow.id,
      driver: driverRow,
    })
  } catch (e) {
    console.error('[create-driver-account]', e)
    return createDriverJson({ ok: false, error: 'internal_error', message: 'Server error.' }, 500)
  }
}
