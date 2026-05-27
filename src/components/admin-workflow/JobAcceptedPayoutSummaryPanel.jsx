import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  formatJobAcceptedMoney,
  MANUAL_PAYOUT_CONFIRMED_LABEL,
  resolveJobAcceptedPaymentBreakdown,
} from '../../lib/jobAcceptedPaymentDisplay'
import { resolveDriverPayoutSettlement } from '../../lib/driverPayoutSettlement'
import { fetchDriverChargesByQuoteIds } from '../../lib/data/driverChargesRepository'
import DriverPayoutSettlementBadge from '../admin-driver-payments/DriverPayoutSettlementBadge'
import JobAcceptedPayoutAuditBlock from './JobAcceptedPayoutAuditBlock'
import { useLatestDriverPayoutAudit } from '../../lib/useLatestDriverPayoutAudit'

/**
 * Compact accepted-job payout summary (full config lives on Available Jobs + Driver Payments).
 * @param {{
 *   q: Record<string, unknown>,
 *   charges?: Array<Record<string, unknown>>,
 * }} props
 */
export default function JobAcceptedPayoutSummaryPanel({ q, charges: chargesProp }) {
  const [jobCharges, setJobCharges] = useState(() => chargesProp ?? [])

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
    if (chargesProp != null) {
      setJobCharges(chargesProp)
      return
    }
    void loadCharges()
  }, [chargesProp, loadCharges])

  const payment = resolveJobAcceptedPaymentBreakdown(q)
  const { audit, loading: auditLoading, fallback: auditFallback } = useLatestDriverPayoutAudit(
    q,
    payment.manualPayoutOverride,
  )
  const settlement = resolveDriverPayoutSettlement(q, jobCharges)
  const driverId = q.assigned_driver_id != null ? String(q.assigned_driver_id) : ''
  const quoteRef = String(q.quote_ref || q.id || '')
  const ledgerParams = new URLSearchParams()
  if (driverId) ledgerParams.set('driver', driverId)
  if (quoteRef) ledgerParams.set('ref', quoteRef)
  const ledgerHref = `/admin/driver-payments${ledgerParams.toString() ? `?${ledgerParams}` : ''}`

  const payoutNote = String(q.payout_notes || payment.payoutOverrideNote || '').trim()

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Accepted payout</h3>
        <Link
          to={ledgerHref}
          className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-white"
        >
          View payout ledger
        </Link>
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <dt className="font-semibold text-slate-600">Driver payout</dt>
          <dd className="tabular-nums font-bold text-violet-900">
            {formatJobAcceptedMoney(payment.driverPayout)}
          </dd>
          {payment.manualPayoutOverride ? (
            <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-900">
              {MANUAL_PAYOUT_CONFIRMED_LABEL}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <dt className="font-semibold text-slate-600">Driver paid</dt>
          <dd>
            <DriverPayoutSettlementBadge status={settlement.payoutSettlementStatus || 'pending'} />
          </dd>
        </div>
        {payoutNote ? (
          <div>
            <dt className="text-[10px] font-semibold uppercase text-slate-500">Payment note</dt>
            <dd className="mt-0.5 text-xs text-slate-700">{payoutNote}</dd>
          </div>
        ) : null}
      </dl>
      {payment.manualPayoutOverride ? (
        <JobAcceptedPayoutAuditBlock audit={audit} fallback={auditFallback} loading={auditLoading} compact />
      ) : null}
      <p className="mt-2 text-[11px] text-slate-500">
        Full marketplace payout setup and audit history are on Available Jobs (before acceptance) and Driver
        Payments.
      </p>
    </section>
  )
}
