import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { SHOW_PRICE_DEBUG } from '../../lib/quotePricingDebugConfig'
import { collectMobilePriceDebugRows } from '../../lib/mobilePriceDebugBreakdown'

function formatGbp(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  return `£${n.toFixed(2)}`
}

function DebugRow({ label, value, mono = false }) {
  if (value == null || value === '') return null
  return (
    <div className="flex min-w-0 items-baseline gap-1 py-0.5 text-[11px] leading-snug text-slate-700">
      <span className="min-w-0 shrink text-slate-600">{label}</span>
      <span className="mx-0.5 min-w-[0.5rem] flex-1 border-b border-dotted border-slate-200" aria-hidden />
      <span className={`shrink-0 tabular-nums font-medium text-slate-900 ${mono ? 'font-mono text-[10px]' : ''}`}>
        {value}
      </span>
    </div>
  )
}

function DebugSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-md border border-slate-200/80 bg-slate-50/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[36px] w-full items-center justify-between gap-2 px-2 py-1.5 text-left"
        aria-expanded={open}
      >
        <span className="text-[11px] font-semibold text-slate-800">{title}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open ? <div className="space-y-0.5 border-t border-slate-200/80 px-2 py-1.5">{children}</div> : null}
    </div>
  )
}

/** @param {{ detail: import('../../lib/pricingCalculator.js').PriceBreakdown['pricingDebugDetail'] }} props */
function DetailedDebugSections({ detail }) {
  if (!detail) return null
  const r = detail.routeDuration
  const v = detail.volume
  const b = detail.minimumBase
  const l = detail.labour
  const c = detail.crewLogic
  const a = detail.accessCharges
  const mf = detail.mileageFuel
  const t = detail.totals
  const m = detail.metadata

  return (
    <div className="mt-2 space-y-1.5">
      <DebugSection title="1. Route & duration">
        <DebugRow label="Mapbox distance" value={`${r.mapboxDistanceMiles} mi`} mono />
        <DebugRow
          label="Mapbox duration"
          value={r.mapboxDurationMinutes != null ? `${r.mapboxDurationMinutes} min` : '—'}
          mono
        />
        <DebugRow label="Drive hours used" value={String(r.driveHoursUsed)} mono />
        <DebugRow label="Fallback speed (mph)" value={String(r.fallbackSpeedMph)} mono />
        <DebugRow label="Fallback speed used" value={r.usedFallbackSpeed ? 'Yes' : 'No'} />
        <DebugRow label="Duration source" value={r.durationSource} mono />
      </DebugSection>

      <DebugSection title="2. Volume">
        <DebugRow label="Total volume" value={`${v.totalVolumeM3} m³`} mono />
        <DebugRow label="Price per m³" value={formatGbp(v.pricePerCubicMetre)} />
        <DebugRow label="Volume multiplier" value={`×${v.volumeMultiplier} (${v.volumeMultiplierBand})`} mono />
        <DebugRow
          label="Multiplier source"
          value={v.volumeMultiplierSource === 'admin' ? 'Admin settings' : 'Default fallback'}
        />
        <DebugRow label="Volume price line" value={formatGbp(v.finalVolumePrice)} />
        <DebugRow label="Calculated subtotal (before multiplier)" value={formatGbp(v.calculatedSubtotalBeforeMultiplier)} />
        <DebugRow label="Scaled subtotal (after multiplier)" value={formatGbp(v.scaledSubtotalAfterMultiplier)} />
        {v.volumeScalingAmount > 0 ? (
          <DebugRow label="Volume scaling amount" value={formatGbp(v.volumeScalingAmount)} />
        ) : null}
      </DebugSection>

      <DebugSection title="3. Minimum base threshold" defaultOpen>
        <DebugRow label="Service base threshold" value={formatGbp(detail.minimumBase?.serviceBaseThreshold)} />
        <DebugRow label="First man base threshold" value={formatGbp(detail.minimumBase?.firstManBaseThreshold)} />
        <DebugRow label="Second man base threshold" value={formatGbp(detail.minimumBase?.secondManBaseThreshold)} />
        <DebugRow label="Third man base threshold" value={formatGbp(detail.minimumBase?.thirdManBaseThreshold)} />
        <DebugRow label="Fourth man base threshold" value={formatGbp(detail.minimumBase?.fourthManBaseThreshold)} />
        <DebugRow label="Minimum base threshold" value={formatGbp(detail.minimumBase?.minimumBaseThreshold)} />
        <DebugRow label="Minimum base adjustment" value={formatGbp(detail.minimumBase?.minimumBaseAdjustment)} />
        <DebugRow label="Base threshold applied" value={detail.minimumBase?.baseThresholdApplied ? 'Yes' : 'No'} />
        <p className="pt-1 text-[10px] leading-snug text-slate-500">{detail.minimumBase?.note}</p>
      </DebugSection>

      <DebugSection title="4. Labour">
        <DebugRow
          label="Drive hours (labour)"
          value={l.driveHoursUsedForLabour != null ? String(l.driveHoursUsedForLabour) : '—'}
          mono
        />
        <DebugRow
          label="Total operational hours"
          value={l.totalOperationalHours != null ? String(l.totalOperationalHours) : '—'}
          mono
        />
        {l.hourlySubtotals.map((row) => (
          <DebugRow
            key={row.role}
            label={`${row.label} (${row.hours} hr × £${row.hourlyRate.toFixed(2)})`}
            value={formatGbp(row.subtotal)}
          />
        ))}
        <DebugRow label="Total crew labour" value={formatGbp(l.totalCrewLabour)} />
        <p className="pt-1 text-[10px] leading-snug text-slate-500">{l.note}</p>
      </DebugSection>

      <DebugSection title="5. Crew logic">
        <DebugRow label="Selected crew" value={String(c.selectedCrewSize)} />
        <DebugRow label="Final crew (pricing)" value={String(c.finalCrewUsedForPricing)} />
        <DebugRow label="Auto-adjusted" value={c.autoAdjusted ? 'Yes' : 'No'} />
        <DebugRow label="Large move threshold (m³)" value={String(c.largeMoveThresholdM3)} />
        <DebugRow label="Large move triggered" value={c.largeMoveTriggered ? 'Yes' : 'No'} />
      </DebugSection>

      <DebugSection title="6. Access charges">
        <DebugRow label="Crew multiplier on access" value={a.crewMultiplierApplied ? 'Yes (bug!)' : 'No ✓'} />
        {a.items.length === 0 ? (
          <p className="text-[10px] text-slate-500">No access charges applied.</p>
        ) : (
          a.items.map((item, i) => (
            <div key={`${item.type}-${item.side}-${i}`} className="border-b border-slate-100 py-1 last:border-0">
              <DebugRow label={`${item.type} (${item.side})`} value={formatGbp(item.amount)} />
              <p className="text-[10px] leading-snug text-slate-500">{item.reason}</p>
            </div>
          ))
        )}
        <DebugRow label="Access total" value={formatGbp(a.accessTotal)} />
      </DebugSection>

      <DebugSection title="7. Mileage & fuel">
        <DebugRow label="Mileage formula" value={mf.mileageFormula} mono />
        <DebugRow label="Mileage price" value={formatGbp(mf.mileagePrice)} />
        <DebugRow label="Fuel enabled" value={mf.fuelSurchargeEnabled ? 'Yes' : 'No'} />
        {mf.fuelFormula ? <DebugRow label="Fuel formula" value={mf.fuelFormula} mono /> : null}
        <DebugRow label="Fuel surcharge" value={formatGbp(mf.fuelSurchargeAmount)} />
      </DebugSection>

      <DebugSection title="8. Extras">
        {detail.extras.length === 0 ? (
          <p className="text-[10px] text-slate-500">No extras.</p>
        ) : (
          detail.extras.map((row) => <DebugRow key={row.label} label={row.label} value={formatGbp(row.amount)} />)
        )}
      </DebugSection>

      <DebugSection title="9. Final totals">
        <DebugRow label="Calculated subtotal (before multiplier)" value={formatGbp(t.calculatedSubtotalBeforeMultiplier)} />
        <DebugRow label="Volume multiplier" value={`×${t.volumeMultiplier}`} mono />
        <DebugRow
          label="Multiplier source"
          value={detail.volume?.volumeMultiplierSource === 'admin' ? 'Admin settings' : 'Default fallback'}
        />
        <DebugRow label="Scaled subtotal" value={formatGbp(t.scaledSubtotal)} />
        <DebugRow label="Minimum base threshold" value={formatGbp(t.minimumBaseThreshold)} />
        <DebugRow label="Minimum base adjustment" value={formatGbp(t.minimumBaseAdjustment)} />
        <DebugRow label="Minimum job price" value={formatGbp(t.minimumJobPrice)} />
        <DebugRow label="Minimum job adjustment" value={formatGbp(t.minimumJobAdjustment)} />
        <DebugRow label="Total minimum adjustment" value={formatGbp(t.minimumApplied)} />
        <DebugRow label="Discounts" value={formatGbp(t.discountTotal)} />
        <DebugRow label="Final estimated total" value={formatGbp(t.finalEstimatedTotal)} />
      </DebugSection>

      <DebugSection title="10. Debug metadata">
        <DebugRow label="Pricing mode" value={m.pricingMode} mono />
        <DebugRow label="Hourly mode" value={m.hourlyMode ? 'Yes' : 'No'} />
        <DebugRow label="Legacy mode" value={m.legacyMode ? 'Yes' : 'No'} />
        <DebugRow label="Fallback logic used" value={m.fallbackLogicUsed ? 'Yes' : 'No'} />
        <DebugRow label="Crew multiplier on access" value={m.crewMultiplierOnAccess ? 'Yes' : 'No'} />
      </DebugSection>
    </div>
  )
}

function formatAmount(amount, isDiscount) {
  const abs = Math.abs(amount).toFixed(2)
  return isDiscount ? `−£${abs}` : `£${abs}`
}

/**
 * Collapsible admin/debug pricing breakdown for quote steps 2 & 3.
 * @param {{
 *   pricingBreakdown: import('../../lib/pricingCalculator.js').PriceBreakdown | null,
 *   estimatedTotal?: number | null,
 *   className?: string,
 * }} props
 */
export default function QuotePricingDebugPanel({ pricingBreakdown, estimatedTotal, className = '' }) {
  const [open, setOpen] = useState(false)

  if (!SHOW_PRICE_DEBUG) return null
  if (!pricingBreakdown) return null

  const rows = collectMobilePriceDebugRows(pricingBreakdown)
  const totalRow = rows.find((r) => r.isTotal)
  const lineRows = rows.filter((r) => !r.isTotal)
  const detail = pricingBreakdown.pricingDebugDetail

  const displayTotal =
    estimatedTotal != null && Number.isFinite(estimatedTotal)
      ? estimatedTotal
      : totalRow?.amount

  return (
    <div className={`border-t border-slate-200 bg-slate-50/80 px-3 py-2 ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[40px] w-full min-w-0 items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="text-xs font-medium text-slate-700">
          {open ? 'Hide debug pricing breakdown' : 'Debug pricing breakdown'}
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
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-amber-700/90">
            Admin / debug only
          </p>

          {lineRows.length > 0 ? (
            <div className="mb-2 min-w-0 rounded-lg border border-slate-200/90 bg-white px-2.5 py-2 font-mono">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Summary rows
              </p>
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
          ) : null}

          <DetailedDebugSections detail={detail} />
        </div>
      </div>
    </div>
  )
}
