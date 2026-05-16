import { useState } from 'react'
import { Link } from 'react-router-dom'
import { updateJourneyRow } from '../../lib/data/journeysRepository'

const btn =
  'min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45'

/**
 * @param {{ journey: Record<string, unknown>, onApplied: () => void | Promise<void> }} props
 */
export default function MarketplaceJourneyCardActions({ journey, onApplied }) {
  const [busy, setBusy] = useState(false)
  const j = journey && typeof journey === 'object' ? journey : {}
  const id = String(j.id || '')
  const listed = String(j.marketplace_visibility) === 'visible_in_marketplace'
  const hiddenFromPartners = Boolean(j.partner_dashboard_hidden)

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
      await updateJourneyRow(id, { partner_dashboard_hidden: true })
    })
  }

  async function onShow() {
    await run(async () => {
      await updateJourneyRow(id, { partner_dashboard_hidden: false })
    })
  }

  const plannerHref = `/admin/journey-planner?journey=${encodeURIComponent(id)}`

  if (!listed) return null

  return (
    <div className="mt-1 space-y-2 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || hiddenFromPartners} onClick={() => void onHide()} className={btn}>
          Hide from partners
        </button>
        <button type="button" disabled={busy || !hiddenFromPartners} onClick={() => void onShow()} className={btn}>
          Show to partners
        </button>
        <Link to={plannerHref} className={`${btn} inline-flex items-center justify-center`}>
          Adjust price
        </Link>
      </div>
    </div>
  )
}
