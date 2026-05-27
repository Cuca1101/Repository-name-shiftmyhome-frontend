import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  buildDriverPaymentsLedger,
  computeDriverPaymentsPlatformTotals,
  downloadCsv,
  driverLedgerJobsToCsv,
  markDriverJobsPaid,
} from '../../lib/driverPaymentsLedger'
import { buildDriverPaymentsEvidenceRows } from '../../lib/driverPaymentsEvidence'
import DriverPayoutSettlementBadge from './DriverPayoutSettlementBadge'
import DriverPayoutSettlementActions from './DriverPayoutSettlementActions'
import DriverChargeModal from '../admin-driver-charges/DriverChargeModal'
import JobDriverPayoutOverrideModal from '../admin-workflow/JobDriverPayoutOverrideModal'
import JobAcceptedPayoutAuditBlock from '../admin-workflow/JobAcceptedPayoutAuditBlock'
import { MANUAL_PAYOUT_CONFIRMED_LABEL } from '../../lib/jobAcceptedPaymentDisplay'
import { formatDateTimeUK } from '../../lib/formatDateDisplay'
import { driverChargeTypeLabel } from '../../lib/driverChargeConstants'

const card =
  'rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5'

const btn =
  'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-45'

function money(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `£${Number(n).toFixed(2)}`
}

/**
 * @param {{
 *   quotes: Record<string, unknown>[],
 *   charges: Array<Record<string, unknown>>,
 *   jobs?: Record<string, unknown>[],
 *   drivers: Array<{ id: string, name?: string, phone?: string, email?: string }>,
 *   auditLogs?: Array<Record<string, unknown>>,
 *   onUpdated?: () => void | Promise<void>,
 *   initialDriverId?: string,
 *   initialQuoteRef?: string,
 * }} props
 */
export default function DriverPaymentsDriverLedger({
  quotes,
  charges,
  jobs = [],
  drivers,
  auditLogs = [],
  onUpdated,
  initialDriverId = '',
  initialQuoteRef = '',
}) {
  const [expandedDriver, setExpandedDriver] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [editPayoutJob, setEditPayoutJob] = useState(null)
  const [addChargeDriver, setAddChargeDriver] = useState('')
  const [driverSearch, setDriverSearch] = useState('')
  const [jobRefFilter, setJobRefFilter] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (initialDriverId) setExpandedDriver(initialDriverId)
    if (initialQuoteRef) setJobRefFilter(initialQuoteRef)
  }, [initialDriverId, initialQuoteRef])

  const { jobRows, jobRowsError } = useMemo(() => {
    try {
      return {
        jobRows: buildDriverPaymentsEvidenceRows(
          Array.isArray(quotes) ? quotes : [],
          Array.isArray(charges) ? charges : [],
          Array.isArray(jobs) ? jobs : [],
        ),
        jobRowsError: '',
      }
    } catch (e) {
      return { jobRows: [], jobRowsError: e?.message || 'Could not build job list.' }
    }
  }, [quotes, charges, jobs])

  const platformTotals = useMemo(() => {
    try {
      return computeDriverPaymentsPlatformTotals(jobRows, Array.isArray(charges) ? charges : [])
    } catch {
      return {
        totalCustomerRevenue: 0,
        totalDriverPayouts: 0,
        totalPlatformProfit: 0,
        paidToDrivers: 0,
        pendingDriverPayouts: 0,
        activeCharges: 0,
        activeChargeCount: 0,
        jobCount: 0,
      }
    }
  }, [jobRows, charges])

  const { ledger, ledgerError } = useMemo(() => {
    try {
      return {
        ledger: buildDriverPaymentsLedger({
          drivers: Array.isArray(drivers) ? drivers : [],
          jobRows,
          auditLogs: Array.isArray(auditLogs) ? auditLogs : [],
        }),
        ledgerError: jobRowsError,
      }
    } catch (e) {
      return {
        ledger: { drivers: [] },
        ledgerError: e?.message || 'Could not build driver ledger.',
      }
    }
  }, [drivers, jobRows, auditLogs, jobRowsError])

  const refFilterNorm = jobRefFilter.trim().toLowerCase()

  function jobsForDriver(driver) {
    const jobs = driver.jobs || []
    if (!refFilterNorm) return jobs
    return jobs.filter(
      (j) =>
        String(j.quoteRef || '')
          .toLowerCase()
          .includes(refFilterNorm) ||
        String(j.quoteId || '').toLowerCase() === refFilterNorm,
    )
  }

  useEffect(() => {
    const driverList = Array.isArray(ledger?.drivers) ? ledger.drivers : []
    if (initialDriverId || !initialQuoteRef.trim() || driverList.length === 0) return
    const ref = initialQuoteRef.trim().toLowerCase()
    const match = driverList.find((d) =>
      (d.jobs || []).some(
        (j) =>
          String(j.quoteRef || '').toLowerCase() === ref ||
          String(j.quoteId || '').toLowerCase() === ref,
      ),
    )
    if (match) setExpandedDriver(match.driverId)
  }, [initialDriverId, initialQuoteRef, ledger.drivers])

  const filteredDrivers = useMemo(() => {
    const q = driverSearch.trim().toLowerCase()
    let list = Array.isArray(ledger?.drivers) ? ledger.drivers : []
    if (q) {
      list = list.filter(
        (d) =>
          String(d.driverName).toLowerCase().includes(q) ||
          String(d.phone).toLowerCase().includes(q) ||
          String(d.email).toLowerCase().includes(q),
      )
    }
    if (refFilterNorm) {
      list = list.filter((d) => jobsForDriver(d).length > 0)
    }
    return list
  }, [ledger.drivers, driverSearch, refFilterNorm])

  function toggleSelect(quoteId) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(quoteId)) next.delete(quoteId)
      else next.add(quoteId)
      return next
    })
  }

  async function runBulk(fn) {
    setBusy(true)
    try {
      await fn()
      await onUpdated?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {ledgerError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{ledgerError}</p>
      ) : null}
      {refFilterNorm ? (
        <p className="rounded-lg border border-brand-200 bg-brand-50/80 px-3 py-2 text-sm text-brand-950">
          Showing jobs matching <span className="font-mono font-semibold">{jobRefFilter}</span>
          <button
            type="button"
            className="ml-2 font-semibold underline"
            onClick={() => setJobRefFilter('')}
          >
            Clear filter
          </button>
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className={card}>
          <p className="text-[10px] font-bold uppercase text-slate-500">Customer revenue</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {money(platformTotals.totalCustomerRevenue)}
          </p>
        </div>
        <div className={card}>
          <p className="text-[10px] font-bold uppercase text-violet-800">Driver payouts</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-violet-950">
            {money(platformTotals.totalDriverPayouts)}
          </p>
        </div>
        <div className={card}>
          <p className="text-[10px] font-bold uppercase text-emerald-800">Platform profit</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-950">
            {money(platformTotals.totalPlatformProfit)}
          </p>
        </div>
        <div className={card}>
          <p className="text-[10px] font-bold uppercase text-brand-700">Paid to drivers</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-brand-900">
            {money(platformTotals.paidToDrivers)}
          </p>
        </div>
        <div className={card}>
          <p className="text-[10px] font-bold uppercase text-amber-800">Pending payouts</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-950">
            {money(platformTotals.pendingDriverPayouts)}
          </p>
        </div>
        <div className={card}>
          <p className="text-[10px] font-bold uppercase text-rose-700">Active charges</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-rose-950">
            {money(platformTotals.activeCharges)}
          </p>
          <p className="text-[10px] text-slate-500">{platformTotals.activeChargeCount} deductions</p>
        </div>
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">Drivers</h2>
            <p className="mt-1 text-xs text-slate-600">
              {filteredDrivers.length} drivers · {platformTotals.jobCount} jobs in ledger
            </p>
          </div>
          <input
            type="search"
            placeholder="Search driver…"
            value={driverSearch}
            onChange={(e) => setDriverSearch(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        {filteredDrivers.length === 0 && !ledgerError ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-600">
            {jobRows.length === 0
              ? 'No accepted jobs with assigned drivers yet. Assign drivers on Available Jobs or Job Accepted to see payout ledger rows here.'
              : refFilterNorm || driverSearch.trim()
                ? 'No drivers match your search or job filter.'
                : 'No drivers in fleet list — add drivers under Drivers admin, or jobs may use driver names without fleet IDs.'}
          </p>
        ) : null}

        <ul className="mt-4 space-y-2">
          {filteredDrivers.map((d) => {
            const open = expandedDriver === d.driverId
            const visibleJobs = jobsForDriver(d)
            const selectedJobs = visibleJobs.filter((j) => selected.has(j.quoteId))
            return (
              <li key={d.driverId} className="overflow-hidden rounded-xl border border-slate-200/90">
                <button
                  type="button"
                  onClick={() => setExpandedDriver(open ? '' : d.driverId)}
                  className="flex w-full flex-col gap-2 bg-slate-50/80 px-3 py-3 text-left hover:bg-slate-100/80 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{d.driverName}</p>
                    <p className="text-[11px] text-slate-600">
                      {[d.phone, d.email].filter(Boolean).join(' · ') || 'No contact on file'}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {d.jobCount} job{d.jobCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] sm:grid-cols-3 lg:grid-cols-6">
                    <div>
                      <dt className="text-slate-500">Gross pay</dt>
                      <dd className="font-bold tabular-nums text-violet-900">{money(d.grossDriverPayout)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Charges</dt>
                      <dd className="font-bold tabular-nums text-rose-800">−{money(d.deductions)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Net owed</dt>
                      <dd className="font-bold tabular-nums text-emerald-800">{money(d.netPayable)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Paid</dt>
                      <dd className="font-bold tabular-nums text-brand-800">{money(d.paid)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Remaining</dt>
                      <dd className="font-bold tabular-nums text-amber-800">{money(d.remaining)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Platform profit</dt>
                      <dd className="font-bold tabular-nums text-emerald-900">{money(d.platformProfit)}</dd>
                    </div>
                  </dl>
                </button>

                {open ? (
                  <div className="border-t border-slate-100 px-3 py-3">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy || d.remaining <= 0.005}
                        className={`${btn} border-emerald-200 bg-emerald-50 text-emerald-900`}
                        onClick={() =>
                          void runBulk(() =>
                            markDriverJobsPaid(
                              (d.jobs || []).filter(
                                (j) => j.driverPaidStatusKey !== 'paid' && j.remainingOwed > 0.005,
                              ),
                              `Paid all outstanding — ${d.driverName}`,
                            ),
                          )
                        }
                      >
                        Mark all unpaid as paid
                      </button>
                      <button
                        type="button"
                        disabled={busy || selectedJobs.length === 0}
                        className={`${btn} border-brand-200 bg-brand-50 text-brand-900`}
                        onClick={() =>
                          void runBulk(() =>
                            markDriverJobsPaid(selectedJobs, `Selected jobs paid — ${d.driverName}`),
                          )
                        }
                      >
                        Mark selected paid ({selectedJobs.length})
                      </button>
                      <button
                        type="button"
                        className={btn}
                        onClick={() =>
                          downloadCsv(
                            driverLedgerJobsToCsv(d),
                            `driver-${String(d.driverName).replace(/\s+/g, '-').toLowerCase()}-payouts.csv`,
                          )
                        }
                      >
                        Export driver CSV
                      </button>
                      <button
                        type="button"
                        className={`${btn} border-rose-200 text-rose-900`}
                        onClick={() => setAddChargeDriver(d.driverId)}
                      >
                        Add charge
                      </button>
                      <Link to="/admin/drivers" className={`${btn} no-underline`}>
                        Driver profile
                      </Link>
                    </div>

                    {(d.auditLogs || []).length > 0 ? (
                      <div className="mb-4 rounded-lg border border-violet-100 bg-violet-50/40 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-violet-900">
                          Payout override audit log
                        </p>
                        <ul className="mt-2 space-y-2">
                          {d.auditLogs.map((a) => (
                            <li key={a.id} className="text-[11px] text-slate-700">
                              <span className="font-mono font-semibold text-slate-900">{a.quoteRef}</span>
                              {' · '}
                              <span className="uppercase">
                                {String(a.action || 'manual_override').replace(/_/g, ' ')}
                              </span>
                              {' · '}
                              Default {money(a.defaultPayoutGbp)} → New {money(a.newPayoutGbp)}
                              {a.differenceGbp != null ? (
                                <span className={a.differenceGbp >= 0 ? ' text-emerald-800' : ' text-rose-800'}>
                                  {' '}
                                  ({a.differenceGbp >= 0 ? '+' : ''}
                                  {money(a.differenceGbp)})
                                </span>
                              ) : null}
                              {a.reason ? <span className="block italic text-slate-600">{a.reason}</span> : null}
                              <span className="block text-[10px] text-slate-500">
                                {a.adminEmail || 'Admin'} ·{' '}
                                {a.createdAt ? formatDateTimeUK(a.createdAt) : '—'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="min-w-[64rem] w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                            <th className="px-2 py-2"> </th>
                            <th className="px-2 py-2">Job</th>
                            <th className="px-2 py-2">Customer</th>
                            <th className="px-2 py-2">Date</th>
                            <th className="px-2 py-2 text-right">Customer £</th>
                            <th className="px-2 py-2 text-right">Platform £</th>
                            <th className="px-2 py-2 text-right">Driver £</th>
                            <th className="px-2 py-2">Override</th>
                            <th className="px-2 py-2 text-right">Net / owed</th>
                            <th className="px-2 py-2">Status</th>
                            <th className="px-2 py-2">Paid date</th>
                            <th className="px-2 py-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleJobs.map((j) => (
                            <Fragment key={j.quoteId}>
                              <tr className="border-b border-slate-100 align-top hover:bg-slate-50/80">
                                <td className="px-2 py-2">
                                  <input
                                    type="checkbox"
                                    checked={selected.has(j.quoteId)}
                                    onChange={() => toggleSelect(j.quoteId)}
                                    aria-label={`Select ${j.quoteRef}`}
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <Link
                                    to={`/admin/active-jobs/${encodeURIComponent(j.quoteId)}`}
                                    className="font-mono font-bold text-brand-700 hover:underline"
                                  >
                                    {j.quoteRef}
                                  </Link>
                                  <p className="text-[10px] text-slate-500">{j.jobStatus}</p>
                                </td>
                                <td className="px-2 py-2">{j.customerName}</td>
                                <td className="px-2 py-2 text-slate-700">{j.moveDateDisplay}</td>
                                <td className="px-2 py-2 text-right tabular-nums">{money(j.customerTotal)}</td>
                                <td className="px-2 py-2 text-right tabular-nums text-emerald-800">
                                  {money(j.platformProfit)}
                                </td>
                                <td className="px-2 py-2 text-right tabular-nums font-semibold text-violet-900">
                                  {money(j.driverPayout)}
                                </td>
                                <td className="max-w-[7rem] px-2 py-2">
                                  {j.manualPayoutOverride ? (
                                    <span
                                      className="rounded bg-violet-100 px-1 py-px text-[9px] font-bold uppercase text-violet-900"
                                      title={MANUAL_PAYOUT_CONFIRMED_LABEL}
                                    >
                                      Confirmed
                                    </span>
                                  ) : (
                                    '—'
                                  )}
                                  {j.payoutOverrideNote ? (
                                    <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-600">{j.payoutOverrideNote}</p>
                                  ) : null}
                                </td>
                                <td className="px-2 py-2 text-right">
                                  <p className="tabular-nums font-semibold">{money(j.netPayable)}</p>
                                  <p className="text-[10px] tabular-nums text-amber-800">Owed {money(j.remainingOwed)}</p>
                                </td>
                                <td className="px-2 py-2">
                                  <DriverPayoutSettlementBadge status={j.driverPaidStatusKey} />
                                </td>
                                <td className="px-2 py-2 text-slate-600">{j.driverPaymentDateDisplay}</td>
                                <td className="px-2 py-2">
                                  <div className="flex flex-col gap-1">
                                    <DriverPayoutSettlementActions
                                      quoteId={j.quoteId}
                                      quote={j.quote}
                                      charges={j.charges}
                                      settlement={{
                                        driverPayoutNet: j.netPayable,
                                        payoutRemainingBalance: j.remainingOwed,
                                        payoutSettlementStatus: j.driverPaidStatusKey,
                                      }}
                                      onUpdated={onUpdated}
                                      compact
                                    />
                                    <button type="button" className={btn} onClick={() => setEditPayoutJob(j)}>
                                      Edit payout
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {j.manualPayoutOverride ? (
                                <tr className="border-b border-violet-100/80 bg-violet-50/25">
                                  <td colSpan={11} className="px-3 py-2">
                                    <JobAcceptedPayoutAuditBlock
                                      audit={j.latestPayoutAudit}
                                      fallback={
                                        j.latestPayoutAudit
                                          ? null
                                          : {
                                              defaultPayoutGbp: j.defaultDriverPayout,
                                              newPayoutGbp: j.driverPayout,
                                              reason: j.payoutOverrideNote,
                                            }
                                      }
                                      compact
                                    />
                                  </td>
                                </tr>
                              ) : null}
                              {(j.charges || []).map((c) => (
                                <tr key={`${j.quoteId}-${c.id}`} className="bg-rose-50/30 text-[10px] text-slate-600">
                                  <td colSpan={12} className="px-3 py-1">
                                    <span className="font-medium text-rose-900">
                                      {driverChargeTypeLabel(c.chargeType)} −{money(c.amount)}
                                    </span>
                                    {' · '}
                                    {String(c.reason || '')}
                                  </td>
                                </tr>
                              ))}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>

      {editPayoutJob ? (
        <JobDriverPayoutOverrideModal
          open
          q={editPayoutJob.quote}
          onClose={() => setEditPayoutJob(null)}
          onSaved={async () => {
            setEditPayoutJob(null)
            await onUpdated?.()
          }}
        />
      ) : null}

      <DriverChargeModal
        open={Boolean(addChargeDriver)}
        onClose={() => setAddChargeDriver('')}
        onSaved={onUpdated}
        initialDriverId={addChargeDriver}
      />
    </div>
  )
}
