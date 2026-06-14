import { loadStripe } from '@stripe/stripe-js'
import {
  getStripePublishableKey,
  getStripePublishableMode,
  isStripePublishableConfigured,
  STRIPE_LOCALE,
} from './stripeConfig'

const key = getStripePublishableKey()

if (import.meta.env.DEV) {
  const mode = getStripePublishableMode()
  if (mode === 'test') console.log('%c[Stripe] TEST mode', 'color: orange; font-weight: bold')
  else if (mode === 'live') console.log('%c[Stripe] LIVE mode', 'color: red; font-weight: bold')
}

/** Shared promise — call preloadStripeJs() on /quote step 3+ so step 4 card form opens faster. */
export const stripePromise = isStripePublishableConfigured()
  ? loadStripe(key, { locale: STRIPE_LOCALE })
  : null

/** Warm Stripe.js while the customer completes quote details (no-op if already loading/loaded). */
export function preloadStripeJs() {
  if (!isStripePublishableConfigured()) return
  void stripePromise
}
