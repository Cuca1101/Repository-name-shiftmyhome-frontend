/**
 * Deposit amount validation for Stripe PaymentIntent / Checkout (admin pricing, not hardcoded £50).
 */

export const STRIPE_MIN_CHARGE_GBP = 0.3
export const STRIPE_MAX_CHARGE_GBP = 500_000

export function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function formatGbpLabel(amount: number): string {
  return `£${round2(amount).toFixed(2)}`
}

/**
 * @param {number} gbp Requested deposit (from frontend / admin pricing settings).
 * @param {number | null | undefined} estimatedTotal Optional cap from quote pricing.
 */
export function validateDepositAmountGbp(
  gbp: number,
  estimatedTotal?: number | null,
): { ok: boolean; amount?: number; error?: string } {
  const amount = round2(gbp)
  if (!Number.isFinite(amount) || amount < STRIPE_MIN_CHARGE_GBP) {
    return { ok: false, error: 'Invalid deposit amount' }
  }
  if (amount > STRIPE_MAX_CHARGE_GBP) {
    return { ok: false, error: 'Deposit amount is too high for card payment' }
  }
  if (estimatedTotal != null && Number.isFinite(Number(estimatedTotal))) {
    const total = round2(Number(estimatedTotal))
    if (amount > total + 0.01) {
      return {
        ok: false,
        error: `Deposit cannot exceed the estimated total (${formatGbpLabel(total)})`,
      }
    }
  }
  return { ok: true, amount }
}
