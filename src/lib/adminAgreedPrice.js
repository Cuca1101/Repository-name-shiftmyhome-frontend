/**
 * Per-booking admin agreed price — does not change global Pricing Engine settings.
 */

/**
 * @param {Record<string, unknown> | null | undefined} leadOrQuote
 * @returns {number | null}
 */
export function resolveCalculatedTotal(leadOrQuote) {
  if (!leadOrQuote) return null
  const calc = Number(leadOrQuote.calculated_total)
  if (Number.isFinite(calc) && calc >= 0) return Math.round(calc * 100) / 100
  const est = Number(leadOrQuote.estimated_total)
  if (Number.isFinite(est) && est >= 0) return Math.round(est * 100) / 100
  return null
}

/**
 * Amount the customer must pay (admin override wins).
 * @param {Record<string, unknown> | null | undefined} leadOrQuote
 * @returns {number | null}
 */
export function resolveChargeableTotal(leadOrQuote) {
  if (!leadOrQuote) return null
  const agreed = Number(leadOrQuote.agreed_price)
  if (Number.isFinite(agreed) && agreed >= 0) return Math.round(agreed * 100) / 100
  const remaining = Number(leadOrQuote.remaining_balance)
  if (
    Number.isFinite(remaining) &&
    remaining >= 0 &&
    leadOrQuote.agreed_price == null &&
    leadOrQuote.calculated_total != null &&
    Number.isFinite(Number(leadOrQuote.estimated_total)) &&
    Math.abs(remaining - Number(leadOrQuote.estimated_total)) > 0.009
  ) {
    // Phone-booking legacy: remaining_balance held the final charge.
    return Math.round(remaining * 100) / 100
  }
  return resolveCalculatedTotal(leadOrQuote)
}

/**
 * @param {number | string | null | undefined} raw
 * @returns {{ ok: true, amount: number } | { ok: false, error: string }}
 */
export function parseAdminAgreedPriceInput(raw) {
  if (raw === '' || raw == null) {
    return { ok: false, error: 'Enter a final price (e.g. 250).' }
  }
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: 'Enter a valid price of £0 or more.' }
  }
  if (n > 0 && n < 1) {
    return { ok: false, error: 'Stripe requires at least £1.00 for a payment link.' }
  }
  return { ok: true, amount: Math.round(n * 100) / 100 }
}

/**
 * @param {number | null | undefined} pounds
 */
export function formatGbp(pounds) {
  if (pounds == null || !Number.isFinite(Number(pounds))) return '—'
  return `£${Number(pounds).toFixed(2)}`
}

/**
 * Build confirmation copy before saving an override.
 * @param {{ calculated: number | null, agreed: number, reason?: string }} params
 */
export function buildPriceOverrideConfirmMessage({ calculated, agreed, reason }) {
  const lines = [
    'Confirm admin price override for this booking only?',
    '',
    `Calculated price: ${formatGbp(calculated)}`,
    `Admin agreed price: ${formatGbp(agreed)}`,
  ]
  if (reason?.trim()) lines.push(`Reason: ${reason.trim()}`)
  lines.push('', 'Global Pricing Engine settings will not change.')
  return lines.join('\n')
}
