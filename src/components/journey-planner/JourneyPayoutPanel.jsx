import { useMemo, useState } from 'react'
import {
  readManualOverridesFromQuotes,
  readPerJobPayoutsFromQuotes,
  round2,
  splitJourneyDriverPayout,
} from '../../lib/journeyPayoutSplit'

function money(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `£${Number(n).toFixed(2)}`
}

/**
 * @param {{
 *   quotes: Record<string, unknown>[],
 *   totalPayoutInput: string,
 *   onTotalPayoutInputChange: (v: string) => void,
 *   manualOverrides: Record<string, number>,
 *   onManualOverridesChange: (next: Record<string, number>) => void,
 *   onApplySplit: () => void | Promise<void>,
 *   busy?: boolean,
 *   variant?: 'light' | 'dark',
 * }} props
 */
export default function JourneyPayoutPanel({
  quotes,
  totalPayoutInput,
  onTotalPayoutInputChange,
  manualOverrides,
  onManualOverridesChange,
  onApplySplit,
  busy = false,
  variant = 'light',
}) {
  const [editingJobId, setEditingJobId] = useState('')

  const quoteIds = useMemo(
    () => [...new Set(quotes.map((q) => String(q.id || '').trim()).filter(Boolean))],
    [quotes],
  )

  const totalNum = useMemo(() => {
    const raw = String(totalPayoutInput).trim().replace(/,/g, '')
    if (!raw) return null
    const n = parseFloat(raw)
    return Number.isFinite(n) && n >= 0 ? round2(n) : null
  }, [totalPayoutInput])

  const preview = useMemo(() => {
    if (totalNum == null || quoteIds.length === 0) return null
    return splitJourneyDriverPayout(totalNum, quoteIds, manualOverrides)
  }, [totalNum, quoteIds, manualOverrides])

  const savedFromQuotes = useMemo(() => readPerJobPayoutsFromQuotes(quotes), [quotes])

  const isDark = variant === 'dark'
  const shell = isDark
    ? 'rounded-xl border border-white/15 bg-white/5 p-4'
    : 'rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4'
  const labelCls = isDark
    ? 'text-[10px] font-semibold uppercase tracking-wide text-emerald-200'
    : 'text-[10px] font-semibold uppercase tracking-wide text-emerald-800'
  const inputCls = isDark
    ? 'mt-1 w-full rounded-lg border border-white/20 bg-slate-950/40 px-3 py-2 text-sm font-bold text-white'
    : 'mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-slate-900'

  function setJobOverride(quoteId, value) {
    const next = { ...manualOverrides }
    const raw = String(value).trim().replace(/,/g, '')
    if (raw === '') {
      delete next[quoteId]
    } else {
      const n = parseFloat(raw)
      if (Number.isFinite(n) && n >= 0) next[quoteId] = round2(n)
    }
    onManualOverridesChange(next)
  }

  return (
    <div className={shell}>
      <p className={labelCls}>Total journey driver payout</p>
      <p className={`mt-1 text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        Driver/partner offer for the whole journey — not deducted again from customer totals.
      </p>
      <input
        type="text"
        inputMode="decimal"
        value={totalPayoutInput}
        onChange={(e) => onTotalPayoutInputChange(e.target.value)}
        className={inputCls}
        placeholder="e.g. 333.00"
      />

      {preview ? (
        <div className={`mt-3 grid gap-2 text-sm sm:grid-cols-3 ${isDark ? 'text-emerald-50' : 'text-slate-800'}`}>
          <div>
            <span className="text-[10px] font-semibold uppercase opacity-70">Journey total</span>
            <p className="font-bold">{money(preview.total)}</p>
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase opacity-70">Jobs</span>
            <p className="font-bold">{quoteIds.length}</p>
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase opacity-70">Auto split (each)</span>
            <p className="font-bold">
              {preview.perJobAuto != null ? money(preview.perJobAuto) : 'Manual mix'}
            </p>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        disabled={busy || totalNum == null || quoteIds.length === 0}
        onClick={() => void onApplySplit()}
        className={`mt-3 min-h-[40px] rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-45 ${
          isDark
            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
            : 'bg-emerald-700 text-white hover:bg-emerald-800'
        }`}
      >
        {busy ? 'Saving…' : 'Apply split to all jobs'}
      </button>

      {quoteIds.length > 0 ? (
        <div className="mt-4">
          <p className={`${labelCls} mb-2`}>Per-job payout</p>
          <ul className={`space-y-1.5 text-xs ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {quotes.map((q) => {
              const id = String(q.id || '')
              const ref = String(q.quote_ref || id.slice(0, 8))
              const previewAmt = preview?.byQuoteId[id]
              const savedAmt = savedFromQuotes[id]
              const isManual = Boolean(manualOverrides[id] != null || q.driver_payout_manual_override)
              return (
                <li
                  key={id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2 py-1.5 ${
                    isDark ? 'border-white/10 bg-black/20' : 'border-slate-200/80 bg-white'
                  }`}
                >
                  <span className="font-mono font-semibold">{ref}</span>
                  {editingJobId === id ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      autoFocus
                      defaultValue={
                        manualOverrides[id] != null
                          ? String(manualOverrides[id])
                          : previewAmt != null
                            ? String(previewAmt)
                            : ''
                      }
                      onBlur={(e) => {
                        setJobOverride(id, e.target.value)
                        setEditingJobId('')
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setJobOverride(id, e.currentTarget.value)
                          setEditingJobId('')
                        }
                      }}
                      className="w-24 rounded border border-slate-300 px-2 py-0.5 text-right font-mono text-xs"
                    />
                  ) : (
                    <span className="tabular-nums font-bold text-violet-900">
                      {money(previewAmt ?? savedAmt)}
                      {isManual ? (
                        <span className="ml-1 text-[9px] font-bold uppercase text-violet-600">manual</span>
                      ) : null}
                    </span>
                  )}
                  <button
                    type="button"
                    className="text-[10px] font-semibold text-brand-700 hover:underline"
                    onClick={() => setEditingJobId(id)}
                  >
                    Edit
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
