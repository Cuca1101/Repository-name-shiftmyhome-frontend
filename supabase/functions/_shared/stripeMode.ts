/**
 * Stripe key mode detection for Edge Functions.
 * Accepts sk_test_ / sk_live_ (and pk_* on frontend). No hard-coded test-only enforcement.
 */

export type StripeKeyMode = 'test' | 'live' | 'unknown'

export function stripeKeyMode(key: string): StripeKeyMode {
  const k = String(key || '').trim()
  if (k.startsWith('sk_test_') || k.startsWith('pk_test_')) return 'test'
  if (k.startsWith('sk_live_') || k.startsWith('pk_live_')) return 'live'
  return 'unknown'
}

/** True when SITE_URL or STRIPE_ENV indicates production deployment. */
export function isProductionStripeDeployment(): boolean {
  const envFlag = (Deno.env.get('STRIPE_ENV') || Deno.env.get('PAYMENT_ENV') || '').trim().toLowerCase()
  if (envFlag === 'live' || envFlag === 'production') return true
  if (envFlag === 'test' || envFlag === 'development') return false

  const site = (Deno.env.get('SITE_URL') || '').trim().toLowerCase()
  if (!site) return false
  if (site.includes('localhost') || site.includes('127.0.0.1')) return false
  if (site.includes('shiftmyhome.co.uk')) return true
  return !site.includes('localhost')
}

/**
 * Validates STRIPE_SECRET_KEY for Edge Functions.
 * Rejects unknown formats; optionally blocks sk_test on production hosts unless STRIPE_ALLOW_TEST_ON_PRODUCTION=true.
 */
export function validateStripeSecretKey(key: string | undefined): {
  ok: boolean
  mode: StripeKeyMode
  error?: string
} {
  const secret = String(key || '').trim()
  if (!secret) {
    return { ok: false, mode: 'unknown', error: 'Server misconfigured: STRIPE_SECRET_KEY' }
  }

  const mode = stripeKeyMode(secret)
  if (mode === 'unknown') {
    return {
      ok: false,
      mode: 'unknown',
      error: 'STRIPE_SECRET_KEY must be a Stripe secret key (sk_test_… or sk_live_…).',
    }
  }

  if (mode === 'test' && isProductionStripeDeployment()) {
    const allow = Deno.env.get('STRIPE_ALLOW_TEST_ON_PRODUCTION') === 'true'
    if (!allow) {
      return {
        ok: false,
        mode: 'test',
        error:
          'Production site requires sk_live_ in Supabase STRIPE_SECRET_KEY. Use sk_test_ only on localhost or set STRIPE_ALLOW_TEST_ON_PRODUCTION=true.',
      }
    }
  }

  return { ok: true, mode }
}
