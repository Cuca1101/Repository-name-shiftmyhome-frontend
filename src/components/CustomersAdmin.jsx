import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AdminRecordsSearchRow from './admin/AdminRecordsSearchRow'
import CustomerKindBadge from './admin/CustomerKindBadge'
import { formatDateUK } from '../lib/formatDateDisplay'
import { formatGbp, jobModificationLock, portalPaymentFigures } from '../lib/customerPortalModel'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const PAGE_SIZE = 10

const SORTS = [
  { id: 'name', label: 'Name' },
  { id: 'bookings', label: 'Number of bookings' },
  { id: 'latest', label: 'Latest booking' },
  { id: 'paid', label: 'Total paid' },
  { id: 'outstanding', label: 'Outstanding balance' },
]

function statusLabel(booking) {
  const lock = jobModificationLock(booking)
  if (lock.reason === 'completed') return 'Completed'
  if (lock.reason === 'cancelled') return 'Cancelled'
  if (lock.reason === 'started') return 'In progress'
  return 'Booked'
}

function statusTone(label) {
  if (label === 'Completed') return 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
  if (label === 'Cancelled') return 'bg-slate-100 text-slate-600 ring-slate-200/80'
  if (label === 'In progress') return 'bg-amber-50 text-amber-900 ring-amber-200/80'
  return 'bg-blue-50 text-blue-800 ring-blue-200/80'
}

function latestBooking(customer) {
  const rows = Array.isArray(customer?.bookings) ? customer.bookings : []
  return [...rows].sort((a, b) => {
    const left = String(b.move_date || b.created_at || '')
    const right = String(a.move_date || a.created_at || '')
    return left.localeCompare(right)
  })[0] || null
}

function moneyTotals(customer) {
  const rows = Array.isArray(customer?.bookings) ? customer.bookings : []
  return rows.reduce((sum, row) => {
    const figures = portalPaymentFigures(row)
    sum.paid += Number(figures.paid) || 0
    if (jobModificationLock(row).reason !== 'cancelled') sum.balance += Number(figures.balance) || 0
    return sum
  }, { paid: 0, balance: 0 })
}

function profileKind(customer) {
  return Number(customer?.booking_count) > 1 ? 'returning' : 'new'
}

function firstBookingAt(customer) {
  if (customer?.first_booking_at) return customer.first_booking_at
  const rows = Array.isArray(customer?.bookings) ? customer.bookings : []
  return rows.map((row) => row.created_at).filter(Boolean).sort()[0] || null
}

function compareCustomers(sort, a, b) {
  if (sort === 'bookings') return (Number(b.booking_count) || 0) - (Number(a.booking_count) || 0)
  if (sort === 'latest') {
    const left = String(latestBooking(b)?.move_date || latestBooking(b)?.created_at || '')
    const right = String(latestBooking(a)?.move_date || latestBooking(a)?.created_at || '')
    return left.localeCompare(right)
  }
  if (sort === 'paid') return moneyTotals(b).paid - moneyTotals(a).paid
  if (sort === 'outstanding') return moneyTotals(b).balance - moneyTotals(a).balance
  const name = String(a.full_name || a.email || '').localeCompare(String(b.full_name || b.email || ''), 'en', { sensitivity: 'base' })
  return name || String(a.email || '').localeCompare(String(b.email || ''))
}

export default function CustomersAdmin() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('name')
  const [page, setPage] = useState(1)
  const [customers, setCustomers] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    loadCustomers(query)
      .then((rows) => {
        if (!cancelled) setCustomers(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          setCustomers(null)
          setError(err.message || 'Could not load customers.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [query])

  useEffect(() => {
    setPage(1)
  }, [query, sort])

  const sorted = useMemo(
    () => [...(customers || [])].sort((a, b) => compareCustomers(sort, a, b)),
    [customers, sort],
  )
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visible = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const searching = Boolean(query.trim())

  function openCustomer(id) {
    navigate(`/portal/bookings?customer=${id}`)
  }

  return (
    <div className="min-w-0">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          One file for each booking email, including customers who have not signed in to the portal. Leads and quote requests stay in their own lists.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <AdminRecordsSearchRow
          searchInput={input}
          onSearchInputChange={(event) => setInput(event.target.value)}
          onSearchSubmit={() => setQuery(input.trim())}
          placeholder="Name, email, or phone"
        />
        <label className="min-w-0 sm:w-56">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Sort</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm"
          >
            {SORTS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>
      ) : null}

      {loading && customers == null && !error ? (
        <p className="mt-4 text-sm text-slate-500">Loading customers…</p>
      ) : null}

      {!error && customers && customers.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          {searching
            ? 'No customers match that search.'
            : 'No customers yet. A paid booking creates the customer file automatically.'}
        </p>
      ) : null}

      {visible.length ? (
        <>
          <ul className="mt-4 space-y-3 lg:hidden">
            {visible.map((customer) => {
              const latest = latestBooking(customer)
              const totals = moneyTotals(customer)
              const label = latest ? statusLabel(latest) : ''
              return (
                <li key={customer.id}>
                  <article
                    className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    onClick={() => openCustomer(customer.id)}
                  >
                    <button type="button" onClick={() => openCustomer(customer.id)} className="block text-left">
                      <span className="block text-base font-bold text-slate-900">{customer.full_name || 'Unnamed customer'}</span>
                      <span className="mt-0.5 block break-all text-sm text-slate-500">{customer.email}</span>
                      <span className="mt-2 block"><CustomerKindBadge kind={profileKind(customer)} /></span>
                    </button>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</dt>
                        <dd className="mt-1 break-words font-medium text-slate-800">{customer.phone || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bookings</dt>
                        <dd className="mt-1 font-medium text-slate-800">
                          {customer.booking_count || 0}
                          {firstBookingAt(customer) ? (
                            <span className="mt-0.5 block text-xs font-normal text-slate-500">First {formatDateUK(firstBookingAt(customer))}</span>
                          ) : null}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest booking</dt>
                        <dd className="mt-1 font-medium text-slate-800">
                          {latest ? formatDateUK(latest.move_date) : '—'}
                          {label ? (
                            <span className={`ml-2 inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${statusTone(label)}`}>{label}</span>
                          ) : null}
                          {latest?.customer_kind ? (
                            <span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                              Booked as <CustomerKindBadge kind={latest.customer_kind} />
                            </span>
                          ) : null}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total paid</dt>
                        <dd className="mt-1 font-medium text-slate-800">{formatGbp(totals.paid)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Outstanding</dt>
                        <dd className="mt-1 font-medium text-slate-800">{formatGbp(totals.balance)}</dd>
                      </div>
                    </dl>
                    <Link
                      to={`/portal/bookings?customer=${customer.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700"
                    >
                      View customer portal
                    </Link>
                  </article>
                </li>
              )
            })}
          </ul>

          <div className="mt-4 hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-[24%] px-4 py-3">Customer name</th>
                  <th className="w-[14%] px-3 py-3">Phone</th>
                  <th className="w-[10%] px-3 py-3">Bookings</th>
                  <th className="w-[18%] px-3 py-3">Latest booking</th>
                  <th className="w-[12%] px-3 py-3">Total paid</th>
                  <th className="w-[12%] px-3 py-3">Outstanding</th>
                  <th className="w-[10%] px-3 py-3"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((customer) => {
                  const latest = latestBooking(customer)
                  const totals = moneyTotals(customer)
                  const label = latest ? statusLabel(latest) : ''
                  return (
                    <tr
                      key={customer.id}
                      className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                      onClick={() => openCustomer(customer.id)}
                    >
                      <td className="px-4 py-3">
                        <Link to={`/portal/bookings?customer=${customer.id}`} onClick={(event) => event.stopPropagation()} className="block font-bold text-slate-900 hover:text-brand-700">
                          {customer.full_name || 'Unnamed customer'}
                        </Link>
                        <span className="mt-0.5 block break-all text-xs text-slate-500">{customer.email}</span>
                        <span className="mt-1 block"><CustomerKindBadge kind={profileKind(customer)} /></span>
                      </td>
                      <td className="break-words px-3 py-3 text-slate-700">{customer.phone || '—'}</td>
                      <td className="px-3 py-3 font-semibold text-slate-800">
                        {customer.booking_count || 0}
                        {firstBookingAt(customer) ? (
                          <span className="mt-0.5 block text-xs font-normal text-slate-500">First {formatDateUK(firstBookingAt(customer))}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <span className="block text-slate-800">{latest ? formatDateUK(latest.move_date) : '—'}</span>
                        {label ? (
                          <span className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${statusTone(label)}`}>{label}</span>
                        ) : null}
                        {latest?.customer_kind ? (
                          <span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                            Booked as <CustomerKindBadge kind={latest.customer_kind} />
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{formatGbp(totals.paid)}</td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{formatGbp(totals.balance)}</td>
                      <td className="px-3 py-3">
                        <Link
                          to={`/portal/bookings?customer=${customer.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-brand-600 px-2 py-2 text-center text-xs font-bold leading-tight text-white hover:bg-brand-700"
                        >
                          View customer portal
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <p>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
                className="min-h-10 rounded-xl border border-slate-200 bg-white px-4 font-semibold text-slate-800 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={safePage >= pageCount}
                onClick={() => setPage(safePage + 1)}
                className="min-h-10 rounded-xl border border-slate-200 bg-white px-4 font-semibold text-slate-800 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

async function loadCustomers(query) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Customers are unavailable.')
  const { data, error } = await supabase.rpc('admin_customer_search', { p_query: query || '' })
  if (error) throw new Error(error.message || 'Could not load customers.')
  if (!data?.ok) throw new Error(data?.error === 'forbidden' ? 'Customers are available to admins only.' : 'Could not load customers.')
  return Array.isArray(data.customers) ? data.customers : []
}
