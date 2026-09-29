import { supabase } from './supabase'

/**
 * @param {string} path
 * @param {Record<string, unknown>} body
 */
async function adminPost(path, body) {
  if (!supabase) throw new Error('Admin sign-in required.')
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) throw new Error('Admin sign-in required. Sign in again and retry.')

  const response = await fetch(path, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }
  if (!response.ok || !payload) {
    if (response.status === 404 && !payload) {
      throw new Error(
        'Call history is not available on this server yet. Deploy the Cloudflare Pages functions, then open the admin site on shiftmyhome.co.uk.',
      )
    }
    throw new Error(payload?.message || 'Could not load call history.')
  }
  return payload
}

/** @param {Record<string, unknown>} filters */
export function fetchCallHistory(filters) {
  return adminPost('/api/admin/connect/contacts', filters)
}

/** @param {string} contactId */
export function fetchCallRecording(contactId) {
  return adminPost('/api/admin/connect/recordings', { contactId })
}
