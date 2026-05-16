import { loadStripe } from '@stripe/stripe-js'

/** Browser-only — must match VITE_STRIPE_PUBLISHABLE_KEY (pk_test_… / pk_live_…). */
const key = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '').trim().replace(/^["']|["']$/g, '')

export const stripePromise = key.startsWith('pk_') ? loadStripe(key) : null
