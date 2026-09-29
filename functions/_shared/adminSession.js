import { HttpError } from './http.js'

/**
 * Confirm the bearer token is a current Supabase user with the admin role.
 * Uses the same role check as the admin web app. No AWS credentials are read here.
 * @param {Request} request
 * @param {Record<string, string | undefined>} env
 */
export async function requireAdmin(request, env) {
  const header = request.headers.get('Authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token || token.length > 8000) {
    throw new HttpError(401, 'Admin sign-in required.')
  }

  const supabaseUrl = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
  const anonKey = String(env.SUPABASE_ANON_KEY || '').trim()
  if (!supabaseUrl || !anonKey) {
    throw new HttpError(503, 'Admin verification is not configured on the server.')
  }

  let userRes
  try {
    userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    })
  } catch {
    throw new HttpError(503, 'Could not verify the admin session. Try again.')
  }

  if (userRes.status === 401 || userRes.status === 403) {
    throw new HttpError(401, 'Admin sign-in required or session expired.')
  }
  if (!userRes.ok) {
    throw new HttpError(503, 'Could not verify the admin session. Try again.')
  }

  const user = await userRes.json().catch(() => null)
  const role = String(user?.app_metadata?.role || user?.user_metadata?.role || '')
    .trim()
    .toLowerCase()
  if (role !== 'admin') {
    throw new HttpError(403, 'This account is not an admin user.')
  }
}
