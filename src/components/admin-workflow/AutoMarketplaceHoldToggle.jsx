import { useState } from 'react'
import { isQuoteHeldFromAutoMarketplace, setAutoMarketplaceHold } from '../../lib/autoMarketplacePublish'
import { loadMarketplacePricingDefaults } from '../../lib/marketplacePricingDefaultsStore'

/**
 * @param {{
 *   q: Record<string, unknown>,
 *   onUpdated?: () => void | Promise<void>,
 * }} props
 */
export default function AutoMarketplaceHoldToggle({ q, onUpdated }) {
  const [busy, setBusy] = useState(false)
  const defs = loadMarketplacePricingDefaults()
  if (!defs.autoMarketplace.enabled) return null

  const id = String(q.id || '').trim()
  if (!id) return null

  const held = isQuoteHeldFromAutoMarketplace(q)

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation()
        setBusy(true)
        try {
          await setAutoMarketplaceHold(id, !held)
          await onUpdated?.()
        } finally {
          setBusy(false)
        }
      }}
      className={`rounded border px-2 py-0.5 text-[10px] font-semibold disabled:opacity-50 ${
        held
          ? 'border-slate-300 bg-slate-100 text-slate-800'
          : 'border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100'
      }`}
    >
      {busy ? '…' : held ? 'Release auto-send hold' : 'Hold from auto-marketplace'}
    </button>
  )
}
