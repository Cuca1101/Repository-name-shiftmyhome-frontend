import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

/**
 * Ensure the bearer token belongs to an admin (not a driver account).
 * Uses ADMIN_AUTH_EMAILS (comma-separated) when set; otherwise rejects users linked in public.drivers.
 */
export async function assertAdminCaller(
  adminClient: SupabaseClient,
  user: User,
): Promise<{ ok: true } | { ok: false; error: string; message: string }> {
  const metaRole = String(
    (user.app_metadata as Record<string, unknown>)?.role ||
      (user.user_metadata as Record<string, unknown>)?.role ||
      '',
  ).toLowerCase()

  if (metaRole === 'admin') {
    return { ok: true }
  }

  if (metaRole === 'driver') {
    return {
      ok: false,
      error: 'forbidden',
      message: 'Driver accounts cannot create other driver accounts.',
    }
  }

  const email = String(user.email || '')
    .trim()
    .toLowerCase()

  const allowlistRaw = (Deno.env.get('ADMIN_AUTH_EMAILS') || Deno.env.get('ADMIN_ALLOWED_EMAILS') || '').trim()
  if (allowlistRaw) {
    const allowed = allowlistRaw
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
    if (!email || !allowed.includes(email)) {
      return {
        ok: false,
        error: 'forbidden',
        message: 'Only configured admin accounts can create driver logins.',
      }
    }
    return { ok: true }
  }

  const { data: driverRow } = await adminClient
    .from('drivers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (driverRow?.id) {
    return {
      ok: false,
      error: 'forbidden',
      message: 'Driver accounts cannot create other driver accounts.',
    }
  }

  return { ok: true }
}
