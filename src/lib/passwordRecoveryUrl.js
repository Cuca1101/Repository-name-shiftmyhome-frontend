/** Public page that receives the Supabase recovery redirect. */
export const PASSWORD_RESET_PATH = '/driver/reset-password'
export const PASSWORD_RESET_REDIRECT = 'https://www.shiftmyhome.co.uk/driver/reset-password'

const MIN_PASSWORD_LENGTH = 8

/**
 * @param {string} url
 * @returns {{ kind: 'session', accessToken: string, refreshToken: string } | { kind: 'code', code: string } | null}
 */
export function parsePasswordRecoveryUrl(url) {
  const trimmed = String(url || '').trim()
  if (!trimmed) return null

  const hashAt = trimmed.indexOf('#')
  const withoutHash = hashAt >= 0 ? trimmed.slice(0, hashAt) : trimmed
  const hash = hashAt >= 0 ? trimmed.slice(hashAt + 1) : ''
  const queryAt = withoutHash.indexOf('?')
  const query = queryAt >= 0 ? withoutHash.slice(queryAt + 1) : ''
  const fromHash = new URLSearchParams(hash)
  const fromQuery = new URLSearchParams(query)
  const type = (fromHash.get('type') || fromQuery.get('type') || '').toLowerCase()
  const recovery = type === 'recovery' || /reset-password/i.test(trimmed)
  if (!recovery) return null
  const accessToken = fromHash.get('access_token') || fromQuery.get('access_token') || ''
  const refreshToken = fromHash.get('refresh_token') || fromQuery.get('refresh_token') || ''
  if (accessToken && refreshToken) {
    return { kind: 'session', accessToken, refreshToken }
  }
  const code = fromQuery.get('code') || fromHash.get('code') || ''
  if (code) return { kind: 'code', code }
  return null
}

/** @param {string} password @param {string} confirm */
export function validateNewPassword(password, confirm) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (password !== confirm) return 'The two passwords do not match.'
  return null
}
