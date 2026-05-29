import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchAllExtraChargeRequests,
  fetchQuoteContextForExtraCharge,
  fetchQuoteContextsForExtraCharges,
  recalculateExtraChargePricing,
  updateExtraChargeRequest,
} from '../lib/data/extraChargeRequestsRepository'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const STATUS_LABELS = {
  pending_review: 'Pending Review',
  pending_customer_payment: 'Awaiting Payment',
  paid: 'Paid',
  declined: 'Declined',
  cancelled: 'Cancelled',
}

const STATUS_COLORS = {
  pending_review: 'bg-amber-100 text-amber-800',
  pending_customer_payment: 'bg-blue-100 text-blue-800',
  paid: 'bg-emerald-100 text-emerald-800',
  declined: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-600',
}

function money(n) {
  if (n == null) return '—'
  return `£${Number(n).toFixed(2)}`
}

function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] || status
  const color = STATUS_COLORS[status] || 'bg-slate-100 text-slate-700'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${color}`}>
      {label}
    </span>
  )
}

function ItemsList({ items }) {
  const list = Array.isArray(items) ? items : []
  if (!list.length) return <span className="text-xs text-slate-400">No items</span>
  return (
    <ul className="space-y-0.5">
      {list.map((item, i) => (
        <li key={i} className="text-xs text-slate-700">
          <span className="font-medium">{item.name || 'Item'}</span>
          {item.quantity > 1 ? ` ×${item.quantity}` : ''}
          {item.volume_m3 != null || item.volume_per_unit_m3 != null
            ? ` (${item.volume_m3 ?? item.volume_per_unit_m3} m³)`
            : ''}
          {item.line_price_label ? (
            <span className="ml-1 font-semibold text-emerald-800">{item.line_price_label}</span>
          ) : item.line_amount_gbp != null ? (
            <span className="ml-1 font-semibold text-emerald-800">{money(item.line_amount_gbp)}</span>
          ) : null}
          {item.matched_library === false ? (
            <span className="ml-1 text-amber-700">(not in library)</span>
          ) : null}
          {item.notes ? <span className="ml-1 text-slate-500">— {item.notes}</span> : null}
        </li>
      ))}
    </ul>
  )
}

function PricingBreakdownPanel({ breakdown }) {
  if (!breakdown || typeof breakdown !== 'object') return null
  const lines = Array.isArray(breakdown.breakdown_lines) ? breakdown.breakdown_lines : []
  const itemLines = Array.isArray(breakdown.item_lines) ? breakdown.item_lines : []
  if (!lines.length && !itemLines.length) return null
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-900">Pricing engine</p>
      {breakdown.volume_band ? (
        <p className="mt-0.5 text-[10px] text-emerald-800">Volume band: {breakdown.volume_band}</p>
      ) : null}
      {itemLines.length > 0 ? (
        <ul className="mt-1 space-y-0.5 border-b border-emerald-200/80 pb-1">
          {itemLines.map((line, i) => (
            <li key={`item-${i}`} className="flex justify-between gap-2 text-xs text-emerald-950">
              <span>{line.name || line.label || 'Item'}</span>
              <span className="font-semibold tabular-nums">
                {line.price_label || money(line.amount ?? line.line_amount_gbp)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {lines.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {lines.map((line, i) => (
            <li key={i} className="flex justify-between gap-2 text-xs text-emerald-950">
              <span>{line.label}</span>
              <span className="font-semibold tabular-nums">{money(line.amount)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function ExtraChargeDetailModal({ request, onClose, onAction }) {
  const [liveRequest, setLiveRequest] = useState(request)
  const [quoteRef, setQuoteRef] = useState(request.displayQuoteRef || request.bookingReference || '')
  const [approvedAmount, setApprovedAmount] = useState(
    request.approvedAmount != null ? String(request.approvedAmount) : String(request.estimatedAmount),
  )
  const [notes, setNotes] = useState(request.notes || '')
  const [customerEmail, setCustomerEmail] = useState(request.customerEmail || '')
  const [customerName, setCustomerName] = useState(request.customerName || '')
  const [bookingRef, setBookingRef] = useState(request.bookingReference || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLiveRequest(request)
    setQuoteRef(request.displayQuoteRef || request.bookingReference || '')
    setApprovedAmount(
      request.approvedAmount != null ? String(request.approvedAmount) : String(request.estimatedAmount),
    )
    setNotes(request.notes || '')
    setCustomerEmail(request.customerEmail || '')
    setCustomerName(request.customerName || '')
    setBookingRef(request.bookingReference || '')
  }, [request])

  useEffect(() => {
    const quoteId = liveRequest.quoteId
    if (!quoteId) return
    let cancelled = false
    ;(async () => {
      try {
        const ctx = await fetchQuoteContextForExtraCharge(quoteId)
        if (cancelled || !ctx) return
        if (ctx.quoteRef) setQuoteRef((prev) => prev || ctx.quoteRef)
        if (ctx.quoteRef) setBookingRef((prev) => prev || ctx.quoteRef)
        if (ctx.customerEmail) setCustomerEmail((prev) => prev || ctx.customerEmail)
        if (ctx.customerName) setCustomerName((prev) => prev || ctx.customerName)
      } catch {
        /* quote prefill optional */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [liveRequest.quoteId])

  async function handleRecalculatePricing() {
    setBusy(true)
    setError('')
    try {
      const updated = await recalculateExtraChargePricing(liveRequest.id)
      setLiveRequest(updated)
      setApprovedAmount(String(updated.estimatedAmount))
      onAction()
    } catch (e) {
      setError(e.message || 'Pricing recalculation failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleApproveAndSendPayment() {
    const amt = Number(approvedAmount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Please enter a valid approved amount.')
      return
    }
    if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      setError('Please enter a valid customer email.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await updateExtraChargeRequest(liveRequest.id, {
        approvedAmount: amt,
        notes,
        customerEmail,
        customerName,
        bookingReference: bookingRef,
      })

      if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured')
      const invokeOpts = {
        body: {
          request_id: liveRequest.id,
          customer_email: customerEmail,
          customer_name: customerName,
          booking_reference: bookingRef,
        },
      }
      const raw = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim().replace(/^["']|["']$/g, '')
      if (raw.startsWith('eyJ')) invokeOpts.headers = { Authorization: `Bearer ${raw}` }

      const { data, error: fnErr } = await supabase.functions.invoke('create-extra-charge-payment', invokeOpts)

      if (fnErr) {
        let detail = fnErr.message || 'Payment creation failed'
        try {
          if (fnErr.context && typeof fnErr.context.json === 'function') {
            const j = await fnErr.context.json()
            if (j?.error) detail = j.error
          }
        } catch { /* ignore */ }
        throw new Error(detail)
      }
      if (data?.error) throw new Error(data.error)

      onAction()
    } catch (e) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDecline() {
    setBusy(true)
    setError('')
    try {
      await updateExtraChargeRequest(liveRequest.id, { status: 'declined', notes })
      onAction()
    } catch (e) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel() {
    setBusy(true)
    setError('')
    try {
      await updateExtraChargeRequest(liveRequest.id, { status: 'cancelled', notes })
      onAction()
    } catch (e) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const isPending = liveRequest.status === 'pending_review'
  const isAwaitingPayment = liveRequest.status === 'pending_customer_payment'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">Extra Charge Request</h2>
          <StatusBadge status={liveRequest.status} />
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs font-semibold uppercase text-slate-500">Booking / quote</span>
              <p className="text-sm font-semibold text-slate-900">
                {quoteRef || bookingRef || '—'}
              </p>
              {liveRequest.quoteId ? (
                <Link
                  to={`/admin/available-jobs/${liveRequest.quoteId}`}
                  className="text-xs font-semibold text-brand-700 hover:underline"
                >
                  Open available job →
                </Link>
              ) : null}
            </div>
            <div>
              <span className="text-xs font-semibold uppercase text-slate-500">Driver</span>
              <p className="font-mono text-xs text-slate-800">{liveRequest.driverId?.slice(0, 8) || '—'}</p>
              {liveRequest.jobId ? (
                <p className="mt-0.5 font-mono text-[10px] text-slate-500">Job {liveRequest.jobId.slice(0, 8)}…</p>
              ) : (
                <p className="mt-0.5 text-[10px] text-slate-500">Mobile (quote only)</p>
              )}
            </div>
            <div>
              <span className="text-xs font-semibold uppercase text-slate-500">Volume Added</span>
              <p className="text-slate-800">{liveRequest.addedVolumeM3 ? `${liveRequest.addedVolumeM3} m³` : '—'}</p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase text-slate-500">Engine estimate</span>
              <p className="font-semibold text-slate-800">{money(liveRequest.estimatedAmount)}</p>
            </div>
          </div>

          <PricingBreakdownPanel breakdown={liveRequest.pricingBreakdown} />

          <div>
            <span className="text-xs font-semibold uppercase text-slate-500">Added Items</span>
            <div className="mt-1 rounded-lg border border-slate-100 bg-slate-50/50 p-2">
              <ItemsList items={liveRequest.addedItems} />
            </div>
          </div>

          {isPending ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRecalculatePricing()}
              className="text-xs font-semibold text-brand-700 hover:underline disabled:opacity-50"
            >
              Recalculate from pricing engine + items library
            </button>
          ) : null}

          {(isAwaitingPayment || request.status === 'paid') && request.stripePaymentLink ? (
            <div>
              <span className="text-xs font-semibold uppercase text-slate-500">Payment Link</span>
              <a href={request.stripePaymentLink} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-xs font-medium text-brand-700 hover:underline">
                {request.stripePaymentLink}
              </a>
            </div>
          ) : null}

          {request.status === 'paid' && request.paidAt ? (
            <div>
              <span className="text-xs font-semibold uppercase text-slate-500">Paid At</span>
              <p className="text-xs text-slate-800">{new Date(request.paidAt).toLocaleString()}</p>
            </div>
          ) : null}
        </div>

        {isPending ? (
          <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Approved Amount (£)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Booking Reference</label>
                <input
                  type="text"
                  value={bookingRef}
                  onChange={(e) => setBookingRef(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="SMH-XXXX"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Customer Email</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="customer@email.com"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="John Smith"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Admin Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Optional notes for internal tracking..."
              />
            </div>

            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleApproveAndSendPayment}
                disabled={busy}
                className="inline-flex min-h-[40px] items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? 'Processing...' : 'Approve & Send Payment Link'}
              </button>
              <button
                type="button"
                onClick={handleDecline}
                disabled={busy}
                className="inline-flex min-h-[40px] items-center rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={busy}
                className="inline-flex min-h-[40px] items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {isAwaitingPayment ? (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-sm text-blue-700">Payment link created — share with customer. Confirmation email after they pay.</p>
            {request.approvedAmount != null ? (
              <p className="mt-1 text-sm font-semibold text-slate-800">Approved: {money(request.approvedAmount)}</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ExtraChargesAdmin() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchAllExtraChargeRequests()
      setRequests(data)
    } catch (e) {
      setError(e.message || 'Failed to load extra charge requests.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter)

  const counts = {
    all: requests.length,
    pending_review: requests.filter((r) => r.status === 'pending_review').length,
    pending_customer_payment: requests.filter((r) => r.status === 'pending_customer_payment').length,
    paid: requests.filter((r) => r.status === 'paid').length,
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Extra Charges</h1>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['all', `All (${counts.all})`],
          ['pending_review', `Pending (${counts.pending_review})`],
          ['pending_customer_payment', `Awaiting Pay (${counts.pending_customer_payment})`],
          ['paid', `Paid (${counts.paid})`],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              filter === key
                ? 'bg-brand-600 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-500">
          {filter === 'all' ? 'No extra charge requests yet.' : 'No requests match this filter.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80">
              <tr>
                <th className="px-3 py-2.5 text-xs font-bold uppercase text-slate-500">Date</th>
                <th className="px-3 py-2.5 text-xs font-bold uppercase text-slate-500">Booking</th>
                <th className="px-3 py-2.5 text-xs font-bold uppercase text-slate-500">Customer</th>
                <th className="px-3 py-2.5 text-xs font-bold uppercase text-slate-500">Items</th>
                <th className="px-3 py-2.5 text-xs font-bold uppercase text-slate-500">Vol.</th>
                <th className="px-3 py-2.5 text-xs font-bold uppercase text-slate-500">Estimate</th>
                <th className="px-3 py-2.5 text-xs font-bold uppercase text-slate-500">Approved</th>
                <th className="px-3 py-2.5 text-xs font-bold uppercase text-slate-500">Status</th>
                <th className="px-3 py-2.5 text-xs font-bold uppercase text-slate-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/50">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                    {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs font-medium text-slate-800">
                    {req.displayQuoteRef || req.bookingReference || '—'}
                    {req.quoteId ? (
                      <Link
                        to={`/admin/available-jobs/${req.quoteId}`}
                        className="mt-0.5 block text-[10px] font-semibold text-brand-700 hover:underline"
                      >
                        View job
                      </Link>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700">
                    <span className="font-medium text-slate-900">{req.displayCustomer || '—'}</span>
                    {req.displayCustomerEmail ? (
                      <span className="mt-0.5 block text-[10px] text-slate-500">{req.displayCustomerEmail}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700">
                    {Array.isArray(req.addedItems) ? `${req.addedItems.length} item${req.addedItems.length !== 1 ? 's' : ''}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700">
                    {req.addedVolumeM3 ? `${req.addedVolumeM3} m³` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs font-medium text-slate-800">
                    {money(req.estimatedAmount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-slate-900">
                    {money(req.approvedAmount)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setSelected(req)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <ExtraChargeDetailModal
          request={selected}
          onClose={() => setSelected(null)}
          onAction={() => {
            setSelected(null)
            load()
          }}
        />
      ) : null}
    </div>
  )
}
