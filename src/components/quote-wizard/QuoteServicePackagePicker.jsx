import { useState } from 'react'
import { Check, Crown, Shield, Sparkles } from 'lucide-react'
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

function PackageCard({ pkg, selected, fee, blockedReason, onSelect }) {
  const isStandard = pkg.id === 'standard'
  const isPlatinum = pkg.id === 'platinum'
  const isPremium = pkg.id === 'premium'
  const Icon = isPlatinum ? Sparkles : isPremium ? Crown : Shield
  const features = packageFeatureLines(pkg)
  const exclusions = String(pkg.exclusionsText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

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
      className={`quote-package-card relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border-2 p-3 text-left transition sm:p-4 ${
        blockedReason
          ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-70'
          : selected && isPlatinum
            ? 'border-amber-300 bg-slate-950 text-white shadow-[0_14px_30px_-18px_rgba(251,191,36,0.85),inset_0_0_0_1px_rgba(251,191,36,0.35)]'
            : selected && isPremium
              ? 'border-blue-600 bg-gradient-to-b from-blue-50 to-white shadow-[0_14px_30px_-18px_rgba(37,99,235,0.55),inset_0_0_0_1px_rgba(37,99,235,0.14)]'
              : selected
                ? 'border-slate-900 bg-gradient-to-b from-slate-50 to-white shadow-[0_14px_30px_-18px_rgba(15,23,42,0.45)]'
                : isPlatinum
                  ? 'border-slate-800 bg-slate-950 text-white hover:border-amber-300/80'
                  : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      {selected ? (
        <span
          className={`pointer-events-none absolute inset-x-0 top-0 h-1 ${
            isPlatinum
              ? 'bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200'
              : isPremium
                ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-500'
                : 'bg-slate-900'
          }`}
          aria-hidden
        />
      ) : null}
      <span className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              isPlatinum
                ? 'bg-amber-300/15 text-amber-300'
                : selected && isPremium
                  ? 'bg-blue-600 text-white'
                  : selected
                    ? 'bg-slate-900 text-white'
                    : isPremium
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <span className={`text-sm font-bold ${isPlatinum ? 'text-white' : 'text-slate-900'}`}>{pkg.displayName}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className={`text-sm font-bold tabular-nums ${isPlatinum ? 'text-amber-200' : 'text-emerald-700'}`}>
            {isStandard || fee <= 0 ? 'Included' : `+${moneyLabel(fee)}`}
          </span>
          {selected ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                isPlatinum ? 'bg-amber-300 text-slate-950' : isPremium ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white'
              }`}
            >
              <Check className="h-3 w-3" aria-hidden />
              Selected
            </span>
          ) : null}
        </span>
      </span>
      {pkg.badge ? (
        <span
          className={`mt-2 inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            isPlatinum
              ? 'bg-amber-300 text-slate-950'
              : isPremium
                ? 'bg-blue-600 text-white'
                : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          {pkg.badge}
        </span>
      ) : null}
      <ul className={`mt-3 space-y-1.5 text-xs leading-snug ${isPlatinum ? 'text-slate-200' : 'text-slate-600'}`}>
        {features.map((line) => (
          <li key={line} className="flex gap-1.5">
            <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isPlatinum ? 'text-amber-300' : 'text-emerald-600'}`} aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      {!isStandard && pkg.customerTerms ? (
        <p className={`mt-3 text-[11px] leading-relaxed ${isPlatinum ? 'text-slate-300' : 'text-slate-500'}`}>
          {pkg.customerTerms}
        </p>
      ) : null}
      {!isStandard && exclusions.length ? <Exclusions lines={exclusions} light={isPlatinum} /> : null}
      {blockedReason ? <p className="mt-3 text-[11px] font-semibold leading-snug text-red-700">{blockedReason}</p> : null}
    </div>
  )
}

function Exclusions({ lines, light }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="mt-2 block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`text-[11px] font-semibold underline-offset-2 hover:underline ${light ? 'text-amber-200' : 'text-blue-700'}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide exclusions' : 'View exclusions'}
      </button>
      {open ? (
        <ul className={`mt-1.5 list-disc space-y-0.5 pl-4 text-[11px] ${light ? 'text-slate-300' : 'text-slate-500'}`}>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </span>
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
      <h3 id="quote-service-package-heading" className="text-lg font-bold text-slate-900">
        Choose your service
      </h3>
      <p className="mt-1 text-sm text-slate-600">Select the level of service that suits your move.</p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
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
