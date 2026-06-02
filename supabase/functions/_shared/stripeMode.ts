/**
 * Stripe key mode detection for Edge Functions.
 * Secret key: Supabase Dashboard → Edge Functions → Secrets → STRIPE_SECRET_KEY only.
 * Never use VITE_* or frontend env for sk_* keys.
 */

export type StripeKeyMode = 'test' | 'live' | 'unknown'

/** Trim, strip quotes/BOM — common when pasting into Supabase secrets. */
export function normalizeStripeSecretKey(raw: string | undefined): string {
  let s = String(raw ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
  if (!s) return ''
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  return s
}

/** Read STRIPE_SECRET_KEY from Deno.env (normalized). */
export function getStripeSecretKeyFromEnv(): string {
  return normalizeStripeSecretKey(Deno.env.get('STRIPE_SECRET_KEY'))
}

export function stripeKeyMode(key: string): StripeKeyMode {
  const k = normalizeStripeSecretKey(key)
  if (k.startsWith('sk_test_')) return 'test'
  if (k.startsWith('sk_live_')) return 'live'
  return 'unknown'
}

/** Safe diagnostics — never log full key. */
export function logStripeSecretDiagnostics(raw: string | undefined): void {
  const key = normalizeStripeSecretKey(raw)
  const present = key.length > 0
  console.log('[stripe] STRIPE_SECRET_KEY diagnostics', {
    present,
    length: key.length,
    startsWithSkTest: key.startsWith('sk_test_'),
    startsWithSkLive: key.startsWith('sk_live_'),
    looksLikePublishablePk: key.startsWith('pk_'),
    looksLikeRestrictedRk: key.startsWith('rk_'),
    mode: stripeKeyMode(key),
    productionDeployment: isProductionStripeDeployment(),
  })
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
  const secret = normalizeStripeSecretKey(key)
  if (!secret) {
    return { ok: false, mode: 'unknown', error: 'Server misconfigured: STRIPE_SECRET_KEY is not set' }
  }

  if (secret.startsWith('pk_')) {
    return {
      ok: false,
      mode: 'unknown',
      error:
        'STRIPE_SECRET_KEY is a publishable key (pk_). In Supabase secrets use your secret key (sk_live_… or sk_test_…), not pk_.',
    }
  }

  if (secret.startsWith('rk_')) {
    return {
      ok: false,
      mode: 'unknown',
      error: 'STRIPE_SECRET_KEY is a restricted key (rk_). Use a standard secret key sk_live_… or sk_test_….',
    }
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

/** Customer-safe message — never expose secret key configuration details. */
export function customerFacingStripeConfigError(): string {
  return 'Card payments are temporarily unavailable. Please try again in a few minutes or contact us.'
}
