import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchExtraChargeRequestsByQuoteId } from '../../lib/data/extraChargeRequestsRepository'

const STATUS_LABELS = {
  pending_review: 'Driver submitted',
  pending_customer_payment: 'Awaiting customer payment',
  paid: 'Paid',
  declined: 'Customer refused',
  cancelled: 'Cancelled',
}

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

/**
 * Read-only audit: driver extra charges (no admin approval or payment link sharing).
 * @param {{ quoteId: string, quoteRef?: string }} props
 */
export default function JobExtraChargesPanel({ quoteId, quoteRef = '' }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!quoteId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await fetchExtraChargeRequestsByQuoteId(quoteId)
      setRows(data)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [quoteId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return <p className="text-sm text-slate-500">Loading driver extra charges…</p>
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        No extra charges from the driver app for this booking yet.
      </p>
    )
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {rows.length} charge{rows.length === 1 ? '' : 's'} — driver self-service (no admin approval)
        </p>
        <Link
          to="/admin/extra-charges"
          className="text-xs font-semibold text-brand-700 hover:underline"
        >
          All extra charges →
        </Link>
      </div>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {rows.map((req) => {
          const hasLink = Boolean(req.stripePaymentLink)
          const driverInitiated =
            req.status !== 'pending_review' || hasLink || req.approvedAmount != null

          return (
            <li key={req.id} className="min-w-0 px-3 py-3 text-sm">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">
                    {money(req.approvedAmount ?? req.estimatedAmount)}
                  </p>
                  {req.addedVolumeM3 ? (
                    <span className="text-xs text-slate-500">{req.addedVolumeM3} m³</span>
                  ) : null}
                  {driverInitiated ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                      Driver charged — no admin approval
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500">
                  {req.createdAt ? new Date(req.createdAt).toLocaleString() : '—'} ·{' '}
                  {STATUS_LABELS[req.status] || req.status}
                  {hasLink ? ' · driver shared payment link' : ''}
                </p>
                {req.customerEmail ? (
                  <p className="break-all text-xs text-slate-600">{req.customerEmail}</p>
                ) : null}
                {Array.isArray(req.addedItems) && req.addedItems.length > 0 ? (
                  <p className="text-xs text-slate-700">
                    {req.addedItems.map((i) => i.name).filter(Boolean).join(', ')}
                  </p>
                ) : null}
                {req.notes ? (
                  <p className="whitespace-pre-wrap text-xs text-amber-900">{req.notes}</p>
                ) : null}
                {(req.bookingReference || quoteRef) && (
                  <p className="text-[11px] text-slate-400">
                    Ref: {req.bookingReference || quoteRef}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
