import { isSupabaseConfigured, supabase } from './supabase'

/**
 * JWT role from Supabase Auth user (app_metadata preferred).
 * @param {import('@supabase/supabase-js').User | null | undefined} user
 */
export function authRoleFromUser(user) {
  if (!user) return ''
  const app = user.app_metadata?.role
  const userMeta = user.user_metadata?.role
  return String(app || userMeta || '')
    .trim()
    .toLowerCase()
}

/**
 * True only for explicit admin JWT role.
 * @param {import('@supabase/supabase-js').User | null | undefined} user
 */
export function isExplicitAdminUser(user) {
  return authRoleFromUser(user) === 'admin'
}

/**
 * @param {import('@supabase/supabase-js').User | null | undefined} user
 */
export function isExplicitDriverUser(user) {
  return authRoleFromUser(user) === 'driver'
}

/**
 * Block driver mobile accounts from the admin web app.
 * @param {import('@supabase/supabase-js').Session | null | undefined} session
 * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
 */
export async function verifyAdminWebSession(session) {
  const user = session?.user
  if (!user) {
    return { ok: false, message: 'Sign in required.' }
  }

  if (isExplicitDriverUser(user)) {
    return {
      ok: false,
      message: 'Driver accounts cannot access admin. Use the ShiftMyHome Driver mobile app.',
    }
  }

  if (isExplicitAdminUser(user)) {
    return { ok: true }
  }

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      return {
        ok: false,
        message: 'Could not verify admin access. Try again or contact the office.',
      }
    }

    if (data?.id) {
      return {
        ok: false,
        message: 'This login is linked to a driver profile. Use the Driver mobile app, not admin.',
      }
    }
  }

  return {
    ok: false,
    message:
      'This account is not an admin user. Sign in with an admin email (role admin in Supabase Auth).',
  }
}
