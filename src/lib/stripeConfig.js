/**
 * Stripe publishable key mode — single source for frontend payment UI.
 * Secret keys stay in Supabase Edge Function secrets only.
 */

/** @returns {string} */
export function getStripePublishableKey() {
  return (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '').trim().replace(/^["']|["']$/g, '')
}

/** @returns {'test'|'live'|'unknown'} */
export function getStripePublishableMode() {
  const key = getStripePublishableKey()
  if (key.startsWith('pk_test_')) return 'test'
  if (key.startsWith('pk_live_')) return 'live'
  return 'unknown'
}

/** @returns {boolean} */
export function isStripePublishableConfigured() {
  return getStripePublishableKey().startsWith('pk_')
}

/** @returns {boolean} */
export function isStripeLiveMode() {
  return getStripePublishableMode() === 'live'
}

/**
 * Show test-mode banners only when the publishable key is test.
 * Override: VITE_SHOW_STRIPE_TEST_UI=true|false
 * @returns {boolean}
 */
export function shouldShowStripeTestModeWarning() {
  const override = import.meta.env.VITE_SHOW_STRIPE_TEST_UI
  if (override === 'true') return true
  if (override === 'false') return false
  return getStripePublishableMode() === 'test'
}

/**
 * @returns {string}
 */
export function stripeTestModeWarningMessage() {
  return 'Stripe test mode — card payments use test keys (pk_test_ / sk_test_). Use live keys for real charges.'
}

/**
 * @throws {Error}
 */
export function assertStripePublishableKeyConfigured() {
  const key = getStripePublishableKey()
  if (!key) {
    throw new Error(
      'Card payments are not configured. Set VITE_STRIPE_PUBLISHABLE_KEY (pk_test_… or pk_live_…) in your environment.',
    )
  }
  if (!key.startsWith('pk_')) {
    throw new Error('VITE_STRIPE_PUBLISHABLE_KEY must be your Stripe publishable key (starts with pk_).')
  }
  const mode = getStripePublishableMode()
  if (mode === 'unknown') {
    throw new Error('VITE_STRIPE_PUBLISHABLE_KEY must start with pk_test_ or pk_live_.')
  }
}
