import { HttpError } from './http.js'

/** The service-role key must never be used to verify a browser session. */
function isServiceRoleKey(key) {
  const part = String(key).split('.')[1]
  if (!part) return false
  try {
    const encoded = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = encoded + '='.repeat((4 - (encoded.length % 4)) % 4)
    const json = JSON.parse(atob(padded))
    return json.role === 'service_role'
  } catch {
    return false
  }
}

/**
 * Confirm the bearer token is a current Supabase user with the admin role.
 * Uses the same role check as the admin web app.
 * @param {Request} request
 * @param {Record<string, string | undefined>} env
 */
export async function requireAdmin(request, env) {
  const header = request.headers.get('Authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token || token.length > 8000) {
    throw new HttpError(401, 'Admin sign-in required.')
  }

  const supabaseUrl = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\/+$/, '')
  const anonKey = String(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '')
    .trim()
    .replace(/^["']|["']$/g, '')
  if (!supabaseUrl.startsWith('https://') || !anonKey || isServiceRoleKey(anonKey)) {
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
