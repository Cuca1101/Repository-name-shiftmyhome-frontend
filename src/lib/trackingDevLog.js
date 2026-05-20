/**
 * Console logging for tracking failures — development only.
 * @param {string} scope
 * @param {string} message
 * @param {unknown} [detail]
 */
export function trackingDevLog(scope, message, detail) {
  if (!import.meta.env.DEV) return
  if (detail !== undefined) {
    // eslint-disable-next-line no-console
    console.warn(`[tracking:${scope}]`, message, detail)
  } else {
    // eslint-disable-next-line no-console
    console.warn(`[tracking:${scope}]`, message)
  }
}
