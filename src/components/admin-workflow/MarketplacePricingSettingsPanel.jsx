import { useCallback, useEffect, useState } from 'react'
import {
  loadMarketplacePricingDefaults,
  saveMarketplacePricingDefaults,
} from '../../lib/marketplacePricingDefaultsStore'
import { recalcMarketplacePayoutsAll } from '../../lib/marketplacePayoutApply'

/**
 * @param {{ marketplaceQuotes: Record<string, unknown>[], onApplied: () => void | Promise<void> }} props
 */
export default function MarketplacePricingSettingsPanel({ marketplaceQuotes, onApplied }) {
  const quotes = Array.isArray(marketplaceQuotes) ? marketplaceQuotes : []
  const [deductionType, setDeductionType] = useState('percentage')
  const [deductionValue, setDeductionValue] = useState('25')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const d = loadMarketplacePricingDefaults()
    setDeductionType(d.deductionType)
    setDeductionValue(String(d.deductionValue))
  }, [])

  const saveDefaults = useCallback(() => {
    const v = parseFloat(String(deductionValue).replace(/,/g, ''))
    if (!Number.isFinite(v) || v < 0) {
      setMsg('Enter a valid deduction value.')
      return
    }
    if (deductionType === 'percentage' && v > 100) {
      setMsg('Percentage cannot exceed 100.')
      return
    }
    saveMarketplacePricingDefaults({
      deductionType: deductionType === 'fixed' ? 'fixed' : 'percentage',
      deductionValue: v,
    })
    setMsg('Default deduction saved.')
    window.setTimeout(() => setMsg(''), 4000)
  }, [deductionType, deductionValue])

  const runApplyAll = useCallback(async () => {
    if (
      !window.confirm(
        'Apply the current default deduction to every marketplace job? Custom payout overrides will be cleared.',
      )
    )
      return
    setBusy(true)
    setMsg('')
    try {
      await recalcMarketplacePayoutsAll(quotes, true)
      setMsg('All marketplace payouts updated.')
      await onApplied()
    } finally {
      setBusy(false)
      window.setTimeout(() => setMsg(''), 5000)
    }
  }, [quotes, onApplied])

  const runRecalc = useCallback(async () => {
    setBusy(true)
    setMsg('')
    try {
      await recalcMarketplacePayoutsAll(quotes, false)
      setMsg('Payouts recalculated (custom overrides kept).')
      await onApplied()
    } finally {
      setBusy(false)
      window.setTimeout(() => setMsg(''), 5000)
    }
  }, [quotes, onApplied])

  return (
    <section className="rounded-2xl border border-violet-200/80 bg-violet-50/40 p-5 shadow-sm sm:p-6">
      <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Marketplace pricing settings</h3>
      <p className="mt-1 text-sm text-slate-600">
        Customer totals and payments are never changed. Only partner payout and platform profit are derived from your
        deduction rules.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Platform deduction type
          </span>
          <select
            value={deductionType}
            onChange={(e) => setDeductionType(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm"
          >
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed amount (£)</option>
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Deduction value{deductionType === 'percentage' ? ' (%)' : ' (£)'}
          </span>
          <input
            type="number"
            step={deductionType === 'percentage' ? '1' : '0.01'}
            min="0"
            max={deductionType === 'percentage' ? '100' : undefined}
            value={deductionValue}
            onChange={(e) => setDeductionValue(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={saveDefaults}
          className="min-h-[44px] rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Save default marketplace deduction
        </button>
        <button
          type="button"
          disabled={busy || quotes.length === 0}
          onClick={() => void runApplyAll()}
          className="min-h-[44px] rounded-xl border border-violet-300 bg-white px-4 py-2.5 text-sm font-semibold text-violet-950 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Apply to all marketplace jobs
        </button>
        <button
          type="button"
          disabled={busy || quotes.length === 0}
          onClick={() => void runRecalc()}
          className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Recalculate payouts
        </button>
      </div>
      {msg ? <p className="mt-3 text-sm text-emerald-800">{msg}</p> : null}
    </section>
  )
}
