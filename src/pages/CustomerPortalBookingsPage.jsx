import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import PortalShell, { usePortalAccess } from '../components/customer-portal/PortalShell'
import LiveDriverMap from '../components/tracking/LiveDriverMap'
import { getPortalBooking, getPortalContact, listPortalBookings, payPortalAmendment } from '../lib/customerPortalApi'
import { trackingClient } from '../lib/jobCustomerTracking'
import { formatGbp, jobModificationLock, portalPaymentFigures, portalTrackingPresentation, resolveDriverContact } from '../lib/customerPortalModel'
import { isTrackingGpsFresh } from '../lib/trackingDriverEta'
import { resolveCustomerTrackingStage } from '../lib/trackingJobStage'
import { COMPANY_PHONE_DISPLAY, COMPANY_PHONE_TEL } from '../constants/companyContact'
import CustomerKindBadge from '../components/admin/CustomerKindBadge'
import { formatDateUK } from '../lib/formatDateDisplay'

const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

function dashboardGroup(booking) {
  const lock = jobModificationLock(booking)
  if (lock.reason === 'cancelled') return 'cancelled'
  if (lock.reason === 'completed') return 'completed'
  if (lock.reason === 'started') return 'in_progress'
  return 'upcoming'
}

function statusLabel(booking) {
  const group = dashboardGroup(booking)
  if (group === 'completed') return 'Completed'
  if (group === 'cancelled') return 'Cancelled'
  if (group === 'in_progress') return 'In progress'
  return 'Booked'
}

function moveDate(iso, month = 'long') {
  const ymd = String(iso || '').slice(0, 10)
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return 'Date to be confirmed'
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month, year: 'numeric', timeZone: 'UTC' }).format(date)
}

function timeLabel(booking) {
  const window = String(booking.arrival_window || '').trim()
  const time = String(booking.arrival_time || '').trim()
  if (window && !/flex|exact|window/i.test(window)) return window
  if (time) return time
  if (window) return window.replaceAll('_', ' ')
  return 'Time to be confirmed'
}

function itemChips(booking) {
  const rows = Array.isArray(booking.inventory) ? booking.inventory : []
  const fromRows = rows.map((row) => {
    if (row?.summary) return String(row.summary)
    if (row?.name) return `${row.quantity || 1} × ${row.name}`
    return ''
  }).filter(Boolean)
  if (fromRows.length) return fromRows.slice(0, 3)
  return String(booking.inventory_text || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)
}

function paymentFigures(booking) {
  return portalPaymentFigures(booking)
}

function sortByDate(rows, direction) {
  return [...rows].sort((a, b) => {
    const left = String(a.move_date || '')
    const right = String(b.move_date || '')
    return direction === 'asc' ? left.localeCompare(right) : right.localeCompare(left)
  })
}

export default function CustomerPortalBookingsPage() {
  const location = useLocation()
  const access = usePortalAccess()
  const [rows, setRows] = useState(null)
  const [customerName, setCustomerName] = useState('')
  const [profileStats, setProfileStats] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('upcoming')
  const tabChosen = useRef(false)
  const passwordSaved = Boolean(location.state?.passwordSaved)

  useEffect(() => {
    let cancelled = false
    if (access.mode === 'anonymous') return undefined
    tabChosen.current = false
    setRows(null)
    setError('')
    listPortalBookings(access)
      .then((bookings) => {
        if (cancelled) return
        setRows(bookings)
        if (tabChosen.current) return
        tabChosen.current = true
        const hasUpcoming = bookings.some((row) => dashboardGroup(row) === 'upcoming')
        const hasProgress = bookings.some((row) => dashboardGroup(row) === 'in_progress')
        if (!hasUpcoming && hasProgress) setTab('in_progress')
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Could not load bookings.')
      })
    return () => {
      cancelled = true
    }
  }, [access.mode, access.customerId])

  useEffect(() => {
    let cancelled = false
    if (access.mode === 'anonymous') return undefined
    setCustomerName('')
    setProfileStats(null)
    getPortalContact(access)
      .then((contact) => {
        if (cancelled) return
        setCustomerName(String(contact?.fullName || '').trim())
        if (access.mode === 'admin') {
          setProfileStats({
            count: Number(contact?.bookingCount) || 0,
            first: contact?.firstBookingAt || null,
            kind: Number(contact?.bookingCount) > 1 ? 'returning' : 'new',
          })
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [access.mode, access.customerId])

  const grouped = useMemo(() => {
    const buckets = { upcoming: [], in_progress: [], completed: [], cancelled: [] }
    for (const row of rows || []) buckets[dashboardGroup(row)].push(row)
    buckets.upcoming = sortByDate(buckets.upcoming, 'asc')
    buckets.in_progress = sortByDate(buckets.in_progress, 'asc')
    buckets.completed = sortByDate(buckets.completed, 'desc')
    buckets.cancelled = sortByDate(buckets.cancelled, 'desc')
    return buckets
  }, [rows])

  const outstanding = (rows || [])
    .filter((row) => dashboardGroup(row) !== 'cancelled')
    .reduce((sum, row) => sum + paymentFigures(row).balance, 0)

  const featured = grouped[tab]?.[0] || null
  const showHero = tab === 'upcoming' || tab === 'in_progress'
  const listRows = grouped[tab] || []

  return (
    <PortalShell
      title="My bookings | ShiftMyHome"
      description="Upcoming, in-progress, and completed ShiftMyHome bookings."
      path="/portal/bookings"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Your bookings</h1>
          {(customerName || (rows || []).some((row) => String(row.full_name || '').trim())) ? (
            <p className="mt-1 text-base font-semibold text-slate-800">
              {customerName || (rows || []).map((row) => String(row.full_name || '').trim()).find(Boolean)}
            </p>
          ) : null}
          {access.mode === 'admin' && profileStats ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <CustomerKindBadge kind={profileStats.kind} />
              <p className="text-sm text-slate-600">
                {profileStats.count} {profileStats.count === 1 ? 'booking' : 'bookings'}
                {profileStats.first ? ` · first ${formatDateUK(profileStats.first)}` : ''}
              </p>
            </div>
          ) : null}
          <p className="mt-1 text-sm text-slate-500">Manage your move, payments and updates in one place.</p>
        </div>
        <Link to={access.portalTo('/portal/book')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-700">
          <span aria-hidden>+</span> New booking
        </Link>
      </div>

      {passwordSaved ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          Password saved. You can still sign in with an email link.
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Upcoming moves" value={String(grouped.upcoming.length)} tone="blue" icon="calendar" />
        <SummaryCard label="Completed moves" value={String(grouped.completed.length)} tone="green" icon="check" />
        <SummaryCard label="Outstanding balance" value={formatGbp(outstanding)} tone="blue" icon="card" />
      </section>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:flex-wrap xl:gap-x-5 xl:gap-y-2 xl:border-b xl:border-slate-200" role="tablist">
        {TABS.map((item) => {
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={`min-h-11 rounded-xl px-2 py-2 text-center text-sm font-semibold leading-snug xl:min-h-0 xl:rounded-none xl:border-b-2 xl:px-0 xl:pb-3 xl:pt-0 ${active ? 'bg-white text-brand-700 shadow-sm xl:border-brand-600 xl:bg-transparent xl:shadow-none' : 'text-slate-500 xl:border-transparent'}`}
            >
              {item.label} ({grouped[item.id].length})
            </button>
          )
        })}
      </div>

      {rows == null && !error ? <p className="mt-6 text-sm text-slate-500">Loading…</p> : null}

      {showHero && featured ? (
        <HeroMove booking={featured} />
      ) : null}
      {showHero && rows && !featured ? (
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          {tab === 'in_progress' ? 'No move is in progress.' : 'No upcoming moves. A new booking appears here after payment.'}
        </section>
      ) : null}

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <h2 className="text-base font-bold text-slate-900">
            {tab === 'cancelled' ? 'Cancelled bookings' : tab === 'completed' ? 'Completed bookings' : tab === 'in_progress' ? 'In progress' : 'Upcoming bookings'}
          </h2>
          {tab !== 'completed' && tab !== 'cancelled' ? (
            <button type="button" className="text-sm font-semibold text-brand-700" onClick={() => setTab('completed')}>
              View all history →
            </button>
          ) : null}
        </div>
        {listRows.length ? (
          <>
            <ul className="divide-y divide-slate-100 border-t border-slate-100 lg:hidden">
              {listRows.map((booking) => (
                <li key={booking.id} className="px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-slate-900">{booking.quote_ref || 'Booking'}</p>
                      {access.mode === 'admin' ? <span className="mt-1 block"><CustomerKindBadge kind={booking.customer_kind} /></span> : null}
                      {String(booking.full_name || '').trim() ? (
                        <p className="mt-0.5 text-slate-800">{booking.full_name}</p>
                      ) : null}
                      <p className="mt-1 text-slate-500">{moveDate(booking.move_date, 'short')}</p>
                      <p className="mt-1 flex gap-2 break-words text-slate-600"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#ea580c]" aria-hidden />{booking.pickup_address || 'Collection to be confirmed'}</p>
                      <p className="flex gap-2 break-words text-slate-600"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#059669]" aria-hidden />{booking.delivery_address || 'Delivery to be confirmed'}</p>
                    </div>
                    <StatusPill booking={booking} />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-semibold">{formatGbp(paymentFigures(booking).total || 0)}</span>
                    <Link to={access.portalTo(`/portal/bookings/${booking.id}`)} className="font-semibold text-brand-700">View</Link>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden border-t border-slate-100 lg:block">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Booking</th>
                    <th className="px-3 py-3 font-medium">Date</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Total</th>
                    <th className="px-5 py-3 text-right font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  {listRows.map((booking) => (
                    <tr key={booking.id} className="border-t border-slate-100">
                      <td className="break-words px-4 py-3 font-semibold text-slate-900">
                        <span className="block">{booking.quote_ref || 'Booking'}</span>
                        {access.mode === 'admin' ? <span className="mt-1 block"><CustomerKindBadge kind={booking.customer_kind} /></span> : null}
                        {String(booking.full_name || '').trim() ? (
                          <span className="mt-0.5 block text-xs font-semibold text-slate-700">{booking.full_name}</span>
                        ) : null}
                        <span className="mt-1 flex items-start gap-1.5 text-xs font-normal text-slate-500"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#ea580c]" aria-hidden />{booking.pickup_address || '—'}</span>
                        <span className="flex items-start gap-1.5 text-xs font-normal text-slate-500"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#059669]" aria-hidden />{booking.delivery_address || '—'}</span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{moveDate(booking.move_date, 'short')}</td>
                      <td className="px-3 py-3"><StatusPill booking={booking} /></td>
                      <td className="px-3 py-3 font-semibold">{formatGbp(paymentFigures(booking).total || 0)}</td>
                      <td className="px-5 py-3 text-right">
                        <Link to={access.portalTo(`/portal/bookings/${booking.id}`)} className="font-semibold text-brand-700">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : rows == null ? null : (
          <p className="border-t border-slate-100 px-5 py-4 text-sm text-slate-500">No bookings in this list yet.</p>
        )}
      </section>

      <section className="mt-5 flex flex-col gap-3 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-700">
          <span className="font-bold text-slate-900">Need help with your move?</span>{' '}
          Our friendly team is here to help with any questions about your booking, payments or moving day.
        </p>
        <Link to={access.portalTo('/portal/help')} className="shrink-0 text-sm font-bold text-brand-700">Contact our team →</Link>
      </section>
    </PortalShell>
  )
}

function HeroMove({ booking }) {
  const access = usePortalAccess()
  const [detail, setDetail] = useState(null)
  const [tracking, setTracking] = useState(null)
  const [trackingReady, setTrackingReady] = useState(false)
  const { total, paid, balance } = paymentFigures(booking)
  const lock = jobModificationLock(booking)
  const pickup = splitAddress(booking.pickup_address)
  const delivery = splitAddress(booking.delivery_address)
  const chips = itemChips(booking)
  const openChange = (detail?.amendments || []).find((row) =>
    ['pending_approval', 'pending_payment', 'paid_needs_review'].includes(row.status),
  )

  useEffect(() => {
    let cancelled = false
    setDetail(null)
    setTracking(null)
    setTrackingReady(false)
    if (access.mode === 'anonymous') return undefined
    getPortalBooking(booking.id, access)
      .then((payload) => {
        if (!cancelled) setDetail(payload)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [booking.id, access.mode, access.customerId])

  useEffect(() => {
    const client = trackingClient()
    const id = String(detail?.tracking_token || '').trim()
    if (!client || !id) {
      setTracking(null)
      setTrackingReady(false)
      return undefined
    }
    let cancelled = false
    async function load() {
      const { data: portal, error } = await client.rpc('public_get_job_tracking', { p_token: id })
      if (cancelled) return
      setTrackingReady(true)
      setTracking(!error && portal?.ok ? portal : null)
    }
    load()
    const timer = window.setInterval(load, 10000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [detail?.tracking_token])

  const driver = resolveDriverContact(
    {
      ...booking,
      assigned_driver_id: detail?.booking?.assigned_driver_id ?? booking.assigned_driver_id,
      assigned_driver_name: detail?.booking?.assigned_driver_name ?? booking.assigned_driver_name,
      assigned_driver_phone: detail?.booking?.assigned_driver_phone ?? booking.assigned_driver_phone,
    },
    trackingReady ? tracking : null,
  )

  return (
    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(15rem,0.85fr)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{lock.reason === 'started' ? 'Your move in progress' : 'Your upcoming move'}</h2>
            {String(booking.full_name || '').trim() ? (
              <p className="mt-1 text-sm font-semibold text-slate-800">{booking.full_name}</p>
            ) : null}
            <p className="mt-1 text-sm text-slate-500">Reference: {booking.quote_ref || 'Booking'}</p>
          </div>
          {driver.state === 'unassigned' ? null : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Driver assigned
            </span>
          )}
        </div>
        {openChange ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            {openChange.status === 'pending_payment' ? 'Waiting for payment' : 'Pending approval'}. This change is not confirmed.
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-3 text-sm text-slate-700 sm:flex-row sm:gap-6">
          <p className="inline-flex items-center gap-2 font-medium"><CalendarIcon /> {moveDate(booking.move_date)}</p>
          <p className="inline-flex items-center gap-2 font-medium"><ClockIcon /> {timeLabel(booking)}</p>
        </div>
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <AddressRow tone="collection" label="Collection" line={pickup.line} rest={pickup.rest} />
          <AddressRow tone="delivery" label="Delivery" line={delivery.line} rest={delivery.rest} />
        </div>
        {chips.length ? (
          <div className="mt-4">
            <p className="text-sm font-bold text-slate-900">Your items</p>
            <ul className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {chips.map((label) => (
                <li key={label} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <ItemIcon label={label} />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-slate-600">
          <TeamIcon />
          {booking.crew_size ? `${booking.crew_size}-person team` : 'Team to be confirmed'}
        </p>
        <BookingActions booking={booking} lock={lock} driver={driver} />
      </section>

      <div className="grid grid-cols-1 gap-4">
        <PaymentCard booking={booking} total={total} paid={paid} balance={balance} openChange={openChange} />
        <DriverCard booking={booking} token={detail?.tracking_token || ''} tracking={tracking} />
      </div>
    </div>
  )
}

function PaymentCard({ booking, total, paid, balance, openChange }) {
  const access = usePortalAccess()
  const [paying, setPaying] = useState(false)
  const [note, setNote] = useState('')

  async function pay() {
    setNote('')
    if (openChange?.status === 'pending_payment') {
      setPaying(true)
      try {
        const result = await payPortalAmendment(booking.id, openChange.id, access)
        if (result?.checkoutUrl) window.location.assign(result.checkoutUrl)
        else setNote('Payment could not be started. Your confirmed booking is unchanged.')
      } catch (err) {
        setNote(err?.message || 'Payment could not be started. Your confirmed booking is unchanged.')
      } finally {
        setPaying(false)
      }
      return
    }
    setNote('The remaining balance is separate from a booking change. Call the team to pay it.')
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-bold text-slate-900">Payment summary</h2>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Booking total</dt>
          <dd className="font-semibold">{total != null ? formatGbp(total) : '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Already paid</dt>
          <dd className="font-semibold">{formatGbp(paid)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-slate-100 pt-3">
          <dt className="font-bold text-slate-900">Remaining balance</dt>
          <dd className="text-lg font-extrabold text-slate-900">{formatGbp(balance)}</dd>
        </div>
      </dl>
      {balance >= 0.3 || openChange?.status === 'pending_payment' ? (
        <button
          type="button"
          onClick={pay}
          disabled={paying}
          className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {paying ? 'Opening payment…' : openChange?.status === 'pending_payment' ? 'Pay the difference' : 'Pay balance'}
        </button>
      ) : null}
      {note ? (
        <p className="mt-3 text-sm text-slate-600">
          {note}{' '}
          <a className="font-semibold text-brand-700" href={`tel:${COMPANY_PHONE_TEL}`}>{COMPANY_PHONE_DISPLAY}</a>
        </p>
      ) : null}
    </section>
  )
}

function BookingActions({ booking, lock, driver }) {
  const { portalTo } = usePortalAccess()
  const viewClass = 'inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-600 px-3 py-3 text-center text-sm font-bold leading-tight text-white hover:bg-brand-700'
  const actionClass = 'inline-flex min-h-12 items-center justify-center rounded-xl border border-brand-200 px-3 py-3 text-center text-sm font-bold leading-tight text-brand-700 hover:bg-brand-50'
  return (
    <div className="mt-5 space-y-2">
      {lock.locked ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-950">
          This move is underway. Changes to the date, items or addresses need the ShiftMyHome team.
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Link to={portalTo(`/portal/bookings/${booking.id}`)} className={viewClass}>
          View booking
        </Link>
        {lock.locked ? null : (
          <>
            <Link to={portalTo(`/portal/bookings/${booking.id}/edit#portal-edit-date`)} className={actionClass}>
              Change date
            </Link>
            <Link to={portalTo(`/portal/bookings/${booking.id}/edit#portal-edit-items`)} className={actionClass}>
              Edit items
            </Link>
            <Link to={portalTo(`/portal/bookings/${booking.id}/edit#portal-edit-addresses`)} className={actionClass}>
              Edit addresses
            </Link>
          </>
        )}
        {driver.state === 'ready' ? (
          <a href={`tel:${driver.tel}`} className={actionClass}>
            <span>
              Contact driver
              <span className="mt-0.5 block text-xs font-semibold">{driver.display}</span>
            </span>
          </a>
        ) : null}
        <a href={`tel:${COMPANY_PHONE_TEL}`} className={actionClass}>
          <span>
            Contact ShiftMyHome Team
            <span className="mt-0.5 block text-xs font-semibold">{COMPANY_PHONE_DISPLAY}</span>
          </span>
        </a>
      </div>
      {driver.state === 'ready' ? null : (
        <p className="text-sm leading-5 text-slate-600">{driver.message}</p>
      )}
    </div>
  )
}

function DriverCard({ booking, token, tracking }) {
  const data = tracking?.ok ? tracking : null

  const stage = resolveCustomerTrackingStage(data)
  const gpsFresh = isTrackingGpsFresh({ trackingLive: data?.tracking_live, location: data?.location })
  const hasCoords = Number.isFinite(Number(data?.location?.latitude)) && Number.isFinite(Number(data?.location?.longitude))
  const presentation = portalTrackingPresentation({ stage: stage.stage, gpsFresh, hasCoords })
  const driverName = data
    ? (data.driver?.full_name || 'Driver not assigned yet')
    : (booking.assigned_driver_name || 'Driver not assigned yet')
  const driverAssigned = data ? Boolean(data.driver?.full_name) : Boolean(booking.assigned_driver_name)
  const trackTo = token ? `/track/${token}` : `/portal/bookings/${booking.id}`

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-bold text-slate-900">Your driver</h2>
      <div className="mt-3 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <PersonIcon />
        </span>
        <span>
          <span className="block text-sm font-bold text-slate-900">{driverName}</span>
          <span className="block text-xs text-slate-500">{driverAssigned ? 'Your assigned driver' : 'Assignment pending'}</span>
        </span>
      </div>
      {presentation.showLivePosition ? (
        <div className="mt-3">
          <LiveDriverMap
            latitude={Number(data.location.latitude)}
            longitude={Number(data.location.longitude)}
            heading={Number(data.location.heading)}
            live={gpsFresh}
            driverName={driverName}
            quoteRef={booking.quote_ref || data?.quote_ref || ''}
            pickupAddress={data?.pickup_address || booking.pickup_address || ''}
            deliveryAddress={data?.delivery_address || booking.delivery_address || ''}
            destinationKind={stage.etaKind || (stage.stage === 'en_route_collection' ? 'collection' : null)}
          />
        </div>
      ) : null}
      <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600">
        <ClockIcon />
        {presentation.awaitingStart || !data
          ? 'Not on the way yet'
          : presentation.message || stage.badge || 'On the job'}
      </p>
      <Link to={trackTo} className="mt-3 flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700">
        Track my driver
      </Link>
      <p className="mt-2 text-center text-xs text-slate-500">
        {presentation.awaitingStart || !presentation.showLivePosition
          ? 'Tracking becomes available when your driver starts the journey.'
          : 'Live position is shown only while the GPS update is fresh.'}
      </p>
    </section>
  )
}

function SummaryCard({ label, value, tone, icon }) {
  const iconClass = tone === 'green' ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand-600'
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${iconClass}`}>
        {icon === 'check' ? <CheckIcon /> : icon === 'card' ? <CardIcon /> : <CalendarIcon />}
      </span>
      <span>
        <span className="block text-xs font-medium text-slate-500">{label}</span>
        <span className="block text-xl font-extrabold text-slate-900">{value}</span>
      </span>
    </article>
  )
}

function StatusPill({ booking }) {
  const group = dashboardGroup(booking)
  const tone = group === 'completed'
    ? 'bg-emerald-50 text-emerald-700'
    : group === 'cancelled'
      ? 'bg-rose-50 text-rose-700'
      : group === 'in_progress'
        ? 'bg-amber-50 text-amber-800'
        : 'bg-brand-50 text-brand-700'
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{statusLabel(booking)}</span>
}

function splitAddress(value) {
  const parts = String(value || '').split(',').map((part) => part.trim()).filter(Boolean)
  if (!parts.length) return { line: 'Address to be confirmed', rest: '' }
  return { line: parts[0], rest: parts.slice(1).join(', ') }
}

function AddressRow({ tone, label, line, rest }) {
  return (
    <div className="flex gap-3">
      <span className={`mt-0.5 h-3 w-3 shrink-0 rounded-full ${tone === 'delivery' ? 'bg-[#059669]' : 'bg-[#ea580c]'}`} />
      <p className="min-w-0 text-sm">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <span className="block break-words font-semibold text-slate-900">{line}</span>
        {rest ? <span className="block break-words text-slate-500">{rest}</span> : null}
      </p>
    </div>
  )
}

function ItemIcon({ label }) {
  const name = String(label).toLowerCase()
  if (name.includes('bed')) return <BedIcon />
  if (name.includes('box')) return <BoxIcon />
  return <SofaIcon />
}

function CalendarIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" strokeLinecap="round" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" strokeLinecap="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 12.5 11 15l4.5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CardIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </svg>
  )
}

function TeamIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="9" cy="9" r="3" />
      <circle cx="16" cy="10" r="2.2" />
      <path d="M4 19c.8-2.4 2.6-3.6 5-3.6s4.2 1.2 5 3.6M14 15.5c1.4-.3 2.6.1 3.6 1.3" strokeLinecap="round" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="8" r="3" />
      <path d="M6 19c1.2-2.5 3.2-3.8 6-3.8S16.8 16.5 18 19" strokeLinecap="round" />
    </svg>
  )
}

function SofaIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M5 12V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3" strokeLinecap="round" />
      <path d="M4 12h16v5H4zM7 17v2M17 17v2" strokeLinecap="round" />
    </svg>
  )
}

function BedIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 18V8M4 14h16v4M8 14v-2a2 2 0 0 1 2-2h2" strokeLinecap="round" />
    </svg>
  )
}

function BoxIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 8l8-4 8 4-8 4-8-4Z" strokeLinejoin="round" />
      <path d="M4 8v8l8 4 8-4V8M12 12v8" strokeLinejoin="round" />
    </svg>
  )
}
