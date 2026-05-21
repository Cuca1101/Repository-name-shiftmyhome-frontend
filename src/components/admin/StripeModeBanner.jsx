import { shouldShowStripeTestModeWarning, stripeTestModeWarningMessage } from '../../lib/stripeConfig'

/**
 * Admin-only: visible when publishable key is pk_test_ (or VITE_SHOW_STRIPE_TEST_UI=true).
 */
export default function StripeModeBanner() {
  if (!shouldShowStripeTestModeWarning()) return null

  return (
    <div
      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
    >
      {stripeTestModeWarningMessage()}
    </div>
  )
}
