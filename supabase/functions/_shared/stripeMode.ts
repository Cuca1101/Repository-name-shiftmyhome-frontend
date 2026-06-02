/**
 * Stripe key mode detection for Edge Functions.
 * Secret key: Supabase Dashboard → Edge Functions → Secrets → STRIPE_SECRET_KEY only.
 */

export type StripeKeyMode = 'test' | 'live' | 'unknown'

export type StripeSecretDiagnostics = {
  present: boolean
  length: number
  startsWithSkTest: boolean
  startsWithSkLive: boolean
  looksLikePublishablePk: boolean
  looksLikeRestrictedRk: boolean
  mode: StripeKeyMode
  productionDeployment: boolean
}

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

export function buildStripeSecretDiagnostics(raw: string | undefined): StripeSecretDiagnostics {
  const key = normalizeStripeSecretKey(raw)
  return {
    present: key.length > 0,
    length: key.length,
    startsWithSkTest: key.startsWith('sk_test_'),
    startsWithSkLive: key.startsWith('sk_live_'),
    looksLikePublishablePk: key.startsWith('pk_'),
    looksLikeRestrictedRk: key.startsWith('rk_'),
    mode: stripeKeyMode(key),
    productionDeployment: isProductionStripeDeployment(),
  }
}

/** Safe diagnostics — never log full key. */
export function logStripeSecretDiagnostics(raw: string | undefined): StripeSecretDiagnostics {
  const diagnostics = buildStripeSecretDiagnostics(raw)
  console.log('[stripe] STRIPE_SECRET_KEY diagnostics', diagnostics)
  return diagnostics
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
 */
export function validateStripeSecretKey(key: string | undefined): {
  ok: boolean
  mode: StripeKeyMode
  error?: string
} {
  const secret = normalizeStripeSecretKey(key)
  if (!secret) {
    return { ok: false, mode: 'unknown', error: 'STRIPE_SECRET_KEY is not set in Supabase Edge Function secrets' }
  }

  if (secret.startsWith('pk_')) {
    return {
      ok: false,
      mode: 'unknown',
      error:
        'STRIPE_SECRET_KEY is a publishable key (pk_). Use secret key sk_live_… in Supabase secrets (not pk_).',
    }
  }

  if (secret.startsWith('rk_')) {
    return {
      ok: false,
      mode: 'unknown',
      error: 'STRIPE_SECRET_KEY is a restricted key (rk_). Use standard secret key sk_live_… or sk_test_….',
    }
  }

  const mode = stripeKeyMode(secret)
  if (mode === 'unknown') {
    return {
      ok: false,
      mode: 'unknown',
      error: 'STRIPE_SECRET_KEY must start with sk_test_ or sk_live_ (check for typos or extra spaces).',
    }
  }

  if (mode === 'test' && isProductionStripeDeployment()) {
    const allow = Deno.env.get('STRIPE_ALLOW_TEST_ON_PRODUCTION') === 'true'
    if (!allow) {
      return {
        ok: false,
        mode: 'test',
        error:
          'STRIPE_SECRET_KEY is sk_test_ but SITE_URL is production (shiftmyhome.co.uk). Set sk_live_… in Supabase secrets to match pk_live_ on the website.',
      }
    }
  }

  return { ok: true, mode }
}
