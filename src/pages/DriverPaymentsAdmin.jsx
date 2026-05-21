import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchQuotesForAdmin } from '../lib/data/quotesAdminRepository'
import { fetchAllDriverCharges, updateDriverCharge } from '../lib/data/driverChargesRepository'
import { loadFleetDriversForAdmin } from '../lib/adminFleetDrivers'
import {
  buildDriverPaymentsOverview,
  buildDriverWeeklyEarnings,
} from '../lib/driverPaymentsModel'
import DriverChargesList from '../components/admin-driver-charges/DriverChargesList'
import DriverChargeModal from '../components/admin-driver-charges/DriverChargeModal'
import { sumDeductibleDriverCharges } from '../lib/driverChargeAccounting'
import { driverChargeTypeLabel } from '../lib/driverChargeConstants'
import { recordWeekDriverPayoutsPaid } from '../lib/driverPayoutSettlement'
import DriverPayoutSettlementBadge from '../components/admin-driver-payments/DriverPayoutSettlementBadge'
import DriverPayoutSettlementActions from '../components/admin-driver-payments/DriverPayoutSettlementActions'

const card =
  'rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5'

function money(n) {
  return `£${Number(n).toFixed(2)}`
}

export default function DriverPaymentsAdmin() {
  const [quotes, setQuotes] = useState([])
  const [charges, setCharges] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedDriver, setExpandedDriver] = useState('')
  const [expandedWeek, setExpandedWeek] = useState('')
  const [addChargeDriver, setAddChargeDriver] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [q, c, d] = await Promise.all([
        fetchQuotesForAdmin('all_paid', ''),
        fetchAllDriverCharges(),
        loadFleetDriversForAdmin(),
      ])
      setQuotes(q)
      setCharges(c)
      setDrivers(d)
    } catch (e) {
      setError(e?.message || 'Failed to load driver payments.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const overview = useMemo(
    () => buildDriverPaymentsOverview(quotes, charges, drivers),
    [quotes, charges, drivers],
  )

  const totals = useMemo(() => {
    let gross = 0
    let ded = 0
    let net = 0
    let paid = 0
    let pending = 0
    for (const r of overview.driverSummaries) {
      gross += r.gross
      ded += r.deductions
      net += r.net
      paid += r.paid
      pending += r.pending
    }
    return {
      gross,
      ded,
      net,
      paid,
      pending,
      chargeCount: charges.filter((c) => sumDeductibleDriverCharges([c]) > 0).length,
    }
  }, [overview, charges])

  async function setChargeStatus(charge, status) {
    await updateDriverCharge(String(charge.id), { status })
    await load()
  }

  return (
    <div className="space-y-6">
      <div className={card}>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Driver payments</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Internal driver payout accounting with deductions for operational issues. Customer payments and
          invoices are not affected.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className={card}>
              <p className="text-[10px] font-bold uppercase text-slate-500">Gross payout</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{money(totals.gross)}</p>
            </div>
            <div className={card}>
              <p className="text-[10px] font-bold uppercase text-rose-700">Deductions</p>
              <p className="mt-1 text-2xl font-bold text-rose-900">−{money(totals.ded)}</p>
            </div>
            <div className={card}>
              <p className="text-[10px] font-bold uppercase text-emerald-700">Net payable</p>
              <p className="mt-1 text-2xl font-bold text-emerald-900">{money(totals.net)}</p>
            </div>
            <div className={card}>
              <p className="text-[10px] font-bold uppercase text-brand-700">Paid to drivers</p>
              <p className="mt-1 text-2xl font-bold text-brand-900">{money(totals.paid)}</p>
            </div>
            <div className={card}>
              <p className="text-[10px] font-bold uppercase text-amber-800">Pending payout</p>
              <p className="mt-1 text-2xl font-bold text-amber-900">{money(totals.pending)}</p>
            </div>
            <div className={card}>
              <p className="text-[10px] font-bold uppercase text-slate-500">Active charges</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{totals.chargeCount}</p>
            </div>
          </div>

          <div className={card}>
            <h2 className="text-base font-bold text-slate-900">Drivers</h2>
            <p className="mt-1 text-xs text-slate-600">Expand a driver for weekly breakdown.</p>
            <ul className="mt-4 space-y-2">
              {overview.driverSummaries.map((d) => {
                const open = expandedDriver === d.driverId
                const weeks = open ? buildDriverWeeklyEarnings(quotes, charges, d.driverId) : []
                return (
                  <li key={d.driverId} className="rounded-xl border border-slate-200/90 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedDriver(open ? '' : d.driverId)
                        setExpandedWeek('')
                      }}
                      className="flex w-full flex-wrap items-center justify-between gap-2 bg-slate-50/80 px-3 py-2.5 text-left hover:bg-slate-100/80"
                    >
                      <span className="font-semibold text-slate-900">{d.driverName}</span>
                      <span className="flex flex-wrap gap-3 text-xs tabular-nums text-slate-700">
                        <span>Gross {money(d.gross)}</span>
                        <span className="text-rose-800">−{money(d.deductions)}</span>
                        <span className="font-bold text-emerald-800">Net {money(d.net)}</span>
                        <span className="text-brand-800">Paid {money(d.paid)}</span>
                        <span className="text-amber-800">Due {money(d.pending)}</span>
                        <span>{d.jobs} jobs · {d.chargeCount} charges</span>
                      </span>
                    </button>
                    {open ? (
                      <div className="border-t border-slate-100 px-3 py-3">
                        <div className="mb-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setAddChargeDriver(d.driverId)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-900"
                          >
                            Add driver charge
                          </button>
                          <Link
                            to="/admin/drivers"
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                          >
                            Driver profile
                          </Link>
                        </div>
                        {weeks.map((w) => {
                          const wkOpen = expandedWeek === `${d.driverId}:${w.weekKey}`
                          return (
                            <div key={w.weekKey} className="mb-2 rounded-lg border border-slate-100">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedWeek(wkOpen ? '' : `${d.driverId}:${w.weekKey}`)
                                }
                                className="flex w-full justify-between px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                              >
                                <span>Week {w.weekKey}</span>
                                <span className="flex flex-wrap items-center gap-2 tabular-nums text-xs">
                                  <span>
                                    {money(w.gross)} − {money(w.deductions)} = {money(w.net)}
                                  </span>
                                  <span className="text-brand-800">Paid {money(w.paid)}</span>
                                  <span className="text-amber-800">Due {money(w.pending)}</span>
                                </span>
                              </button>
                              {wkOpen ? (
                                <div className="border-t border-slate-50 px-2 pb-2">
                                  <div className="flex flex-wrap gap-1 py-2">
                                    <button
                                      type="button"
                                      disabled={w.pending <= 0.005}
                                      onClick={() =>
                                        void recordWeekDriverPayoutsPaid(w.jobs).then(load)
                                      }
                                      className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 disabled:opacity-40"
                                    >
                                      Mark week as paid
                                    </button>
                                  </div>
                                  <table className="w-full text-left text-xs">
                                    <thead>
                                      <tr className="text-[10px] uppercase text-slate-500">
                                        <th className="py-1 pr-2">Ref</th>
                                        <th className="py-1 pr-2">Gross</th>
                                        <th className="py-1 pr-2">Charges</th>
                                        <th className="py-1 pr-2">Net</th>
                                        <th className="py-1 pr-2">Paid</th>
                                        <th className="py-1 pr-2">Due</th>
                                        <th className="py-1">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {w.jobs.map((j) => (
                                        <Fragment key={j.quoteId}>
                                          <tr className="border-t border-slate-50">
                                            <td className="py-1 pr-2 font-mono">
                                              <Link
                                                to={`/admin/available-jobs/${j.quoteId}`}
                                                className="text-brand-700 hover:underline"
                                              >
                                                {j.quoteRef}
                                              </Link>
                                            </td>
                                            <td className="py-1 pr-2 tabular-nums">{money(j.gross)}</td>
                                            <td className="py-1 pr-2 tabular-nums text-rose-800">
                                              {j.deductions > 0 ? `−${money(j.deductions)}` : '—'}
                                            </td>
                                            <td className="py-1 pr-2 tabular-nums font-semibold">
                                              {money(j.net)}
                                            </td>
                                            <td className="py-1 pr-2 tabular-nums text-brand-800">
                                              {money(j.paid)}
                                            </td>
                                            <td className="py-1 pr-2 tabular-nums text-amber-800">
                                              {money(j.remaining)}
                                            </td>
                                            <td className="py-1">
                                              <DriverPayoutSettlementBadge status={j.settlementStatus} />
                                            </td>
                                          </tr>
                                          <tr className="border-t border-slate-50/80 bg-slate-50/50">
                                            <td colSpan={7} className="px-2 py-1.5">
                                              <DriverPayoutSettlementActions
                                                quoteId={j.quoteId}
                                                quote={j.quote}
                                                charges={j.charges}
                                                settlement={{
                                                  driverPayoutNet: j.net,
                                                  payoutRemainingBalance: j.remaining,
                                                  payoutSettlementStatus: j.settlementStatus,
                                                }}
                                                onUpdated={load}
                                                compact
                                              />
                                            </td>
                                          </tr>
                                          {(j.charges || []).map((c) => (
                                            <tr key={`${j.quoteId}-${c.id}`} className="bg-rose-50/40 text-[11px] text-slate-600">
                                              <td colSpan={7} className="px-2 py-1">
                                                <span className="font-medium text-rose-900">
                                                  {driverChargeTypeLabel(c.chargeType)} · {money(c.amount)}
                                                </span>
                                                {' · '}
                                                <span>{String(c.reason || '')}</span>
                                                {' · '}
                                                <span className="uppercase">{String(c.status)}</span>
                                              </td>
                                            </tr>
                                          ))}
                                        </Fragment>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>

          <div className={card}>
            <h2 className="text-base font-bold text-slate-900">Recent charges</h2>
            <DriverChargesList
              charges={charges.slice(0, 40)}
              onNotesSaved={load}
              onWaive={(c) => void setChargeStatus(c, 'waived')}
              onDispute={(c) => void setChargeStatus(c, 'disputed')}
              onCancel={(c) => void setChargeStatus(c, 'cancelled')}
              onApply={(c) => void setChargeStatus(c, 'applied')}
            />
          </div>
        </>
      )}

      <DriverChargeModal
        open={Boolean(addChargeDriver)}
        onClose={() => setAddChargeDriver('')}
        onSaved={load}
        initialDriverId={addChargeDriver}
      />
    </div>
  )
}
