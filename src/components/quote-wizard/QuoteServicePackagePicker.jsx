import { useState } from 'react'
import { Box, Check, Crown, Sparkles } from 'lucide-react'
import { JOURNEY_VAN_CAPACITY_M3 } from '../../lib/journeySummary'
import {
  packageCapacityBlock,
  packageFeatureLines,
  packageFeeForBase,
  resolveServicePackages,
} from '../../lib/servicePackages'

function moneyLabel(n) {
  return `£${Number(n).toFixed(2)}`
}

function packagePreview(pkg) {
  if (pkg.id === 'standard') return 'Loading, transport & unloading'
  const bits = []
  if (Number(pkg.wrappingItems) > 0) bits.push('Extra wrapping')
  if (Number(pkg.waitingMinutes) > 0) bits.push(`${pkg.waitingMinutes} min waiting`)
  if (bits.length) return bits.join(' · ')
  return packageFeatureLines(pkg)[0] || pkg.description
}

function PackageCard({ pkg, selected, fee, blockedReason, onSelect }) {
  const [open, setOpen] = useState(false)
  const isStandard = pkg.id === 'standard'
  const isPlatinum = pkg.id === 'platinum'
  const isPremium = pkg.id === 'premium'
  const Icon = isPlatinum ? Crown : isPremium ? Sparkles : Box
  const features = packageFeatureLines(pkg)
  const preview = packagePreview(pkg)
  const exclusions = String(pkg.exclusionsText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const priceClass = selected ? (isPlatinum ? 'text-amber-300' : 'text-white') : 'text-slate-900'
  const mutedClass = selected
    ? isPlatinum
      ? 'text-slate-300'
      : isStandard
        ? 'text-slate-200'
        : 'text-blue-100'
    : 'text-slate-500'
  const linkClass = selected
    ? isPlatinum
      ? 'text-amber-200'
      : isStandard
        ? 'text-slate-100'
        : 'text-white'
    : isStandard
      ? 'text-slate-600'
      : 'text-blue-700'

  return (
    <div
      role="button"
      tabIndex={blockedReason ? -1 : 0}
      aria-disabled={Boolean(blockedReason)}
      aria-pressed={selected}
      onClick={() => {
        if (!blockedReason) onSelect(pkg.id)
      }}
      onKeyDown={(e) => {
        if (blockedReason) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(pkg.id)
        }
      }}
      className={`quote-package-card relative min-w-0 rounded-2xl border px-3 py-3 text-left transition ${
        blockedReason
          ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-70'
          : selected && isPlatinum
            ? 'border-amber-300 bg-[#071833] text-white shadow-[0_8px_24px_-18px_rgba(15,23,42,0.8)]'
            : selected && isStandard
              ? 'border-slate-400 bg-slate-600 text-white shadow-[0_8px_24px_-18px_rgba(71,85,105,0.8)]'
              : selected
                ? 'border-blue-600 bg-blue-600 text-white shadow-[0_8px_24px_-18px_rgba(37,99,235,0.75)]'
                : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <span className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isPlatinum
              ? 'bg-amber-300/15 text-amber-300'
              : selected
                ? 'bg-white/15 text-white'
                : isStandard
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-blue-50 text-blue-600'
          }`}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className={`block text-sm font-bold ${selected ? 'text-white' : 'text-slate-900'}`}>{pkg.displayName}</span>
              <span className={`mt-0.5 block text-xs leading-snug ${mutedClass}`}>{preview}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className={`text-sm font-bold tabular-nums ${priceClass}`}>
                {isStandard || fee <= 0 ? 'Included' : `+${moneyLabel(fee)}`}
              </span>
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                  selected
                    ? isPlatinum
                      ? 'border-amber-300 bg-amber-300'
                      : 'border-white bg-white'
                    : 'border-slate-300 bg-white'
                }`}
                aria-hidden
              >
                {selected ? (
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isPlatinum ? 'bg-[#071833]' : isStandard ? 'bg-slate-600' : 'bg-blue-600'
                    }`}
                  />
                ) : null}
              </span>
            </span>
          </span>
          <span className="mt-1 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`text-xs font-semibold ${linkClass}`}
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? 'Hide benefits' : 'View benefits'} <span aria-hidden>›</span>
            </button>
            {selected ? (
              <span className={`text-xs font-semibold ${isPlatinum ? 'text-amber-300' : isStandard ? 'text-slate-100' : 'text-white'}`}>Selected</span>
            ) : null}
          </span>
          {open ? (
            <div className={`mt-2 space-y-2 text-xs leading-snug ${selected ? (isPlatinum || isStandard ? 'text-slate-200' : 'text-blue-50') : 'text-slate-600'}`} onClick={(e) => e.stopPropagation()}>
              <ul className="space-y-1">
                {features.map((line) => (
                  <li key={line} className="flex gap-1.5">
                    <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${selected ? (isPlatinum ? 'text-amber-300' : 'text-white') : 'text-emerald-600'}`} aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              {pkg.customerTerms ? <p>{pkg.customerTerms}</p> : null}
              {exclusions.length ? (
                <div>
                  <p className="font-semibold">Not included</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {exclusions.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </span>
      </span>
      {blockedReason ? <p className="mt-2 text-[11px] font-semibold leading-snug text-red-700">{blockedReason}</p> : null}
    </div>
  )
}

/**
 * Step 3 package choice. Fees come from pricing settings and the date base quote.
 */
export default function QuoteServicePackagePicker({
  packageId = 'standard',
  baseTotal = null,
  declaredVolumeM3 = 0,
  pricingSettings = null,
  onChange,
}) {
  const packages = resolveServicePackages(pricingSettings)
  const cards = ['standard', 'premium', 'platinum']
    .map((id) => packages[id])
    .filter((pkg) => pkg.id === 'standard' || pkg.enabled !== false)
    .sort((a, b) => a.displayOrder - b.displayOrder)

  return (
    <section className="mt-5 min-w-0" aria-labelledby="quote-service-package-heading">
      <h3 id="quote-service-package-heading" className="text-base font-bold text-slate-900">
        Choose your service
      </h3>
      <div className="mt-3 grid grid-cols-1 gap-2 min-[1200px]:grid-cols-3 min-[1200px]:gap-3">
        {cards.map((pkg) => {
          const block = packageCapacityBlock({
            packageId: pkg.id,
            declaredVolumeM3,
            settings: pricingSettings,
            vehicleCapacityM3: JOURNEY_VAN_CAPACITY_M3,
          })
          const fee =
            baseTotal != null && Number.isFinite(baseTotal) ? packageFeeForBase(baseTotal, pkg) : 0
          return (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              selected={(packageId || 'standard') === pkg.id}
              fee={fee}
              blockedReason={block.blocked ? block.reason : ''}
              onSelect={(id) => onChange?.(id)}
            />
          )
        })}
      </div>
    </section>
  )
}
