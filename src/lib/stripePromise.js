import { loadStripe } from '@stripe/stripe-js'
import { getStripePublishableKey, isStripePublishableConfigured } from './stripeConfig'

const key = getStripePublishableKey()

export const stripePromise = isStripePublishableConfigured() ? loadStripe(key) : null
