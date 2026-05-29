import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PaymentLinkSharePanel from '../extra-charges/PaymentLinkSharePanel'
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
 * Includes payment link + share actions for admin on mobile/desktop.
 * @param {{ quoteId: string, quoteRef?: string, onNotify?: (msg: string) => void }} props
 */
export default function JobExtraChargesPanel({ quoteId, quoteRef = '', onNotify }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(/** @type {string|null} */ (null))
  const [freshLinkById, setFreshLinkById] = useState(/** @type {Record<string, string>} */ ({}))

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
      onNotify?.('Add customer email on the quote before generating a payment link.')
      return
    }
    const approvedAmount =
      req.approvedAmount != null && req.approvedAmount > 0
        ? req.approvedAmount
        : req.estimatedAmount
    setBusyId(req.id)
    try {
      await updateExtraChargeRequest(req.id, {
        approvedAmount,
        customerEmail: email,
        customerName: name,
        bookingReference: ref,
      })
      const { paymentLink } = await approveAndGenerateExtraChargePaymentLink({
        requestId: req.id,
        approvedAmount,
        customerEmail: email,
        customerName: name,
        bookingReference: ref,
      })
      setFreshLinkById((prev) => ({ ...prev, [req.id]: paymentLink }))
      onNotify?.('Payment link ready — copy or share below.')
      await load()
    } catch (e) {
      onNotify?.(e.message || 'Could not generate payment link.')
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
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {rows.length} request{rows.length === 1 ? '' : 's'} from mobile Add Item
        </p>
        <Link
          to="/admin/extra-charges"
          className="text-xs font-semibold text-brand-700 hover:underline"
        >
          Full approval form →
        </Link>
      </div>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {rows.map((req) => {
          const paymentLink =
            freshLinkById[req.id] || req.stripePaymentLink || ''
          const customerEmail = req.customerEmail || ''
          const customerName = req.customerName || ''
          const bookingRef = req.bookingReference || quoteRef || ''

          return (
            <li key={req.id} className="min-w-0 px-3 py-3 text-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">
                    {money(req.approvedAmount ?? req.estimatedAmount)}{' '}
                    <span className="font-normal text-slate-500">
                      {req.approvedAmount != null ? 'approved' : 'estimate'}
                      {req.addedVolumeM3 ? ` · ${req.addedVolumeM3} m³` : ''}
                    </span>
                  </p>
                  <p className="mt-0.5 break-all text-xs text-slate-500">
                    {req.createdAt ? new Date(req.createdAt).toLocaleString() : '—'} ·{' '}
                    {STATUS_LABELS[req.status] || req.status}
                  </p>
                  {customerEmail ? (
                    <p className="mt-0.5 break-all text-xs text-slate-600">{customerEmail}</p>
                  ) : null}
                  {Array.isArray(req.addedItems) && req.addedItems.length > 0 ? (
                    <p className="mt-1 text-xs text-slate-700">
                      {req.addedItems.map((i) => i.name).filter(Boolean).join(', ')}
                    </p>
                  ) : null}
                  {req.notes ? (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-amber-900">{req.notes}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5 sm:shrink-0">
                  {req.status === 'pending_review' ? (
                    <>
                      <button
                        type="button"
                        disabled={busyId === req.id}
                        onClick={() => void recalculateExtraChargePricing(req.id).then(load)}
                        className="min-h-[36px] rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Recalc
                      </button>
                      <button
                        type="button"
                        disabled={busyId === req.id}
                        onClick={() => void approveQuick(req)}
                        className="min-h-[36px] rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {busyId === req.id ? 'Generating…' : 'Approve & generate link'}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              {paymentLink ? (
                <div className="mt-3 min-w-0">
                  <PaymentLinkSharePanel
                    paymentLink={paymentLink}
                    customerEmail={customerEmail}
                    customerName={customerName}
                    bookingReference={bookingRef}
                    approvedAmount={req.approvedAmount}
                  />
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
