import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildPayoutAccountingPatch,
  driverPayoutFromMargin,
  marginPctFromProfit,
  platformProfitFromMargin,
  platformProfitFromPayouts,
  PAYOUT_STATUSES,
  payoutStatusLabel,
  resolveJobPayoutAccounting,
} from '../../lib/jobPayoutAccounting'
import { resolveDriverPayoutSettlement } from '../../lib/driverPayoutSettlement'
import {
  fetchDriverChargesByQuoteIds,
  updateDriverCharge,
} from '../../lib/data/driverChargesRepository'
import DriverChargesList from '../admin-driver-charges/DriverChargesList'
import DriverChargeModal from '../admin-driver-charges/DriverChargeModal'
import DriverPayoutSettlementBadge from '../admin-driver-payments/DriverPayoutSettlementBadge'
import DriverPayoutSettlementActions from '../admin-driver-payments/DriverPayoutSettlementActions'
import { updateQuoteWorkflowAssignmentSilent } from '../../lib/data/quotesAdminRepository'
import {
  applyDefaultPlatformMarginPayoutEstimate,
  quoteHasSavedPayoutFields,
} from '../../lib/platformPayoutDefaults'
import { loadDefaultPlatformMarginPercent } from '../../lib/marketplacePricingDefaultsStore'
import JobStatusBadge from './JobStatusBadge'
import { AdminField } from './AdminJobUiPrimitives'

const shell =
  'overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]'

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

/**
 * @param {{
 *   q: Record<string, unknown>,
 *   onSaved?: () => void | Promise<void>,
 * }} props
 */
export default function JobDetailsPayoutSection({ q, onSaved }) {
  const [jobCharges, setJobCharges] = useState([])
  const [chargeModalOpen, setChargeModalOpen] = useState(false)

  const loadCharges = useCallback(async () => {
    const id = String(q?.id || '').trim()
    if (!id) {
      setJobCharges([])
      return
    }
    try {
      const rows = await fetchDriverChargesByQuoteIds([id])
      setJobCharges(rows)
    } catch {
      setJobCharges([])
    }
  }, [q?.id])

  useEffect(() => {
    void loadCharges()
  }, [loadCharges])

  const accounting = useMemo(
    () => resolveDriverPayoutSettlement(q, jobCharges),
    [q, jobCharges],
  )
  const [platformMarginPct, setPlatformMarginPct] = useState('')
  const [driverPayout, setDriverPayout] = useState('')
  const [partnerPayout, setPartnerPayout] = useState('')
  const [driverManual, setDriverManual] = useState(false)
  const [partnerManual, setPartnerManual] = useState(false)
  const [payoutStatus, setPayoutStatus] = useState('not_set')
  const [payoutNotes, setPayoutNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: null, text: '' })
  const customerTotal = accounting.customerTotal

  useEffect(() => {
    setPlatformMarginPct(
      accounting.platformMarginPercent != null ? String(accounting.platformMarginPercent) : '',
    )
    let driverDisplay = accounting.driverPayout
    if (
      driverDisplay == null &&
      accounting.platformMarginPercent != null &&
      customerTotal != null &&
      !accounting.driverManualOverride
    ) {
      driverDisplay = driverPayoutFromMargin(
        customerTotal,
        accounting.platformMarginPercent,
        accounting.partnerPayout ?? 0,
      )
    }
    setDriverPayout(driverDisplay != null ? String(driverDisplay) : '')
    setPartnerPayout(
      accounting.partnerPayout != null ? String(accounting.partnerPayout) : '',
    )
    setDriverManual(accounting.driverManualOverride)
    setPartnerManual(accounting.partnerManualOverride)
    setPayoutStatus(accounting.payoutStatus || 'not_set')
    setPayoutNotes(accounting.payoutNotes || '')
  }, [
    q.id,
    customerTotal,
    accounting.platformMarginPercent,
    accounting.driverPayout,
    accounting.partnerPayout,
    accounting.driverManualOverride,
    accounting.partnerManualOverride,
    accounting.payoutStatus,
    accounting.payoutNotes,
  ])

  const preview = useMemo(() => {
    const t = customerTotal
    if (t == null) {
      return {
        platformProfit: accounting.platformProfit,
        marginPct: accounting.marginPct,
        driverPayout: null,
      }
    }

    const dRaw = driverPayout.trim() === '' ? null : Number(driverPayout)
    const pRaw = partnerPayout.trim() === '' ? null : Number(partnerPayout)
    const mRaw = platformMarginPct.trim() === '' ? null : Number(platformMarginPct)

    if (driverManual || partnerManual) {
      const profit = platformProfitFromPayouts(
        t,
        dRaw != null && Number.isFinite(dRaw) ? dRaw : 0,
        pRaw != null && Number.isFinite(pRaw) ? pRaw : 0,
      )
      return {
        platformProfit: profit,
        marginPct: marginPctFromProfit(t, profit),
        driverPayout: dRaw,
        partnerPayout: pRaw,
      }
    }

    if (mRaw != null && Number.isFinite(mRaw)) {
      const profit = platformProfitFromMargin(t, mRaw)
      const partner = pRaw != null && Number.isFinite(pRaw) ? pRaw : 0
      const driver = driverPayoutFromMargin(t, mRaw, partner)
      return {
        platformProfit: profit,
        marginPct: mRaw,
        driverPayout: driver,
        partnerPayout: pRaw,
      }
    }

    const profit = platformProfitFromPayouts(
      t,
      dRaw != null && Number.isFinite(dRaw) ? dRaw : 0,
      pRaw != null && Number.isFinite(pRaw) ? pRaw : 0,
    )
    return {
      platformProfit: profit,
      marginPct: marginPctFromProfit(t, profit),
      driverPayout: dRaw,
      partnerPayout: pRaw,
    }
  }, [
    customerTotal,
    platformMarginPct,
    driverPayout,
    partnerPayout,
    driverManual,
    partnerManual,
    accounting.platformProfit,
    accounting.marginPct,
  ])

  function applyMarginToDriverPayout() {
    const t = customerTotal
    const m = Number(platformMarginPct)
    if (t == null || !Number.isFinite(m)) return
    const partner = partnerPayout.trim() === '' ? 0 : Number(partnerPayout)
    const driver = driverPayoutFromMargin(t, m, Number.isFinite(partner) ? partner : 0)
    if (driver != null && !driverManual) {
      setDriverPayout(String(driver))
    }
    setDriverManual(false)
    setPartnerManual(false)
  }

  function onMarginChange(value) {
    setPlatformMarginPct(value)
    const t = customerTotal
    const m = parseFloat(String(value).replace(/,/g, ''))
    if (t == null || !Number.isFinite(m) || driverManual || partnerManual) return
    const partner = partnerPayout.trim() === '' ? 0 : Number(partnerPayout)
    const driver = driverPayoutFromMargin(t, m, Number.isFinite(partner) ? partner : 0)
    if (driver != null) setDriverPayout(String(driver))
  }

  async function save() {
    setSaving(true)
    setMessage({ type: null, text: '' })
    try {
      const patch = buildPayoutAccountingPatch({
        platformMarginPercent: platformMarginPct.trim() === '' ? null : platformMarginPct,
        driverPayoutAmount: driverPayout.trim() === '' ? null : driverPayout,
        partnerPayoutAmount: partnerPayout.trim() === '' ? null : partnerPayout,
        driverPayoutManualOverride: driverManual,
        partnerPayoutManualOverride: partnerManual,
        payoutStatus,
        payoutNotes,
        customerTotalForProfit: customerTotal,
        driverPayoutForCalc: driverPayout.trim() === '' ? 0 : Number(driverPayout),
        partnerPayoutForCalc: partnerPayout.trim() === '' ? 0 : Number(partnerPayout),
        skipAutoDriver: driverManual,
      })
      const result = await updateQuoteWorkflowAssignmentSilent(String(q.id), patch)
      if (!result.savedRemote) {
        setMessage({ type: 'err', text: 'Could not save payout fields to the database.' })
        return
      }
      setMessage({ type: 'ok', text: 'Payout & profit saved.' })
      await onSaved?.()
    } catch (e) {
      setMessage({ type: 'err', text: e?.message || 'Save failed.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={shell}>
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-slate-900">Payout &amp; Profit</h3>
          {accounting.payoutMissing ? (
            <JobStatusBadge label="Payout not set" tone="amber" />
          ) : null}
          {accounting.payoutIsEstimate ? (
            <JobStatusBadge label="Estimate (default margin)" tone="slate" />
          ) : null}
          <DriverPayoutSettlementBadge status={accounting.payoutSettlementStatus} />
          {driverManual || partnerManual ? (
            <JobStatusBadge label="Manual override" tone="violet" />
          ) : null}
        </div>
        <p className="mt-1 text-xs text-slate-600">
          Internal accounting only — does not change customer charges, quote totals, or Stripe payments.
        </p>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        <AdminField label="Customer total" value={money(customerTotal)} />
        <AdminField label="Amount paid" value={money(accounting.paid)} />
        <AdminField label="Balance due" value={money(accounting.remaining)} />
        <AdminField label="Assigned driver" value={accounting.driverName || '—'} />
        <AdminField label="Partner" value={accounting.partnerName || '—'} />
        <AdminField
          label="Driver payout (gross)"
          value={accounting.driverPayoutGross != null ? money(accounting.driverPayoutGross) : '—'}
        />
        <AdminField
          label="Driver deductions"
          value={
            accounting.driverDeductions != null ? `−${money(accounting.driverDeductions)}` : '—'
          }
        />
        <AdminField
          label="Net driver payout"
          value={accounting.driverPayoutNet != null ? money(accounting.driverPayoutNet) : '—'}
        />
        <AdminField
          label="Paid to driver"
          value={accounting.payoutPaidAmount != null ? money(accounting.payoutPaidAmount) : '—'}
        />
        <AdminField
          label="Remaining balance"
          value={
            accounting.payoutRemainingBalance != null
              ? money(accounting.payoutRemainingBalance)
              : '—'
          }
        />
        <AdminField
          label="Platform profit (gross)"
          value={
            accounting.platformProfitGross != null
              ? money(accounting.platformProfitGross)
              : preview.platformProfit != null
                ? money(preview.platformProfit)
                : '—'
          }
        />
        <AdminField
          label="Adjusted platform profit"
          value={
            accounting.platformProfitAdjusted != null
              ? money(accounting.platformProfitAdjusted)
              : '—'
          }
        />
        <AdminField
          label="Margin (preview)"
          value={preview.marginPct != null ? `${preview.marginPct}%` : '—'}
        />
        {accounting.marketplacePartnerPayout != null && partnerPayout === '' ? (
          <AdminField
            label="Marketplace payout (ref)"
            value={money(accounting.marketplacePartnerPayout)}
          />
        ) : null}
      </div>

      <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-5">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Margin &amp; payout split</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm sm:col-span-2 lg:col-span-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Platform margin (%)
            </span>
            <div className="mt-1 flex gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={platformMarginPct}
                onChange={(e) => onMarginChange(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="e.g. 20"
              />
              <button
                type="button"
                onClick={applyMarginToDriverPayout}
                disabled={customerTotal == null}
                className="shrink-0 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800 hover:bg-brand-100 disabled:opacity-50"
              >
                Apply
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Sets platform profit = customer total × margin %. Auto-fills driver payout unless manually
              overridden.
            </p>
          </label>
          <label className="block text-sm">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Driver payout (£)
              {driverManual ? (
                <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold normal-case text-violet-800">
                  Manual override
                </span>
              ) : null}
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={driverPayout}
              onChange={(e) => {
                setDriverPayout(e.target.value)
                setDriverManual(true)
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder={
                preview.driverPayout != null && !driverManual
                  ? String(preview.driverPayout)
                  : '0.00'
              }
            />
          </label>
          <label className="block text-sm">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Partner payout (£)
              {partnerManual ? (
                <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold normal-case text-violet-800">
                  Manual override
                </span>
              ) : null}
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={partnerPayout}
              onChange={(e) => {
                setPartnerPayout(e.target.value)
                setPartnerManual(true)
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="0.00"
            />
          </label>
        </div>

        {customerTotal != null && platformMarginPct.trim() !== '' ? (
          <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            Example: {money(customerTotal)} customer total at {platformMarginPct}% margin → platform profit{' '}
            {money(preview.platformProfit)}, driver payout{' '}
            {preview.driverPayout != null ? money(preview.driverPayout) : '—'}
            {partnerPayout.trim() ? `, partner ${money(Number(partnerPayout))}` : ''}.
          </p>
        ) : null}
      </div>

      {q.assigned_driver_id && accounting.driverPayoutNet != null ? (
        <div className="border-t border-slate-100 bg-emerald-50/30 px-4 py-4 sm:px-5">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">
            Driver payout settlement
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Record when you have paid the driver. Does not affect customer billing.
          </p>
          <div className="mt-3">
            <DriverPayoutSettlementActions
              quoteId={String(q.id)}
              quote={q}
              charges={jobCharges}
              settlement={accounting}
              onUpdated={async () => {
                await onSaved?.()
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Driver charges ({jobCharges.length})
          </p>
          {q.assigned_driver_id ? (
            <button
              type="button"
              onClick={() => setChargeModalOpen(true)}
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-900 hover:bg-rose-100"
            >
              Add driver charge
            </button>
          ) : null}
        </div>
        <div className="mt-3">
          <DriverChargesList
            charges={jobCharges}
            compact
            onNotesSaved={loadCharges}
            onWaive={(c) => void updateDriverCharge(String(c.id), { status: 'waived' }).then(loadCharges)}
            onDispute={(c) =>
              void updateDriverCharge(String(c.id), { status: 'disputed' }).then(loadCharges)
            }
            onCancel={(c) =>
              void updateDriverCharge(String(c.id), { status: 'cancelled' }).then(loadCharges)
            }
            onApply={(c) =>
              void updateDriverCharge(String(c.id), { status: 'applied' }).then(loadCharges)
            }
          />
        </div>
      </div>

      <DriverChargeModal
        open={chargeModalOpen}
        onClose={() => setChargeModalOpen(false)}
        onSaved={async () => {
          await loadCharges()
          await onSaved?.()
        }}
        initialDriverId={q.assigned_driver_id != null ? String(q.assigned_driver_id) : ''}
        initialQuoteId={q.id != null ? String(q.id) : null}
        initialQuoteRef={String(q.quote_ref || '')}
      />

      <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Payout status
            </span>
            <select
              value={payoutStatus}
              onChange={(e) => setPayoutStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {PAYOUT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Payout notes
            </span>
            <textarea
              rows={2}
              value={payoutNotes}
              onChange={(e) => setPayoutNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Internal finance notes…"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="min-h-[44px] rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save payout'}
          </button>
          {!quoteHasSavedPayoutFields(q) ? (
            <button
              type="button"
              disabled={saving || customerTotal == null}
              onClick={async () => {
                setSaving(true)
                setMessage({ type: null, text: '' })
                try {
                  const margin = loadDefaultPlatformMarginPercent()
                  setPlatformMarginPct(String(margin))
                  setDriverManual(false)
                  setPartnerManual(false)
                  const res = await applyDefaultPlatformMarginPayoutEstimate(String(q.id), q)
                  if (res.applied) {
                    setMessage({ type: 'ok', text: `Applied default margin (${margin}%).` })
                    await onSaved?.()
                  } else {
                    setMessage({ type: 'err', text: 'Could not apply default margin.' })
                  }
                } catch (e) {
                  setMessage({ type: 'err', text: e?.message || 'Apply failed.' })
                } finally {
                  setSaving(false)
                }
              }}
              className="min-h-[44px] rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-50"
            >
              Apply default margin
            </button>
          ) : null}
          {(driverManual || partnerManual) && platformMarginPct.trim() ? (
            <button
              type="button"
              onClick={() => {
                setDriverManual(false)
                setPartnerManual(false)
                applyMarginToDriverPayout()
              }}
              className="min-h-[44px] rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Recalc from margin %
            </button>
          ) : null}
          {message.text ? (
            <p
              className={`text-sm ${message.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`}
            >
              {message.text}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
