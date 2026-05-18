/** Session-only flags for saved quote resume vs new quote flows (not persisted drafts). */

export const QUOTE_RESUME_SESSION_KEY = 'shiftmyhome_quote_resume_v1'
export const QUOTE_BANNER_DISMISS_KEY = 'shiftmyhome_quote_banner_dismiss_v1'
export const QUOTE_NEW_SERVICE_INTENT_KEY = 'shiftmyhome_new_service_quote_v1'

function session() {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** User tapped “Continue” on the saved-quote reminder — wizard may hydrate localStorage draft. */
export function markResumeSavedQuote() {
  session()?.setItem(QUOTE_RESUME_SESSION_KEY, '1')
}

export function isResumeSavedQuote() {
  return session()?.getItem(QUOTE_RESUME_SESSION_KEY) === '1'
}

export function clearResumeSavedQuote() {
  session()?.removeItem(QUOTE_RESUME_SESSION_KEY)
}

/** Hide homepage reminder for this browser tab/session only. */
export function dismissQuoteBannerForSession() {
  session()?.setItem(QUOTE_BANNER_DISMISS_KEY, '1')
}

export function isQuoteBannerDismissed() {
  return session()?.getItem(QUOTE_BANNER_DISMISS_KEY) === '1'
}

/**
 * Service card navigation — next quote wizard mount starts fresh for this service.
 * @param {string} serviceType
 * @param {string} path
 */
export function markNewQuoteFromServiceCard(serviceType, path) {
  session()?.setItem(
    QUOTE_NEW_SERVICE_INTENT_KEY,
    JSON.stringify({
      serviceType: String(serviceType || '').trim(),
      path: String(path || '').trim(),
      at: Date.now(),
    }),
  )
  clearResumeSavedQuote()
}

/** @returns {{ serviceType: string, path: string, at: number } | null} */
export function consumeNewQuoteFromServiceCard() {
  const store = session()
  if (!store) return null
  const raw = store.getItem(QUOTE_NEW_SERVICE_INTENT_KEY)
  store.removeItem(QUOTE_NEW_SERVICE_INTENT_KEY)
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    return {
      serviceType: String(data.serviceType || '').trim(),
      path: String(data.path || '').trim(),
      at: Number(data.at) || Date.now(),
    }
  } catch {
    return null
  }
}
