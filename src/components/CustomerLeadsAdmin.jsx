import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminRecordsSearchRow from './admin/AdminRecordsSearchRow'
import {
  deleteCustomerLeadById,
  fetchCustomerLeadsForAdmin,
} from '../lib/data/customerLeadsRepository'
import { CUSTOMER_LEAD_STATUS_LABELS } from '../lib/customerLeadStatus'
import { formatDateTimeUK } from '../lib/formatDateDisplay'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'abandoned', label: 'Abandoned' },
  { id: 'converted', label: 'Converted' },
]

const BADGE_TONES = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200/80',
  blue: 'bg-blue-50 text-blue-800 ring-blue-200/80',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200/80',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
  orange: 'bg-orange-50 text-orange-900 ring-orange-200/80',
  violet: 'bg-violet-50 text-violet-800 ring-violet-200/80',
}

function statusTone(status) {
  if (status === 'converted_to_booking') return 'green'
  if (status === 'abandoned') return 'orange'
  if (status === 'payment_started') return 'violet'
  if (status === 'quote_viewed') return 'blue'
  if (status === 'quote_started') return 'amber'
  return 'slate'
}

function StatusBadge({ status }) {
  const tone = BADGE_TONES[statusTone(status)] || BADGE_TONES.slate
  const label = CUSTOMER_LEAD_STATUS_LABELS[status] || status
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tone}`}>
      {label}
    </span>
  )
}

function money(n) {
  if (n == null || n === '') return '—'
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `£${v.toFixed(2)}`
}

function telHref(phone) {
  const p = String(phone || '').replace(/\s+/g, '')
  return p ? `tel:${p}` : null
}

function mailHref(email) {
  const e = String(email || '').trim()
  return e ? `mailto:${e}` : null
}

export default function CustomerLeadsAdmin() {
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setActiveSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await fetchCustomerLeadsForAdmin({ filter, search: activeSearch })
      setRows(list)
    } catch (e) {
      setError(e?.message || 'Failed to load customer leads.')
    } finally {
      setLoading(false)
    }
  }, [filter, activeSearch])

  useEffect(() => {
    load()
  }, [load])

  const runSearchNow = useCallback(() => {
    setActiveSearch(searchInput.trim())
  }, [searchInput])

  const handleDeleteLead = useCallback(
    async (row) => {
      const ref = row.lead_ref || 'this lead'
      const eff = row.effective_status || row.status
      const isConverted = eff === 'converted_to_booking'
      const msg = isConverted
        ? `Delete lead ${ref}? The booking/quote (${row.quote_ref || 'linked record'}) stays in the system — only this lead row is removed.`
        : `Delete lead ${ref}? This cannot be undone.`
      if (!window.confirm(msg)) return

      setDeletingId(String(row.id))
      setError('')
      try {
        await deleteCustomerLeadById(String(row.id))
        setRows((prev) => prev.filter((r) => String(r.id) !== String(row.id)))
      } catch (e) {
        setError(e?.message || 'Failed to delete lead.')
      } finally {
        setDeletingId('')
      }
    },
    [],
  )

  const emptyMessage = useMemo(() => {
    if (loading) return ''
    if (rows.length > 0) return ''
    return activeSearch ? 'No leads found.' : 'No customer leads yet.'
  }, [loading, rows.length, activeSearch])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Customer Leads</h2>
          <p className="mt-1 text-sm text-slate-600">
            Quote wizard and homepage enquiries saved before payment — reference format{' '}
            <code className="rounded bg-slate-100 px-1">SMH-LEAD-000001</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="min-h-[48px] rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 sm:min-h-0 sm:px-4 sm:py-2"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold ring-1 ring-inset transition ${
              filter === f.id
                ? 'bg-brand-600 text-white ring-brand-600'
                : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <AdminRecordsSearchRow
        searchInput={searchInput}
        onSearchInputChange={(e) => setSearchInput(e.target.value)}
        onSearchSubmit={runSearchNow}
      />

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        {loading ? (
          <p className="p-8 text-center text-slate-500">Loading…</p>
        ) : emptyMessage ? (
          <p className="p-8 text-center text-slate-600">{emptyMessage}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Lead ref</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="min-w-[160px] px-4 py-3">Route</th>
                  <th className="px-4 py-3">Quote price</th>
                  <th className="px-4 py-3">Agreed</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last activity</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const eff = row.effective_status || row.status
                  const phone = row.customer_phone
                  const email = row.customer_email
                  const callHref = telHref(phone)
                  const emailHref = mailHref(email)
                  const convertHref = row.quote_id
                    ? `/admin/quote-requests/${row.quote_id}`
                    : '/admin/new-phone-booking'

                  return (
                    <tr key={row.id} className="align-top text-slate-800">
                      <td className="px-4 py-3">
                        <Link
                          to={`/admin/customer-leads/${row.id}`}
                          className="font-mono text-xs font-semibold text-brand-700 hover:underline"
                        >
                          {row.lead_ref}
                        </Link>
                        {row.quote_ref ? (
                          <p className="mt-0.5 font-mono text-[10px] text-slate-500">{row.quote_ref}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{row.customer_name || '—'}</td>
                      <td className="px-4 py-3">{phone || '—'}</td>
                      <td className="max-w-[180px] truncate px-4 py-3" title={email || undefined}>
                        {email || '—'}
                      </td>
                      <td className="px-4 py-3">{row.service_type || '—'}</td>
                      <td className="max-w-[200px] truncate px-4 py-3" title={row.route_label || undefined}>
                        {row.route_label || '—'}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{money(row.estimated_total)}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {row.agreed_price != null ? (
                          <span className="font-semibold text-brand-800">{money(row.agreed_price)}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={eff} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                        {formatDateTimeUK(row.last_activity_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {formatDateTimeUK(row.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {callHref ? (
                            <a
                              href={callHref}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Call
                            </a>
                          ) : null}
                          {emailHref ? (
                            <a
                              href={emailHref}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Email
                            </a>
                          ) : null}
                          <Link
                            to={`/admin/customer-leads/${row.id}`}
                            className="rounded-lg border border-brand-200 bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-800 hover:bg-brand-100"
                          >
                            Details
                          </Link>
                          {eff !== 'converted_to_booking' ? (
                            <Link
                              to={convertHref}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Convert
                            </Link>
                          ) : null}
                          <button
                            type="button"
                            disabled={deletingId === String(row.id)}
                            onClick={() => handleDeleteLead(row)}
                            className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                          >
                            {deletingId === String(row.id) ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
