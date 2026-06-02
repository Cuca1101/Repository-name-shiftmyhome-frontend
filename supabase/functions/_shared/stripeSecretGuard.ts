import {
  buildStripeSecretDiagnostics,
  getStripeSecretKeyFromEnv,
  logStripeSecretDiagnostics,
  validateStripeSecretKey,
  type StripeKeyMode,
  type StripeSecretDiagnostics,
} from './stripeMode.ts'

export type StripeSecretGuardResult =
  | { ok: true; key: string; mode: StripeKeyMode }
  | { ok: false; logError: string; diagnostics: StripeSecretDiagnostics }

/** Log diagnostics, normalize key, validate — single entry for all payment Edge Functions. */
export function guardStripeSecretKey(): StripeSecretGuardResult {
  const raw = Deno.env.get('STRIPE_SECRET_KEY')
  const diagnostics = logStripeSecretDiagnostics(raw)
  const key = getStripeSecretKeyFromEnv()
  const check = validateStripeSecretKey(key)
  if (!check.ok) {
    const logError = check.error || 'STRIPE_SECRET_KEY invalid'
    console.error('[stripe] Secret key validation failed:', logError, diagnostics)
    return { ok: false, logError, diagnostics }
  }
  return { ok: true, key, mode: check.mode }
}

type JsonResponder = (body: unknown, status?: number) => Response

/** Unmasked stripe_config response for debugging (safe — no secret value in body). */
export function respondStripeConfigFailure(
  jsonResponse: JsonResponder,
  failure: Extract<StripeSecretGuardResult, { ok: false }>,
): Response {
  return jsonResponse(
    {
      error: failure.logError,
      code: 'stripe_config',
      diagnostics: failure.diagnostics,
    },
    500,
  )
}
