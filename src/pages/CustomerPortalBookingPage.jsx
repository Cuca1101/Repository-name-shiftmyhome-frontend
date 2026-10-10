import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import PortalShell, { usePortalAccess } from '../components/customer-portal/PortalShell'
import PortalTrackPanel from '../components/customer-portal/PortalTrackPanel'
import MoveTimeline from '../components/tracking/MoveTimeline'
import { abandonPortalAmendment, confirmPortalPayment, getPortalBooking, payPortalAmendment } from '../lib/customerPortalApi'
import {
  existingBalanceGbp,
  formatGbp,
  jobModificationLock,
} from '../lib/customerPortalModel'
import { hydratePortalWizard, inventoryTextFromLines } from '../lib/customerPortalQuote'
import { previousChargeableTotal } from '../lib/customerPortalPricing'
import { formatDateTimeUK, formatDateUK } from '../lib/formatDateDisplay'
import { COMPANY_EMAIL, COMPANY_PHONE_DISPLAY, COMPANY_PHONE_TEL } from '../constants/companyContact'
import CustomerKindBadge from '../components/admin/CustomerKindBadge'

const OPEN = {
  pending_approval: 'Pending approval',
  pending_payment: 'Waiting for payment',
  paid_needs_review: 'Pending approval',
  applied: 'Confirmed',
  rejected: 'Not applied',
  abandoned: 'Not applied',
  payment_failed: 'Payment not completed',
}

function Row({ label, value, tone }) {
  if (value == null || value === '') return null
  const dot = tone === 'delivery' ? 'bg-[#059669]' : tone === 'collection' ? 'bg-[#ea580c]' : ''
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="flex items-center gap-2 text-slate-500">
        {dot ? <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden /> : null}
        {label}
      </span>
      <span className="max-w-[65%] break-words text-right font-medium">{value}</span>
    </div>
  )
}

export default function CustomerPortalBookingPage() {
  const access = usePortalAccess()
  const { id } = useParams()
  const [params] = useSearchParams()
  const [payload, setPayload] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    let cancelled = false
    setError('')
    setPayload(null)
    if (access.mode === 'anonymous') return undefined
    getPortalBooking(id, access)
      .then((data) => {
        if (!cancelled) setPayload(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Booking not found.')
      })
    return () => {
      cancelled = true
    }
  }, [id, access.mode, access.customerId])

  useEffect(() => {
    const payment = params.get('payment')
    const amendmentId = params.get('amendment')
    const sessionId = params.get('session_id')
    if (!id || !payment) return undefined
    let cancelled = false
    const run = async () => {
      try {
        if (payment === 'cancelled' && amendmentId) {
          await abandonPortalAmendment(id, amendmentId, access)
          if (!cancelled) setNotice('Payment was not completed. Your confirmed booking is unchanged.')
        }
        if (payment === 'success' && sessionId) {
          const result = await confirmPortalPayment(id, sessionId, access)
          if (cancelled) return
          if (result?.status === 'applied') setNotice('Your booking has been updated.')
          else if (result?.status === 'paid_needs_review') setNotice('Pending approval. Your previous booking is still confirmed.')
          else if (result?.quoteUnchanged) setNotice('Payment was not completed. Your confirmed booking is unchanged.')
          const fresh = await getPortalBooking(id, access)
          if (!cancelled) setPayload(fresh)
        }
      } catch (err) {
        if (!cancelled) setNotice(err?.message || 'We could not confirm the payment yet.')
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [id, params, access.mode, access.customerId])

  const booking = payload?.booking
  const lock = booking ? jobModificationLock(booking) : { locked: false, contact: false }
  const wizard = booking ? hydratePortalWizard(booking) : null
  const total = booking ? previousChargeableTotal(booking) : null
  const paid = Number(booking?.amount_paid) || 0
  const balance = booking ? existingBalanceGbp(booking, total) : 0
  const openChange = (payload?.amendments || []).find((row) =>
    ['pending_approval', 'pending_payment', 'paid_needs_review'].includes(row.status),
  )

  async function payOpen() {
    if (!openChange) return
    setPaying(true)
    try {
      const result = await payPortalAmendment(id, openChange.id, access)
      if (result?.checkoutUrl) window.location.assign(result.checkoutUrl)
    } catch (err) {
      setNotice(err?.message || 'Could not start payment.')
    } finally {
      setPaying(false)
    }
  }

  return (
    <PortalShell
      title={booking?.quote_ref ? `${booking.quote_ref} | ShiftMyHome` : 'Booking | ShiftMyHome'}
      description="Your ShiftMyHome booking."
      path={`/portal/bookings/${id || ''}`}
    >
      <Link to={access.portalTo('/portal/bookings')} className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800">
        Back to my bookings
      </Link>
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      {!booking && !error ? <p className="mt-4 text-sm text-slate-500">Loading…</p> : null}
      {notice ? <p className="mt-4 rounded-xl bg-white p-3 text-sm text-slate-700">{notice}</p> : null}
      {booking ? (
        <div className="mt-4 space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-extrabold">{booking.quote_ref || 'Booking'}</h1>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">
                {lock.reason === 'completed' ? 'Completed' : lock.reason === 'started' ? 'In progress' : booking.operational_status || booking.status || 'Booked'}
              </span>
            </div>
            {access.mode === 'admin' ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <CustomerKindBadge kind={booking.customer_kind} />
                <p className="text-sm text-slate-600">
                  {Number(payload?.customer?.booking_count) || 0} bookings
                  {payload?.customer?.first_booking_at ? ` · first ${formatDateUK(payload.customer.first_booking_at)}` : ''}
                </p>
              </div>
            ) : null}
            <div className="mt-3">
              <Row label="Name" value={booking.full_name} />
              <Row label="Date" value={formatDateUK(booking.move_date)} />
              <Row label="Time" value={booking.arrival_window || booking.arrival_time} />
              <Row label="Collection" value={booking.pickup_address} tone="collection" />
              <Row label="Delivery" value={booking.delivery_address} tone="delivery" />
              <Row label="Team" value={booking.crew_size ? `${booking.crew_size} person team` : ''} />
              <Row label="Vehicle" value={booking.vehicle_size} />
              <Row label="Collection floor" value={floorLabel(wizard?.pickupFloor)} tone="collection" />
              <Row label="Collection lift" value={liftLabel(wizard?.pickupLift)} tone="collection" />
              <Row label="Delivery floor" value={floorLabel(wizard?.deliveryFloor)} tone="delivery" />
              <Row label="Delivery lift" value={liftLabel(wizard?.deliveryLift)} tone="delivery" />
              <Row label="Total" value={total != null ? formatGbp(total) : ''} />
              <Row label="Paid" value={formatGbp(paid)} />
              <Row label="Balance" value={formatGbp(balance)} />
              <Row label="Driver" value={booking.assigned_driver_name || 'Not assigned yet'} />
            </div>
            <h2 className="mt-4 text-sm font-bold">Items</h2>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
              {inventoryTextFromLines(wizard?.inventoryLines) || booking.inventory_text || 'Items will show here once they are on the booking.'}
            </p>
          </section>

          {openChange ? (
            <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm">
              <p className="font-bold">{OPEN[openChange.status] || 'Pending approval'}</p>
              <p className="mt-1 text-amber-950">
                This change is not confirmed. Previous price {formatGbp(openChange.previous_total)}, new price {formatGbp(openChange.next_total)}.
                {Number(openChange.payment_delta) > 0 ? ` Extra to pay ${formatGbp(openChange.payment_delta)}.` : ''}
                {Number(openChange.existing_balance) > 0 ? ` Existing balance ${formatGbp(openChange.existing_balance)} is separate.` : ''}
              </p>
              {openChange.status === 'pending_payment' ? (
                <button type="button" disabled={paying} onClick={payOpen} className="mt-3 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                  {paying ? 'Opening payment…' : 'Pay the difference'}
                </button>
              ) : null}
            </section>
          ) : null}

          <MoveTimeline
            token={payload?.tracking_token || ''}
            completedAt={booking.completed_at || null}
          />

          {payload?.tracking_token ? <PortalTrackPanel token={payload.tracking_token} /> : (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              {booking.assigned_driver_name
                ? 'Your driver has not started towards collection yet.'
                : 'A driver has not been assigned yet.'}
            </section>
          )}

          {lock.contact ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
              <p className="font-bold">Contact the team</p>
              <p className="mt-1 text-slate-600">This booking can no longer be changed online.</p>
              <a className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand-700" href={`tel:${COMPANY_PHONE_TEL}`}>{COMPANY_PHONE_DISPLAY}</a>
              <a className="mt-1 block font-semibold text-brand-700" href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a>
            </section>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Link to={access.portalTo(`/portal/bookings/${booking.id}/edit#portal-edit-date`)} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-600 px-3 text-center text-sm font-bold leading-tight text-white">
                Change date
              </Link>
              <Link to={access.portalTo(`/portal/bookings/${booking.id}/edit#portal-edit-items`)} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-brand-200 px-3 text-center text-sm font-bold leading-tight text-brand-700">
                Edit items
              </Link>
              <Link to={access.portalTo(`/portal/bookings/${booking.id}/edit#portal-edit-addresses`)} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-brand-200 px-3 text-center text-sm font-bold leading-tight text-brand-700">
                Edit addresses
              </Link>
            </div>
          )}

          {access.mode === 'admin' || (payload?.amendments || []).length ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-bold">Changes and payments</h2>
              {(payload?.amendments || []).length ? (
                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                  {payload.amendments.map((row) => (
                    <li key={row.id}>
                      {OPEN[row.status] || row.status} · {formatGbp(row.previous_total)} → {formatGbp(row.next_total)}
                      {row.paid_at ? ' · paid' : ''}
                      {row.acted_as === 'admin' ? ` · Admin${row.author ? ` (${row.author})` : ''}` : ''}
                      {row.created_at ? ` · ${formatDateTimeUK(row.created_at)}` : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No booking changes yet.</p>
              )}
            </section>
          ) : null}

          {Array.isArray(payload?.feedback) ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-bold">Feedback</h2>
              {payload.feedback.length ? (
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {payload.feedback.map((row) => (
                    <li key={row.id}>
                      <span className="font-semibold">Move {row.rating || '—'} · Driver {row.driver_rating || '—'}</span>
                      {row.review_text ? <span className="mt-1 block">{row.review_text}</span> : null}
                      <span className="block text-slate-500">{row.customer_name || 'Customer'} · {formatDateTimeUK(row.submitted_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No feedback yet.</p>
              )}
            </section>
          ) : null}
        </div>
      ) : null}
    </PortalShell>
  )
}

function floorLabel(value) {
  if (value == null || value === '') return ''
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  return n === 0 ? 'Ground' : String(n)
}

function liftLabel(value) {
  if (value == null || value === '') return ''
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return String(value)
}
