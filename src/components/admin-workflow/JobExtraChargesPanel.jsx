import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchExtraChargeRequestsByQuoteId,
  fetchQuoteContextForExtraCharge,
  recalculateExtraChargePricing,
  updateExtraChargeRequest,
} from '../../lib/data/extraChargeRequestsRepository'
import { approveAndGenerateExtraChargePaymentLink } from '../../lib/extraChargePaymentLinkApi'

const STATUS_LABELS = {
  pending_review: 'Pending review',
  pending_customer_payment: 'Awaiting payment',
  paid: 'Paid',
  declined: 'Declined',
  cancelled: 'Cancelled',
}

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

/**
 * Driver extra charge requests for one booking (Available Job / Dispatch).
 * @param {{ quoteId: string, quoteRef?: string, onNotify?: (msg: string) => void }} props
 */
export default function JobExtraChargesPanel({ quoteId, quoteRef = '', onNotify }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(/** @type {string|null} */ (null))

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
    } catch (e) {
      onNotify?.(e.message || 'Could not load extra charges.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [quoteId, onNotify])

  useEffect(() => {
    void load()
  }, [load])

  async function approveQuick(req) {
    let email = (req.customerEmail || '').trim()
    let name = (req.customerName || '').trim()
    let ref = (req.bookingReference || quoteRef || '').trim()
    if ((!email || !name) && req.quoteId) {
      const ctx = await fetchQuoteContextForExtraCharge(req.quoteId)
      if (ctx) {
        if (!email) email = ctx.customerEmail
        if (!name) name = ctx.customerName
        if (!ref) ref = ctx.quoteRef
      }
    }
    if (!email) {
      onNotify?.('Add customer email on the quote or in Extra Charges admin before sending payment.')
      return
    }
    setBusyId(req.id)
    try {
      await updateExtraChargeRequest(req.id, {
        approvedAmount: req.estimatedAmount,
        customerEmail: email,
        customerName: name,
        bookingReference: ref,
      })
      const { paymentLink } = await approveAndGenerateExtraChargePaymentLink({
        requestId: req.id,
        approvedAmount: req.estimatedAmount,
        customerEmail: email,
        customerName: name,
        bookingReference: ref,
      })
      onNotify?.('Payment link ready — open Extra Charges to copy or share with the customer.')
      if (paymentLink) {
        onNotify?.(paymentLink)
      }
      await load()
    } catch (e) {
      onNotify?.(e.message || 'Payment failed.')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading driver extra charges…</p>
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        No extra charge requests from the driver app for this booking yet.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {rows.length} request{rows.length === 1 ? '' : 's'} from mobile Add Item
        </p>
        <Link
          to="/admin/extra-charges"
          className="text-xs font-semibold text-brand-700 hover:underline"
        >
          Open Extra Charges →
        </Link>
      </div>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {rows.map((req) => (
          <li key={req.id} className="px-3 py-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">
                  {money(req.estimatedAmount)}{' '}
                  <span className="font-normal text-slate-500">
                    engine · {req.addedVolumeM3 ? `${req.addedVolumeM3} m³` : '—'}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {req.createdAt ? new Date(req.createdAt).toLocaleString() : '—'} ·{' '}
                  {STATUS_LABELS[req.status] || req.status}
                </p>
                {Array.isArray(req.addedItems) && req.addedItems.length > 0 ? (
                  <p className="mt-1 text-xs text-slate-700">
                    {req.addedItems.map((i) => i.name).filter(Boolean).join(', ')}
                  </p>
                ) : null}
                {req.notes ? (
                  <p className="mt-1 text-xs text-amber-900 whitespace-pre-wrap">{req.notes}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {req.status === 'pending_review' ? (
                  <>
                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={() => void recalculateExtraChargePricing(req.id).then(load)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Recalc
                    </button>
                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={() => void approveQuick(req)}
                      className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Approve & generate link
                    </button>
                  </>
                ) : null}
                {req.stripePaymentLink ? (
                  <a
                    href={req.stripePaymentLink}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-brand-200 px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50"
                  >
                    Payment link
                  </a>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
