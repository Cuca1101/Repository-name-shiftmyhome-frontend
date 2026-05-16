import { useState } from 'react'
import {
  deleteJourneyDraft,
  withdrawJourneyFromMarketplace,
} from '../../lib/data/journeysRepository'

/**
 * Prominent remove / delete controls for marketplace journey cards.
 * @param {{ journey: Record<string, unknown>, onApplied: () => void | Promise<void> }} props
 */
export default function MarketplaceJourneyRemoveButtons({ journey, onApplied }) {
  const [busy, setBusy] = useState(false)
  const j = journey && typeof journey === 'object' ? journey : {}
  const id = String(j.id || '')
  const listed = String(j.marketplace_visibility) === 'visible_in_marketplace'

  if (!id || !listed) return null

  async function run(fn) {
    setBusy(true)
    try {
      await fn()
      await onApplied()
    } finally {
      setBusy(false)
    }
  }

  async function onRemoveListing() {
    if (!window.confirm('Remove this journey from the marketplace and unbundle its jobs?')) return
    await run(async () => {
      await withdrawJourneyFromMarketplace(id)
    })
  }

  async function onDeleteJourney() {
    if (
      !window.confirm(
        'Delete this journey permanently? It will be withdrawn from the marketplace first and bundled jobs will be released.',
      )
    ) {
      return
    }
    await run(async () => {
      await withdrawJourneyFromMarketplace(id)
      await deleteJourneyDraft(id)
    })
  }

  return (
    <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => void onRemoveListing()}
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border-2 border-red-300 bg-red-50 px-4 py-2.5 text-center text-sm font-bold text-red-900 shadow-sm hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Working…' : 'Remove from marketplace'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onDeleteJourney()}
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border-2 border-red-500 bg-red-600 px-4 py-2.5 text-center text-sm font-bold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Working…' : 'Delete journey'}
      </button>
    </div>
  )
}
