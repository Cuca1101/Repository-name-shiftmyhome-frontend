/** Dev-only logging for protected marketplace settings unlock (never logs PIN/password). */

const ENABLED =
  import.meta.env.DEV === true || import.meta.env.VITE_DEBUG_PROTECTED_SETTINGS === 'true'

/**
 * @param {string} label
 * @param {Record<string, unknown>} [payload]
 */
export function debugProtectedSettings(label, payload = {}) {
  if (!ENABLED) return
  const safe = { ...payload }
  if ('pinLength' in safe) safe.pinLength = safe.pinLength
  delete safe.pin
  delete safe.password
  console.info(`[protected-settings] ${label}`, safe)
}
