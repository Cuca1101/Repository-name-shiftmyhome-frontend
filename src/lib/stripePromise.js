import { loadStripe } from '@stripe/stripe-js'
import { getStripePublishableKey, getStripePublishableMode, isStripePublishableConfigured } from './stripeConfig'

const key = getStripePublishableKey()

if (import.meta.env.DEV) {
  const mode = getStripePublishableMode()
  if (mode === 'test') console.log('%c[Stripe] TEST mode', 'color: orange; font-weight: bold')
  else if (mode === 'live') console.log('%c[Stripe] LIVE mode', 'color: red; font-weight: bold')
}

export const stripePromise = isStripePublishableConfigured() ? loadStripe(key) : null
