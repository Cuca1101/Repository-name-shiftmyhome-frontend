import { useState } from 'react'
import { Link } from 'react-router-dom'
import { mergedAdminWorkflowForQuote } from '../../lib/quoteAdminWorkflowMerge'
import { setManualMarketplacePayout, setPartnerDashboardHiddenForQuote } from '../../lib/marketplacePayoutApply'
import { getMarketplaceFinancePresentation } from '../../lib/marketplaceQuoteFinance'

const btn =
  'min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45'

/**
 * @param {{ quote: Record<string, unknown>, onApplied: () => void | Promise<void> }} props
 */
export default function MarketplaceJobCardActions({ quote, onApplied }) {
  const [busy, setBusy] = useState(false)
  const merged = mergedAdminWorkflowForQuote(quote)
  const listed = merged.marketplaceVisibility === 'visible_in_marketplace'
  const hiddenFromPartners = Boolean(merged.partnerDashboardHidden)
  const id = String(quote.id)

  async function run(fn) {
    setBusy(true)
    try {
      await fn()
      await onApplied()
    } finally {
      setBusy(false)
    }
  }

  async function onHide() {
    await run(async () => {
      await setPartnerDashboardHiddenForQuote(id, true)
    })
  }

  async function onShow() {
    await run(async () => {
      await setPartnerDashboardHiddenForQuote(id, false)
    })
  }

  async function onRecalc() {
    await run(async () => {
      await applyDefaultMarketplacePayoutToQuote(quote, { clearManualOverride: true })
    })
  }

  async function onEdit() {
    const pres = getMarketplaceFinancePresentation(quote)
    const current =
      pres.marketplacePayout != null && Number.isFinite(pres.marketplacePayout)
        ? pres.marketplacePayout.toFixed(2)
        : ''
    const raw = window.prompt('Marketplace payout (£)', current)
    if (raw == null) return
    const n = parseFloat(String(raw).replace(/,/g, ''))
    if (!Number.isFinite(n) || n < 0) return
    await run(async () => {
      await setManualMarketplacePayout(id, quote, n)
    })
  }

  if (!listed) return null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || hiddenFromPartners}
          onClick={() => void onHide()}
          className={btn}
        >
          Hide from partners
        </button>
        <button type="button" disabled={busy || !hiddenFromPartners} onClick={() => void onShow()} className={btn}>
          Show to partners
        </button>
        <button type="button" disabled={busy} onClick={() => void onEdit()} className={btn}>
          Edit payout
        </button>
        <Link
          to={`/admin/available-jobs/${id}`}
          className={`${btn} inline-flex items-center justify-center no-underline`}
        >
          View details
        </Link>
      </div>
    </div>
  )
}
