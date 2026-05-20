import { useMemo } from 'react'
import { Info, Minus, Plus } from 'lucide-react'
import {
  PACKING_MATERIALS_CATALOG,
  buildPackingWhatFromQuantities,
  formatPackingMaterialPriceHint,
  normalizePackingMaterialQuantities,
  parsePackingMaterialQuantities,
  sumBoxQuantities,
} from '../../lib/packingMaterialsCatalog'

function QtyStepper({ value, onChange, disabled, size = 'default' }) {
  const n = Math.max(0, Number(value) || 0)
  const btn =
    size === 'large'
      ? 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-800 disabled:opacity-40 active:scale-95'
      : 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-800 disabled:opacity-40 active:scale-95'

  return (
    <div className="flex shrink-0 items-center gap-1 self-start">
      <button
        type="button"
        disabled={disabled || n <= 0}
        onClick={() => onChange(n - 1)}
        className={btn}
        aria-label="Decrease"
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
      <span className="min-w-[1.5rem] text-center text-sm font-bold tabular-nums text-slate-900">{n}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(n + 1)}
        className={btn}
        aria-label="Increase"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </div>
  )
}

/**
 * Step 3 — packing materials quantity picker (mobile & desktop).
 * @param {{
 *   data: Record<string, unknown>,
 *   onChange: (next: Record<string, unknown>) => void,
 *   pricingSettings?: import('../../lib/pricingCalculator.js').PricingSettings | null,
 *   variant?: 'mobile' | 'desktop'
 * }} props
 */
export default function PackingMaterialsSection({
  data,
  onChange,
  pricingSettings = null,
  variant = 'desktop',
}) {
  const isMobile = variant === 'mobile'
  const card = isMobile
    ? 'min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm'
    : 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6'

  const materialQty = useMemo(
    () => parsePackingMaterialQuantities(data),
    [
      data.packingMaterialsQuantities,
      data.packingApproxBoxes,
      data.packingMaterialsDetail,
      data.packingWhat,
    ],
  )

  function set(patch) {
    onChange({ ...data, ...patch })
  }

  function setMaterialQty(id, qty) {
    const next = normalizePackingMaterialQuantities({
      ...materialQty,
      [id]: Math.max(0, qty),
    })
    const detail = buildPackingWhatFromQuantities(next)
    const any = PACKING_MATERIALS_CATALOG.some((m) => (next[m.id] || 0) > 0)
    set({
      packingMaterialsQuantities: next,
      packingApproxBoxes: sumBoxQuantities(next),
      packingMaterials: any,
      packingMaterialsDetail: detail,
      packingWhat: detail,
    })
  }

  return (
    <div className={card}>
      <p className="text-sm font-bold text-slate-900">Do you need packing materials?</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">
        Select materials and set quantities. Use + / − to adjust.
      </p>
      <div
        className="mt-3 flex gap-2.5 rounded-xl border border-sky-200/90 bg-sky-50/80 px-3 py-2.5 ring-1 ring-sky-100/80"
        role="note"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
        <p className="text-xs leading-relaxed text-sky-950/90 sm:text-sm">
          If you select packing materials, our team can bring them and help pack your items on moving day.
        </p>
      </div>
      <ul className="mt-3 space-y-2">
        {PACKING_MATERIALS_CATALOG.map((m) => {
          const qty = materialQty[m.id] || 0
          const selected = qty > 0
          const priceHint = formatPackingMaterialPriceHint(m, pricingSettings)
          return (
            <li
              key={m.id}
              className={`rounded-xl border p-3 transition ${
                selected ? 'border-brand-200 bg-brand-50/40' : 'border-slate-100 bg-slate-50/60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 break-words pr-1">
                  <p className="text-sm font-semibold leading-snug text-slate-900">{m.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{m.description}</p>
                  {priceHint ? (
                    <p className="mt-1 text-xs font-medium text-brand-700">{priceHint}</p>
                  ) : null}
                </div>
                <QtyStepper
                  value={qty}
                  onChange={(n) => setMaterialQty(m.id, n)}
                  size={isMobile ? 'default' : 'large'}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
