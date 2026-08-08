const STORAGE_KEY = 'smh_website_lead_session_id'

/**
 * @returns {string}
 */
function createSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Stable anonymous session id for funnel tracking (localStorage).
 * @returns {string}
 */
export function getWebsiteLeadSessionId() {
  if (typeof window === 'undefined') return ''
  try {
    let id = window.localStorage.getItem(STORAGE_KEY)
    if (!id) {
      id = createSessionId()
      window.localStorage.setItem(STORAGE_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}

/**
 * Start a genuinely new quote/lead — replaces the sticky session id.
 * @returns {string} new session id (empty if storage unavailable)
 */
export function rotateWebsiteLeadSessionId() {
  if (typeof window === 'undefined') return ''
  try {
    const id = createSessionId()
    window.localStorage.setItem(STORAGE_KEY, id)
    return id
  } catch {
    return ''
  }
}

/**
 * Bind the browser to an existing lead session (recovery/resume).
 * @param {string | null | undefined} sessionId
 * @returns {string} bound id, or current id if input empty
 */
export function bindWebsiteLeadSessionId(sessionId) {
  const sid = String(sessionId || '').trim()
  if (!sid) return getWebsiteLeadSessionId()
  if (typeof window === 'undefined') return sid
  try {
    window.localStorage.setItem(STORAGE_KEY, sid)
    return sid
  } catch {
    return sid
  }
}

/**
 * One-off session id for isolated captures (e.g. homepage form) without
 * clobbering an in-progress wizard lead session.
 * @returns {string}
 */
export function createEphemeralLeadSessionId() {
  return createSessionId()
}
