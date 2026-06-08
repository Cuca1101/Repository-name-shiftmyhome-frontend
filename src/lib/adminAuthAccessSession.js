const SESSION_KEY = 'smh_auth_access_unlocked_until'
/** @type {number} */
export const AUTH_ACCESS_UNLOCK_TTL_MS = 30 * 60 * 1000

export function isAuthAccessUnlocked() {
  if (typeof sessionStorage === 'undefined') return false
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return false
    const until = Number(raw)
    return Number.isFinite(until) && Date.now() < until
  } catch {
    return false
  }
}

export function authAccessUnlockRemainingMs() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const until = Number(raw)
    if (!Number.isFinite(until)) return null
    const left = until - Date.now()
    return left > 0 ? left : null
  } catch {
    return null
  }
}

export function setAuthAccessUnlocked() {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(SESSION_KEY, String(Date.now() + AUTH_ACCESS_UNLOCK_TTL_MS))
  } catch {
    /* ignore */
  }
}

export function lockAuthAccess() {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}
