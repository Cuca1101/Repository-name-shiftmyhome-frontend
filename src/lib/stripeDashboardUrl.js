/**
 * Builds a dashboard URL to search by Checkout Session or PaymentIntent id.
 * Works for cs_… and pi_… when logged into the correct merchant account.
 *
 * Optional: set VITE_STRIPE_DASHBOARD_TEST=true to prefix test-mode paths (search works for both).
 */
export function stripeDashboardSearchUrl(resourceId) {
  if (!resourceId || typeof resourceId !== 'string') return null
  const q = encodeURIComponent(resourceId.trim())
  const test = import.meta.env.VITE_STRIPE_DASHBOARD_TEST === 'true'
  const base = test ? 'https://dashboard.stripe.com/test' : 'https://dashboard.stripe.com'
  return `${base}/search?query=${q}`
}
