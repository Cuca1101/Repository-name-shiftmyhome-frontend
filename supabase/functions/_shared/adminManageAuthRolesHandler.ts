import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { assertAdminCaller } from './verifyAdminCaller.ts'

export const authRolesCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function authRolesJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...authRolesCorsHeaders, 'Content-Type': 'application/json' },
  })
}

function roleFromUser(user: User) {
  const app = String((user.app_metadata as Record<string, unknown>)?.role || '')
    .trim()
    .toLowerCase()
  const userMeta = String((user.user_metadata as Record<string, unknown>)?.role || '')
    .trim()
    .toLowerCase()
  if (app === 'admin' || userMeta === 'admin') return 'admin'
  if (app === 'driver' || userMeta === 'driver') return 'driver'
  return 'none'
}

function mergeRoleMeta(meta: Record<string, unknown> | undefined, role: 'admin' | 'driver' | 'none') {
  const next = { ...(meta && typeof meta === 'object' ? meta : {}) }
  if (role === 'none') {
    delete next.role
  } else {
    next.role = role
  }
  return next
}

type AuthRolesBody = {
  action?: 'list' | 'set_role'
  page?: number
  per_page?: number
  list_all?: boolean
  user_id?: string
  role?: 'admin' | 'driver' | 'none'
}

async function listAllAuthUsers(admin: SupabaseClient) {
  const perPage = 100
  const all: User[] = []
  let page = 1
  let reportedTotal = 0

  for (let guard = 0; guard < 50; guard++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const batch = (data?.users || []) as User[]
    reportedTotal = Number(data?.total) || reportedTotal || all.length + batch.length
    all.push(...batch)
    if (batch.length < perPage) break
    if (reportedTotal > 0 && all.length >= reportedTotal) break
    page++
  }

  return { users: all, total: reportedTotal || all.length }
}

async function loadDriversByUserIds(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, { id: string; full_name: string | null }>> {
  const driverByUser = new Map<string, { id: string; full_name: string | null }>()
  const chunkSize = 80
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize)
    const { data: drivers } = await admin
      .from('drivers')
      .select('id, user_id, full_name')
      .in('user_id', chunk)
    for (const row of drivers || []) {
      if (row.user_id) {
        driverByUser.set(String(row.user_id), {
          id: String(row.id),
          full_name: row.full_name != null ? String(row.full_name) : null,
        })
      }
    }
  }
  return driverByUser
}

export async function handleAdminManageAuthRoles(
  req: Request,
  adminClientFactory: (url: string, serviceKey: string) => SupabaseClient = (url, key) =>
    createClient(url, key),
): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: authRolesCorsHeaders })
  }

  if (req.method !== 'POST') {
    return authRolesJson({ ok: false, error: 'method_not_allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return authRolesJson({ ok: false, error: 'unauthorized', message: 'Admin sign-in required.' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return authRolesJson({ ok: false, error: 'server_misconfigured' }, 503)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user?.id) {
      return authRolesJson(
        { ok: false, error: 'unauthorized', message: 'Invalid or expired admin session.' },
        401,
      )
    }

    const caller = userData.user as User
    const admin = adminClientFactory(supabaseUrl, serviceKey)
    const adminCheck = await assertAdminCaller(admin, caller)
    if (!adminCheck.ok) {
      return authRolesJson({ ok: false, error: adminCheck.error, message: adminCheck.message }, 403)
    }

    const body = (await req.json().catch(() => ({}))) as AuthRolesBody
    const action = body.action === 'set_role' ? 'set_role' : 'list'

    if (action === 'set_role') {
      const userId = String(body.user_id || '').trim()
      const role = body.role
      if (!userId) {
        return authRolesJson({ ok: false, error: 'user_id_required', message: 'User id is required.' }, 400)
      }
      if (role !== 'admin' && role !== 'driver' && role !== 'none') {
        return authRolesJson({ ok: false, error: 'invalid_role', message: 'Role must be admin, driver, or none.' }, 400)
      }
      if (caller.id === userId && role !== 'admin') {
        return authRolesJson(
          {
            ok: false,
            error: 'cannot_demote_self',
            message: 'You cannot remove your own admin access from this screen.',
          },
          400,
        )
      }

      const { data: targetData, error: targetErr } = await admin.auth.admin.getUserById(userId)
      if (targetErr || !targetData?.user) {
        return authRolesJson({ ok: false, error: 'user_not_found', message: 'User not found.' }, 404)
      }

      const target = targetData.user
      const appMeta = mergeRoleMeta(target.app_metadata as Record<string, unknown>, role)
      const userMeta = mergeRoleMeta(target.user_metadata as Record<string, unknown>, role)

      const { data: updated, error: updateErr } = await admin.auth.admin.updateUserById(userId, {
        app_metadata: appMeta,
        user_metadata: userMeta,
      })
      if (updateErr) {
        return authRolesJson(
          { ok: false, error: 'update_failed', message: updateErr.message || 'Could not update user role.' },
          500,
        )
      }

      const { data: driverRow } = await admin
        .from('drivers')
        .select('id, full_name')
        .eq('user_id', userId)
        .maybeSingle()

      return authRolesJson({
        ok: true,
        user: {
          id: updated.user?.id || userId,
          email: updated.user?.email || target.email,
          role: roleFromUser((updated.user || target) as User),
          driver_profile_id: driverRow?.id || null,
          driver_name: driverRow?.full_name || null,
        },
      })
    }

    const listAll = body.list_all !== false
    let users: User[] = []
    let total = 0
    let page = Math.max(1, Number(body.page) || 1)
    const perPage = Math.min(100, Math.max(1, Number(body.per_page) || 100))

    if (listAll) {
      try {
        const all = await listAllAuthUsers(admin)
        users = all.users
        total = all.total
        page = 1
      } catch (listErr) {
        const msg = listErr instanceof Error ? listErr.message : 'Could not list auth users.'
        return authRolesJson({ ok: false, error: 'list_failed', message: msg }, 500)
      }
    } else {
      const { data: listData, error: listErr } = await admin.auth.admin.listUsers({ page, perPage })
      if (listErr) {
        return authRolesJson(
          { ok: false, error: 'list_failed', message: listErr.message || 'Could not list auth users.' },
          500,
        )
      }
      users = (listData?.users || []) as User[]
      total = Number(listData?.total) || users.length
    }

    const userIds = users.map((u) => u.id).filter(Boolean)
    const driverByUser = userIds.length > 0 ? await loadDriversByUserIds(admin, userIds) : new Map()

    const mapped = users.map((u) => {
      const driver = driverByUser.get(u.id)
      return {
        id: u.id,
        email: u.email || '',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        role: roleFromUser(u),
        driver_profile_id: driver?.id || null,
        driver_name: driver?.full_name || null,
      }
    })

    const role_counts = {
      admin: mapped.filter((u) => u.role === 'admin').length,
      driver: mapped.filter((u) => u.role === 'driver').length,
      none: mapped.filter((u) => u.role === 'none').length,
    }

    return authRolesJson({
      ok: true,
      users: mapped,
      page,
      per_page: listAll ? mapped.length : perPage,
      total,
      list_all: listAll,
      role_counts,
    })
  } catch (err) {
    console.error('[admin-manage-auth-roles]', err)
    return authRolesJson(
      { ok: false, error: 'internal_error', message: err instanceof Error ? err.message : 'Request failed.' },
      500,
    )
  }
}
