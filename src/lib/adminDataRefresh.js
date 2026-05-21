/** Dispatched after go-live cleanup so admin lists refetch without hard refresh. */

export const ADMIN_DATA_REFRESH_EVENT = 'smh-admin-data-refresh'

/**
 * @param {{ source?: string }} [detail]
 */
export function notifyAdminDataRefresh(detail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ADMIN_DATA_REFRESH_EVENT, { detail }))
}

/**
 * @param {() => void | Promise<void>} handler
 * @returns {() => void}
 */
export function subscribeAdminDataRefresh(handler) {
  if (typeof window === 'undefined') return () => {}
  const wrapped = () => {
    void handler()
  }
  window.addEventListener(ADMIN_DATA_REFRESH_EVENT, wrapped)
  return () => window.removeEventListener(ADMIN_DATA_REFRESH_EVENT, wrapped)
}
