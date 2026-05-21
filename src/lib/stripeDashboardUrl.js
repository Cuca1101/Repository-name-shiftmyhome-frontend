import { getStripePublishableMode } from './stripeConfig'

/**
 * Builds a dashboard URL to search by Checkout Session or PaymentIntent id.
 * Test vs live dashboard path follows publishable key (or VITE_STRIPE_DASHBOARD_TEST override).
 */
export function stripeDashboardSearchUrl(resourceId) {
  if (!resourceId || typeof resourceId !== 'string') return null
  const q = encodeURIComponent(resourceId.trim())
  const override = import.meta.env.VITE_STRIPE_DASHBOARD_TEST
  const test =
    override === 'true' ? true : override === 'false' ? false : getStripePublishableMode() === 'test'
  const base = test ? 'https://dashboard.stripe.com/test' : 'https://dashboard.stripe.com'
  return `${base}/search?query=${q}`
}
