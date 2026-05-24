const CONSENT_STORAGE_KEY = 'smh_cookie_consent'
export const COOKIE_CONSENT_CHANGE_EVENT = 'smh-cookie-consent-change'

/**
 * @typedef {{ essential: true, analytics: boolean, marketing: boolean, updatedAt: string }} CookieConsentState
 */

/** @returns {CookieConsentState | null} */
export function getCookieConsent() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed == null) return null
    return {
      essential: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

/** @returns {boolean} */
export function hasAnalyticsConsent() {
  return getCookieConsent()?.analytics === true
}

/** @returns {boolean} */
export function hasMarketingConsent() {
  return getCookieConsent()?.marketing === true
}

/** @returns {boolean} */
export function needsCookieConsentChoice() {
  return getCookieConsent() == null
}

/**
 * @param {{ analytics: boolean, marketing: boolean }} choice
 * @returns {CookieConsentState}
 */
export function setCookieConsent(choice) {
  /** @type {CookieConsentState} */
  const next = {
    essential: true,
    analytics: Boolean(choice.analytics),
    marketing: Boolean(choice.marketing),
    updatedAt: new Date().toISOString(),
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGE_EVENT, { detail: next }))
  }
  return next
}

export function acceptAllCookies() {
  return setCookieConsent({ analytics: true, marketing: true })
}

export function acceptEssentialCookiesOnly() {
  return setCookieConsent({ analytics: false, marketing: false })
}
