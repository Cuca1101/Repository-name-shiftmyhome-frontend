import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchExtraChargeRequestsByQuoteId } from '../../lib/data/extraChargeRequestsRepository'
import { subscribeAdminDataRefresh } from '../../lib/adminDataRefresh'

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

function formatItemLines(items) {
  if (!Array.isArray(items) || items.length === 0) return []
  return items.map((i) => {
    const name = i?.name || 'Item'
    const qty = Number(i?.quantity) || 1
    const vol = i?.volume_m3 ?? i?.volume_per_unit_m3
    const lineAmt =
      i?.line_amount_gbp != null && Number.isFinite(Number(i.line_amount_gbp))
        ? ` · £${Number(i.line_amount_gbp).toFixed(2)}`
        : ''
    const volPart = vol != null ? ` (${vol} m³)` : ''
    return `${name} ×${qty}${volPart}${lineAmt}`
  })
}

function paymentRef(req) {
  const id = req.stripePaymentIntentId ? String(req.stripePaymentIntentId) : ''
  if (!id) return null
  return id.length > 12 ? `…${id.slice(-12)}` : id
}

/**
 * Read-only audit: driver extra charges + paid/refusal record for disputes.
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

  useEffect(() => {
    return subscribeAdminDataRefresh(() => {
      void load()
    })
  }, [load])

  useEffect(() => {
    if (!quoteId) return undefined
    const timer = setInterval(() => {
      void load()
    }, 60_000)
    return () => clearInterval(timer)
  }, [quoteId, load])

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
          {rows.length} charge{rows.length === 1 ? '' : 's'} — updates when customer pays or
          driver records refusal
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
          const itemLines = formatItemLines(req.addedItems)
          const amount = req.approvedAmount ?? req.estimatedAmount
          const isPaid = req.status === 'paid'
          const isRefused = req.status === 'declined'
          const payRef = paymentRef(req)

          return (
            <li key={req.id} className="min-w-0 px-3 py-3 text-sm">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">{money(amount)}</p>
                  {req.addedVolumeM3 ? (
                    <span className="text-xs text-slate-500">{req.addedVolumeM3} m³</span>
                  ) : null}
                  {isPaid ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900">
                      Paid — customer charged
                    </span>
                  ) : null}
                  {isRefused ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-900">
                      Customer refused payment
                    </span>
                  ) : null}
                  {!isPaid && !isRefused ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                      Driver self-service
                    </span>
                  ) : null}
                </div>

                <p className="text-xs text-slate-500">
                  {req.createdAt ? new Date(req.createdAt).toLocaleString() : '—'} ·{' '}
                  {STATUS_LABELS[req.status] || req.status}
                </p>

                {isPaid && req.paidAt ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">
                      Payment received
                    </p>
                    <p className="mt-1 text-xs text-emerald-800">
                      {money(amount)} paid on {new Date(req.paidAt).toLocaleString()}
                    </p>
                    {payRef ? (
                      <p className="mt-1 text-[11px] text-emerald-700">
                        Stripe ref: {payRef}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {isRefused && req.notes ? (
                  <div className="rounded-lg border border-red-200 bg-red-50/80 px-3 py-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-red-900">
                      Driver recorded refusal
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-red-800">{req.notes}</p>
                  </div>
                ) : null}

                {itemLines.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      What customer was charged for
                    </p>
                    <ul className="mt-1 list-inside list-disc text-xs text-slate-700">
                      {itemLines.map((line, idx) => (
                        <li key={idx}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {req.customerEmail ? (
                  <p className="break-all text-xs text-slate-600">{req.customerEmail}</p>
                ) : null}

                {(req.bookingReference || quoteRef) && (
                  <p className="text-[11px] text-slate-400">
                    Booking ref: {req.bookingReference || quoteRef}
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
