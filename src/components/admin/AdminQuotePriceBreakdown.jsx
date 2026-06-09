import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  buildStandardPricingDisplayRows,
  collectBreakdownDisplayLines,
  verifyBreakdownReconcilesWithTotal,
} from '../../lib/pricingBreakdownDisplay'
import { formatMoveSummaryCrewForPricing } from '../../lib/crewPricingRules'
import QuotePricingDebugPanel from '../quote-wizard/QuotePricingDebugPanel'

const liClass =
  'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-0.5 border-b border-slate-100 py-2.5 text-sm leading-snug last:border-0'

function Money({ amount, isDiscount = false, bold = false }) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return <span className="text-slate-400">—</span>
  const cls = bold
    ? 'text-base font-bold text-emerald-800'
    : isDiscount
      ? 'font-medium text-emerald-700'
      : 'font-medium text-slate-900'
  return (
    <span className={`shrink-0 tabular-nums ${cls}`}>
      {isDiscount && n !== 0 ? '−' : ''}£{Math.abs(n).toFixed(2)}
    </span>
  )
}

function BreakdownList({ rows, showZero = false }) {
  const visible = showZero ? rows : rows.filter((r) => Number(r.amount) !== 0 || r.isTotal)
  if (!visible.length) {
    return <p className="text-sm text-slate-500">No charge lines yet.</p>
  }
  return (
    <ul className="min-w-0 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 sm:px-3">
      {visible.map((row, i) => (
        <li
          key={`${row.label}-${i}`}
          className={`${liClass} ${row.isTotal ? 'border-t-2 border-slate-200 bg-white/80' : ''}`}
        >
          <span
            className={`min-w-0 break-words pr-1 ${row.isTotal ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
          >
            {row.label}
          </span>
          <span className="justify-self-end text-right">
            <Money amount={row.amount} isDiscount={row.isDiscount} bold={row.isTotal} />
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Full price breakdown for admin phone booking — every engine line + roll-up to total.
 * @param {{
 *   breakdown: import('../../lib/pricingCalculator.js').PriceBreakdown | null,
 *   serviceType?: string,
 *   wizard?: Record<string, unknown> | null,
 *   crewSettings?: import('../../lib/pricingCalculator.js').PricingSettings | null,
 *   compact?: boolean,
 *   sidebar?: boolean,
 * }} props
 */
export default function AdminQuotePriceBreakdown({
  breakdown,
  serviceType = '',
  wizard = null,
  crewSettings = null,
  compact = false,
  sidebar = false,
}) {
  const [showEngineDetail, setShowEngineDetail] = useState(false)
  const [showItemisedLines, setShowItemisedLines] = useState(!sidebar)

  if (!breakdown) return null

  const itemisedRows = collectBreakdownDisplayLines(breakdown)
  const rollupRows =
    Array.isArray(breakdown.standardDisplayRows) && breakdown.standardDisplayRows.length
      ? breakdown.standardDisplayRows
      : buildStandardPricingDisplayRows(breakdown)

  const estimatedTotal =
    breakdown.estimatedTotal != null && Number.isFinite(breakdown.estimatedTotal)
      ? breakdown.estimatedTotal
      : null

  const itemisedWithTotal = [
    ...itemisedRows,
    ...(estimatedTotal != null
      ? [{ label: 'Estimated total (engine)', amount: estimatedTotal, isTotal: true }]
      : []),
  ]

  const reconcile = verifyBreakdownReconcilesWithTotal(breakdown)
  const crewLabel = formatMoveSummaryCrewForPricing(
    wizard?.crewSize,
    breakdown.crewSizeUsedInPricing,
    crewSettings,
  )

  const narrow = compact || sidebar

  return (
    <div className={`min-w-0 ${narrow ? 'space-y-3' : 'space-y-5'}`}>
      <dl
        className={`grid gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs ${
          sidebar ? 'grid-cols-1' : 'sm:grid-cols-2'
        } ${compact && !sidebar ? '' : sidebar ? '' : 'sm:text-sm'}`}
      >
        <div className="min-w-0">
          <dt className="font-semibold text-slate-500">Service</dt>
          <dd className="break-words text-slate-900">{serviceType || '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="font-semibold text-slate-500">Route distance</dt>
          <dd className="break-words tabular-nums text-slate-900">
            {Number(wizard?.distanceMiles) > 0 ? `${Number(wizard.distanceMiles).toFixed(1)} mi` : '—'}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="font-semibold text-slate-500">Inventory volume</dt>
          <dd className="break-words tabular-nums text-slate-900">
            {breakdown.totalCubicMetres != null
              ? `${Number(breakdown.totalCubicMetres).toFixed(2)} m³`
              : '—'}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="font-semibold text-slate-500">Crew (selected → priced)</dt>
          <dd className="break-words text-slate-900">{crewLabel || '—'}</dd>
        </div>
        {breakdown.estimatedTravelHours != null && Number(breakdown.estimatedTravelHours) > 0 ? (
          <div className={`min-w-0 ${sidebar ? '' : 'sm:col-span-2'}`}>
            <dt className="font-semibold text-slate-500">Crew travel time (pricing)</dt>
            <dd className="break-words text-slate-900">
              ~{Number(breakdown.estimatedTravelHours).toFixed(1)} hr
              {breakdown.crewTravelHoursFromMapbox ? ' (Mapbox route)' : ' (fallback speed)'}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="min-w-0">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">
          Price breakdown
        </h4>
        {!sidebar ? (
          <p className="mb-2 mt-1 text-xs leading-relaxed text-slate-500">
            Grouped subtotals: mileage + volume + labour + access + extras + surcharges → scaling →
            minimums → discounts → final estimate.
          </p>
        ) : null}
        <BreakdownList rows={rollupRows} />
      </div>

      <div className="min-w-0 rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setShowItemisedLines((v) => !v)}
          className="flex min-h-[40px] w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-800"
          aria-expanded={showItemisedLines}
        >
          <span className="min-w-0 break-words">All charge lines (detail)</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${showItemisedLines ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {showItemisedLines ? (
          <div className="border-t border-slate-100 px-1 pb-2">
            {!sidebar ? (
              <p className="px-2 pb-2 pt-2 text-xs leading-relaxed text-slate-500">
                Each row from the pricing engine (distance, volume, access, extras, surcharges,
                scaling, discounts, minimums).
              </p>
            ) : null}
            <BreakdownList rows={itemisedWithTotal} />
          </div>
        ) : null}
      </div>

      {!reconcile.ok ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Roll-up check: display rows differ from engine total by £{Math.abs(reconcile.delta).toFixed(2)}.
          Trust the <strong>Estimated total</strong> above.
        </p>
      ) : null}

      {!compact ? (
      <div className="rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setShowEngineDetail((v) => !v)}
          className="flex min-h-[44px] w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm font-semibold text-slate-800"
          aria-expanded={showEngineDetail}
        >
          <span>Technical pricing detail (route, volume bands, labour maths)</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${showEngineDetail ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {showEngineDetail ? (
          <div className="border-t border-slate-200 px-2 pb-2">
            <QuotePricingDebugPanel
              pricingBreakdown={breakdown}
              estimatedTotal={estimatedTotal}
              forceVisible
              defaultOpen
              className="!border-0 !bg-transparent"
            />
          </div>
        ) : null}
      </div>
      ) : null}
    </div>
  )
}
