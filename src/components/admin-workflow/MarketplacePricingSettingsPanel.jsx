import { useCallback, useEffect, useState } from 'react'
import { DELAY_OPTIONS } from '../../lib/autoMarketplacePublish'
import {
  loadMarketplacePricingDefaults,
  saveMarketplacePricingDefaults,
} from '../../lib/marketplacePricingDefaultsStore'
import { recalcAvailableJobsPayoutsAll, recalcMarketplacePayoutsAll } from '../../lib/marketplacePayoutApply'
import { useProtectedMarketplaceSettingsUnlock } from '../../hooks/useProtectedMarketplaceSettingsUnlock'
import ProtectedMarketplaceSettingsUnlockBar, {
  ProtectedFieldLabel,
} from '../admin/ProtectedMarketplaceSettingsUnlockBar'

const labelCls = 'mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500'
const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'

/**
 * @param {{
 *   marketplaceQuotes: Record<string, unknown>[],
 *   onApplied: () => void | Promise<void>,
 *   onSettingsSaved?: () => void,
 *   recalcScope?: 'marketplace' | 'available',
 *   compact?: boolean,
 *   embedded?: boolean,
 * }} props
 */
export default function MarketplacePricingSettingsPanel({
  marketplaceQuotes,
  onApplied,
  onSettingsSaved,
  recalcScope = 'marketplace',
  compact = false,
  embedded = false,
}) {
  const quotes = Array.isArray(marketplaceQuotes) ? marketplaceQuotes : []
  const [deductionType, setDeductionType] = useState('percentage')
  const [deductionValue, setDeductionValue] = useState('25')
  const [defaultMarginPct, setDefaultMarginPct] = useState('20')
  const [useMarginEstimates, setUseMarginEstimates] = useState(true)
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [autoDelay, setAutoDelay] = useState(10)
  const [autoMinValue, setAutoMinValue] = useState('')
  const [autoMaxMiles, setAutoMaxMiles] = useState('')
  const [autoServices, setAutoServices] = useState('')
  const [autoExcludeUrgent, setAutoExcludeUrgent] = useState(false)
  const [confirmAutoOpen, setConfirmAutoOpen] = useState(false)
  const [unlockModalOpen, setUnlockModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const { unlocked, remainingMs, unlock, lock } = useProtectedMarketplaceSettingsUnlock()

  const hydrate = useCallback(() => {
    const d = loadMarketplacePricingDefaults()
    setDeductionType(d.deductionType)
    setDeductionValue(String(d.deductionValue))
    setDefaultMarginPct(String(d.defaultPlatformMarginPercent))
    setUseMarginEstimates(d.useDefaultMarginEstimates)
    setAutoEnabled(d.autoMarketplace.enabled)
    setAutoDelay(d.autoMarketplace.delayMinutes)
    setAutoMinValue(
      d.autoMarketplace.minJobValueGbp != null ? String(d.autoMarketplace.minJobValueGbp) : '',
    )
    setAutoMaxMiles(
      d.autoMarketplace.maxDistanceMiles != null ? String(d.autoMarketplace.maxDistanceMiles) : '',
    )
    setAutoServices(d.autoMarketplace.serviceFilters.join(', '))
    setAutoExcludeUrgent(d.autoMarketplace.excludeSameDayUrgent)
  }, [])

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const buildPayload = useCallback(() => {
    const v = parseFloat(String(deductionValue).replace(/,/g, ''))
    const margin = parseFloat(String(defaultMarginPct).replace(/,/g, ''))
    const minV = autoMinValue.trim() === '' ? null : parseFloat(autoMinValue.replace(/,/g, ''))
    const maxM = autoMaxMiles.trim() === '' ? null : parseFloat(autoMaxMiles.replace(/,/g, ''))
    return {
      deductionType: deductionType === 'fixed' ? 'fixed' : 'percentage',
      deductionValue: Number.isFinite(v) && v >= 0 ? v : 25,
      defaultPlatformMarginPercent:
        Number.isFinite(margin) && margin >= 0 && margin <= 100 ? margin : 20,
      useDefaultMarginEstimates: useMarginEstimates,
      autoMarketplace: {
        enabled: autoEnabled,
        delayMinutes: DELAY_OPTIONS.includes(autoDelay) ? autoDelay : 10,
        minJobValueGbp: Number.isFinite(minV) && minV > 0 ? minV : null,
        maxDistanceMiles: Number.isFinite(maxM) && maxM > 0 ? maxM : null,
        serviceFilters: autoServices
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        excludeSameDayUrgent: autoExcludeUrgent,
      },
    }
  }, [
    deductionType,
    deductionValue,
    defaultMarginPct,
    useMarginEstimates,
    autoEnabled,
    autoDelay,
    autoMinValue,
    autoMaxMiles,
    autoServices,
    autoExcludeUrgent,
  ])

  const saveAllSettings = useCallback(() => {
    const v = parseFloat(String(deductionValue).replace(/,/g, ''))
    if (!Number.isFinite(v) || v < 0) {
      setMsg('Enter a valid marketplace deduction value.')
      return
    }
    if (deductionType === 'percentage' && v > 100) {
      setMsg('Percentage cannot exceed 100.')
      return
    }

    const stored = loadMarketplacePricingDefaults()
    const payload = buildPayload()

    if (unlocked) {
      const margin = parseFloat(String(defaultMarginPct).replace(/,/g, ''))
      if (!Number.isFinite(margin) || margin < 0 || margin > 100) {
        setMsg('Default platform margin must be between 0 and 100.')
        return
      }
    } else {
      payload.defaultPlatformMarginPercent = stored.defaultPlatformMarginPercent
      payload.useDefaultMarginEstimates = stored.useDefaultMarginEstimates
      payload.autoMarketplace = { ...stored.autoMarketplace }
    }

    saveMarketplacePricingDefaults(payload)
    setMsg(unlocked ? 'Settings saved.' : 'Deduction settings saved (protected sections unchanged).')
    onSettingsSaved?.()
    window.setTimeout(() => setMsg(''), 4000)
  }, [buildPayload, deductionType, deductionValue, defaultMarginPct, unlocked, onSettingsSaved])

  const onAutoToggle = useCallback(
    (next) => {
      if (!unlocked) {
        setUnlockModalOpen(true)
        return
      }
      if (next && !autoEnabled) {
        setConfirmAutoOpen(true)
        return
      }
      setAutoEnabled(next)
    },
    [autoEnabled, unlocked],
  )

  const confirmEnableAuto = useCallback(() => {
    if (!unlocked) {
      setConfirmAutoOpen(false)
      setUnlockModalOpen(true)
      return
    }
    setAutoEnabled(true)
    setConfirmAutoOpen(false)
    const payload = buildPayload()
    payload.autoMarketplace.enabled = true
    saveMarketplacePricingDefaults(payload)
    setMsg('Auto-send enabled and saved.')
    window.setTimeout(() => setMsg(''), 4000)
  }, [buildPayload, unlocked])

  const runApplyAll = useCallback(async () => {
    const isAvailable = recalcScope === 'available'
    if (
      !window.confirm(
        isAvailable
          ? 'Apply the current default deduction to every available job? Custom payout overrides will be cleared.'
          : 'Apply the current default deduction to every marketplace job? Custom payout overrides will be cleared.',
      )
    )
      return
    setBusy(true)
    setMsg('')
    try {
      if (isAvailable) {
        await recalcAvailableJobsPayoutsAll(quotes, true)
      } else {
        await recalcMarketplacePayoutsAll(quotes, true)
      }
      setMsg(isAvailable ? 'All available job payouts updated.' : 'All marketplace payouts updated.')
      await onApplied()
    } finally {
      setBusy(false)
      window.setTimeout(() => setMsg(''), 5000)
    }
  }, [quotes, onApplied, recalcScope])

  const runRecalc = useCallback(async () => {
    const isAvailable = recalcScope === 'available'
    setBusy(true)
    setMsg('')
    try {
      if (isAvailable) {
        await recalcAvailableJobsPayoutsAll(quotes, false)
      } else {
        await recalcMarketplacePayoutsAll(quotes, false)
      }
      setMsg('Payouts recalculated (custom overrides kept).')
      await onApplied()
    } finally {
      setBusy(false)
      window.setTimeout(() => setMsg(''), 5000)
    }
  }, [quotes, onApplied, recalcScope])

  const shell = embedded
    ? ''
    : compact
      ? 'rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm'
      : 'rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-4'

  const protectedDisabled = !unlocked
  const Wrapper = embedded ? 'div' : 'section'

  return (
    <Wrapper className={shell || undefined}>
      {!embedded ? (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Marketplace pricing settings</h3>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
              Internal rules only — customer totals and Stripe payments are not changed.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-[11px] leading-snug text-slate-600">
          Internal rules only — customer totals and Stripe payments are not changed.
        </p>
      )}

      <div className={`grid gap-3 sm:grid-cols-2 ${embedded ? 'mt-2' : 'mt-3'}`}>
        <label>
          <span className={labelCls}>Platform deduction type</span>
          <select
            value={deductionType}
            onChange={(e) => setDeductionType(e.target.value)}
            className={inputCls}
          >
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed amount (£)</option>
          </select>
        </label>
        <label>
          <span className={labelCls}>
            Deduction value{deductionType === 'percentage' ? ' (%)' : ' (£)'}
          </span>
          <input
            type="number"
            step={deductionType === 'percentage' ? '1' : '0.01'}
            min="0"
            max={deductionType === 'percentage' ? '100' : undefined}
            value={deductionValue}
            onChange={(e) => setDeductionValue(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      <ProtectedMarketplaceSettingsUnlockBar
        unlocked={unlocked}
        remainingMs={remainingMs}
        onRequestUnlock={() => setUnlockModalOpen(true)}
        onLock={lock}
        unlockModalOpen={unlockModalOpen}
        onCloseUnlockModal={() => setUnlockModalOpen(false)}
        onUnlock={unlock}
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label>
          <span className={labelCls}>
            <ProtectedFieldLabel locked={protectedDisabled}>Default platform margin (%)</ProtectedFieldLabel>
          </span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            disabled={protectedDisabled}
            value={defaultMarginPct}
            onChange={(e) => setDefaultMarginPct(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex items-end gap-2 sm:pt-4">
          <input
            type="checkbox"
            disabled={protectedDisabled}
            checked={useMarginEstimates}
            onChange={(e) => setUseMarginEstimates(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 disabled:opacity-50"
          />
          <span className="text-xs leading-snug text-slate-700">
            <ProtectedFieldLabel locked={protectedDisabled}>
              Use default margin in Analytics when payout not saved
            </ProtectedFieldLabel>
          </span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
          <span className={labelCls}>
            <ProtectedFieldLabel locked={protectedDisabled}>
              Auto-send Available Jobs to Marketplace
            </ProtectedFieldLabel>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={autoEnabled}
            disabled={protectedDisabled}
            onClick={() => onAutoToggle(!autoEnabled)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
              autoEnabled ? 'bg-amber-800 text-white' : 'border border-slate-200 bg-white text-slate-700'
            }`}
          >
            {autoEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <label>
          <span className={labelCls}>
            <ProtectedFieldLabel locked={protectedDisabled}>Delay before publishing</ProtectedFieldLabel>
          </span>
          <select
            value={String(autoDelay)}
            disabled={protectedDisabled || !autoEnabled}
            onChange={(e) => setAutoDelay(Number(e.target.value))}
            className={inputCls}
          >
            {DELAY_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelCls}>
            <ProtectedFieldLabel locked={protectedDisabled}>Minimum job value (£)</ProtectedFieldLabel>
          </span>
          <input
            type="number"
            min="0"
            step="1"
            disabled={protectedDisabled || !autoEnabled}
            value={autoMinValue}
            onChange={(e) => setAutoMinValue(e.target.value)}
            placeholder="No minimum"
            className={inputCls}
          />
        </label>
        <label>
          <span className={labelCls}>
            <ProtectedFieldLabel locked={protectedDisabled}>Maximum distance (miles)</ProtectedFieldLabel>
          </span>
          <input
            type="number"
            min="0"
            step="1"
            disabled={protectedDisabled || !autoEnabled}
            value={autoMaxMiles}
            onChange={(e) => setAutoMaxMiles(e.target.value)}
            placeholder="No maximum"
            className={inputCls}
          />
        </label>
        <label>
          <span className={labelCls}>
            <ProtectedFieldLabel locked={protectedDisabled}>Service filters (optional)</ProtectedFieldLabel>
          </span>
          <input
            type="text"
            disabled={protectedDisabled || !autoEnabled}
            value={autoServices}
            onChange={(e) => setAutoServices(e.target.value)}
            placeholder="removals, man and van"
            className={inputCls}
          />
        </label>
        <label className="flex items-end gap-2 sm:pt-4">
          <input
            type="checkbox"
            disabled={protectedDisabled || !autoEnabled}
            checked={autoExcludeUrgent}
            onChange={(e) => setAutoExcludeUrgent(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 disabled:opacity-50"
          />
          <span className="text-xs text-slate-700">
            <ProtectedFieldLabel locked={protectedDisabled}>
              Exclude same-day urgent jobs
            </ProtectedFieldLabel>
          </span>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          disabled={busy}
          onClick={saveAllSettings}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Save settings
        </button>
        {compact && recalcScope === 'available' ? (
          <>
            <button
              type="button"
              disabled={busy || quotes.length === 0}
              onClick={() => void runApplyAll()}
              className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-950 hover:bg-violet-100 disabled:opacity-40"
            >
              Apply to all available jobs
            </button>
            <button
              type="button"
              disabled={busy || quotes.length === 0}
              onClick={() => void runRecalc()}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Recalculate payouts
            </button>
          </>
        ) : null}
        {!compact ? (
          <>
            <button
              type="button"
              disabled={busy || quotes.length === 0}
              onClick={() => void runApplyAll()}
              className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-950 hover:bg-violet-100 disabled:opacity-40"
            >
              {recalcScope === 'available' ? 'Apply to all available jobs' : 'Apply to all marketplace jobs'}
            </button>
            <button
              type="button"
              disabled={busy || quotes.length === 0}
              onClick={() => void runRecalc()}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Recalculate payouts
            </button>
          </>
        ) : null}
      </div>
      {msg ? <p className="mt-2 text-xs text-emerald-800">{msg}</p> : null}

      {confirmAutoOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setConfirmAutoOpen(false)}
        >
          <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h4 className="text-lg font-bold text-slate-900">Enable auto-send to Marketplace?</h4>
            <p className="mt-2 text-sm text-slate-700">
              Only eligible paid/deposit jobs will be sent automatically. Unpaid, cancelled, assigned, test, or held
              jobs will never be sent.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={confirmEnableAuto}
                className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900"
              >
                Enable auto-send
              </button>
              <button
                type="button"
                onClick={() => setConfirmAutoOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Wrapper>
  )
}

