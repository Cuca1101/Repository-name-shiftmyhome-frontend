import {
  customerFacingStripeConfigError,
  getStripeSecretKeyFromEnv,
  logStripeSecretDiagnostics,
  validateStripeSecretKey,
  type StripeKeyMode,
} from './stripeMode.ts'

export type StripeSecretGuardResult =
  | { ok: true; key: string; mode: StripeKeyMode }
  | { ok: false; customerError: string; logError: string }

/** Log diagnostics, normalize key, validate — single entry for all payment Edge Functions. */
export function guardStripeSecretKey(): StripeSecretGuardResult {
  logStripeSecretDiagnostics(Deno.env.get('STRIPE_SECRET_KEY'))
  const key = getStripeSecretKeyFromEnv()
  const check = validateStripeSecretKey(key)
  if (!check.ok) {
    const logError = check.error || 'STRIPE_SECRET_KEY invalid'
    console.error('[stripe] Secret key validation failed:', logError)
    return { ok: false, customerError: customerFacingStripeConfigError(), logError }
  }
  return { ok: true, key, mode: check.mode }
}
