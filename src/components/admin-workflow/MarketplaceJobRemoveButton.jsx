import { useState } from 'react'
import { withdrawQuoteFromMarketplace } from '../../lib/marketplacePayoutApply'

/**
 * Full-width remove control — shown above “View Details” on marketplace job cards.
 * @param {{ quote: Record<string, unknown>, onApplied: () => void | Promise<void> }} props
 */
export default function MarketplaceJobRemoveButton({ quote, onApplied }) {
  const [busy, setBusy] = useState(false)
  const id = String(quote?.id || '')

  async function onRemove() {
    if (
      !window.confirm(
        'Remove this job from the marketplace? Partners will no longer see it; you can list it again from Available Jobs.',
      )
    ) {
      return
    }
    setBusy(true)
    try {
      await withdrawQuoteFromMarketplace(id, quote)
      await onApplied()
    } finally {
      setBusy(false)
    }
  }

  if (!id) return null

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void onRemove()}
      className="inline-flex min-h-[34px] w-full items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-1.5 text-center text-xs font-semibold text-red-800 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? 'Removing…' : 'Remove from marketplace'}
    </button>
  )
}
