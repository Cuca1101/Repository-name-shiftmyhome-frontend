const STORAGE_KEY = 'smh_website_lead_session_id'

/**
 * Stable anonymous session id for funnel tracking (localStorage).
 * @returns {string}
 */
export function getWebsiteLeadSessionId() {
  if (typeof window === 'undefined') return ''
  try {
    let id = window.localStorage.getItem(STORAGE_KEY)
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
      window.localStorage.setItem(STORAGE_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}
