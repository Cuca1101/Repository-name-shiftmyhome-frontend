/**
 * Hide Stripe / server secret configuration errors from customers.
 * @param {string} [message]
 * @returns {string}
 */
export function sanitizePaymentErrorMessage(message) {
  const m = String(message || '').trim()
  if (!m) return 'Payment could not start. Please try again or contact us.'

  const looksInternal =
    /STRIPE_SECRET_KEY/i.test(m) ||
    /\bsk_test_/i.test(m) ||
    /\bsk_live_/i.test(m) ||
    /Server misconfigured/i.test(m) ||
    /SUPABASE_SERVICE_ROLE/i.test(m) ||
    /Invalid STRIPE/i.test(m) ||
    /publishable key \(pk_/i.test(m) ||
    /restricted key \(rk_/i.test(m) ||
    /stripe_config/i.test(m) ||
    /Edge Function not found/i.test(m)

  if (looksInternal) {
    return 'Card payments are temporarily unavailable. Please try again in a few minutes or contact us.'
  }

  return m
}
