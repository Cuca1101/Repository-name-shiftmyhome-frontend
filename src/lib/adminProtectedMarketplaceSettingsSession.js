const SESSION_KEY = 'smh_protected_marketplace_unlocked_until'
/** @type {number} */
export const PROTECTED_MARKETPLACE_SETTINGS_TTL_MS = 30 * 60 * 1000

/**
 * @returns {boolean}
 */
export function isProtectedMarketplaceSettingsUnlocked() {
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

/**
 * @returns {number | null} ms remaining, or null if locked
 */
export function protectedMarketplaceSettingsUnlockRemainingMs() {
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

export function setProtectedMarketplaceSettingsUnlocked() {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(SESSION_KEY, String(Date.now() + PROTECTED_MARKETPLACE_SETTINGS_TTL_MS))
  } catch {
    /* ignore */
  }
}

export function lockProtectedMarketplaceSettings() {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}
