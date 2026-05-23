import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { collectMobilePriceDebugRows } from '../../lib/mobilePriceDebugBreakdown'

/** Temporary debug UI — set false to hide without removing code. */
export const SHOW_PRICE_DEBUG = true

function formatAmount(amount, isDiscount) {
  const abs = Math.abs(amount).toFixed(2)
  return isDiscount ? `−£${abs}` : `£${abs}`
}

/**
 * Step 2 mobile-only collapsible pricing breakdown (read-only).
 * @param {{
 *   pricingBreakdown: import('../../lib/pricingCalculator.js').PriceBreakdown | null,
 *   estimatedTotal?: number | null,
 * }} props
 */
export default function MobileStep2PriceDebugCard({ pricingBreakdown, estimatedTotal }) {
  const [open, setOpen] = useState(false)

  if (!SHOW_PRICE_DEBUG) return null
  if (!pricingBreakdown) return null

  const rows = collectMobilePriceDebugRows(pricingBreakdown)
  const totalRow = rows.find((r) => r.isTotal)
  const lineRows = rows.filter((r) => !r.isTotal)
  if (!totalRow && lineRows.length === 0) return null

  const displayTotal =
    estimatedTotal != null && Number.isFinite(estimatedTotal)
      ? estimatedTotal
      : totalRow?.amount

  return (
    <div className="border-t border-slate-200 bg-slate-50/80 px-3 py-2 md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[40px] w-full min-w-0 items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="text-xs font-medium text-slate-700">
          {open ? 'Hide pricing breakdown' : 'Show pricing breakdown'}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mb-2 min-w-0 rounded-lg border border-slate-200/90 bg-white px-2.5 py-2">
            <ul className="min-w-0 space-y-1.5">
              {lineRows.map((row) => (
                <li
                  key={row.label}
                  className="flex min-w-0 items-baseline gap-1 text-[11px] leading-snug text-slate-700"
                >
                  <span className="min-w-0 shrink truncate">{row.label}</span>
                  <span
                    className="mx-0.5 min-w-[0.75rem] flex-1 border-b border-dotted border-slate-300"
                    aria-hidden
                  />
                  <span
                    className={`shrink-0 tabular-nums font-medium ${
                      row.isDiscount ? 'text-emerald-700' : 'text-slate-900'
                    }`}
                  >
                    {formatAmount(row.amount, row.isDiscount)}
                  </span>
                </li>
              ))}
            </ul>

            {displayTotal != null && Number.isFinite(displayTotal) ? (
              <>
                <div className="my-2 border-t border-slate-200" aria-hidden />
                <div className="flex min-w-0 items-baseline gap-1 text-[11px] leading-snug">
                  <span className="font-semibold text-slate-800">Final Estimated Total</span>
                  <span
                    className="mx-0.5 min-w-[0.75rem] flex-1 border-b border-dotted border-slate-300"
                    aria-hidden
                  />
                  <span className="shrink-0 tabular-nums text-sm font-bold text-emerald-700">
                    £{displayTotal.toFixed(2)}
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
