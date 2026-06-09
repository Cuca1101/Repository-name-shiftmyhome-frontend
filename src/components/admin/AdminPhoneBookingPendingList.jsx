import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminRecordsSearchRow from './AdminRecordsSearchRow'
import {
  deletePendingAdminPhoneBooking,
  fetchPendingAdminPhoneBookings,
  fetchSentAdminPhoneBookings,
  releaseAdminPhoneBookingToAvailableJobs,
} from '../../lib/data/quotesAdminRepository'
import { formatDateTimeUK } from '../../lib/formatDateDisplay'

const TABS = [
  { id: 'waiting', label: 'Waiting to send' },
  { id: 'sent', label: 'In Available Jobs' },
]

function money(n) {
  if (n == null || n === '') return '—'
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `£${v.toFixed(2)}`
}

/**
 * @param {{
 *   q: Record<string, unknown>,
 *   mode: 'waiting' | 'sent',
 *   busy: boolean,
 *   onRelease?: (id: string, ref: string) => void,
 *   onDelete?: (id: string, ref: string) => void,
 * }} props
 */
function PhoneBookingJobRow({ q, mode, busy, onRelease, onDelete }) {
  const id = String(q.id)
  const ref = String(q.quote_ref || '—')
  const total =
    q.remaining_balance != null && q.remaining_balance !== ''
      ? q.remaining_balance
      : q.estimated_total

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-bold text-slate-900">{ref}</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-800">{String(q.full_name || '—')}</p>
        <p className="mt-1 text-xs text-slate-600">
          {String(q.pickup_address || '—')}
          {q.delivery_address ? ` → ${String(q.delivery_address)}` : ''}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {q.move_date ? String(q.move_date) : '—'} · {money(total)} · {formatDateTimeUK(q.created_at)}
        </p>
        {mode === 'sent' ? (
          <p className="mt-1 text-xs font-medium text-emerald-700">Sent to Available Jobs</p>
        ) : (
          <p className="mt-1 text-xs font-medium text-amber-800">Waiting — not in Available Jobs yet</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2 sm:shrink-0">
        <Link
          to={`/admin/new-phone-booking?edit=${encodeURIComponent(id)}`}
          className="inline-flex min-h-[44px] items-center rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100"
        >
          Edit
        </Link>
        <Link
          to={`/admin/available-jobs/${id}`}
          className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          View
        </Link>
        {mode === 'waiting' ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onRelease?.(id, ref)}
              className="inline-flex min-h-[44px] items-center rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Send to Available Jobs'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDelete?.(id, ref)}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          </>
        ) : (
          <Link
            to="/admin/available-jobs"
            className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Open Available Jobs
          </Link>
        )}
      </div>
    </li>
  )
}

/**
 * @param {{ refreshKey?: number, onReleased?: (id: string) => void }} props
 */
export default function AdminPhoneBookingPendingList({ refreshKey = 0, onReleased }) {
  const [tab, setTab] = useState('waiting')
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [waitingRows, setWaitingRows] = useState([])
  const [sentRows, setSentRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setActiveSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [waiting, sent] = await Promise.all([
        fetchPendingAdminPhoneBookings(activeSearch),
        fetchSentAdminPhoneBookings(activeSearch),
      ])
      setWaitingRows(waiting)
      setSentRows(sent)
    } catch (e) {
      setError(e?.message || 'Could not load your jobs.')
      setWaitingRows([])
      setSentRows([])
    } finally {
      setLoading(false)
    }
  }, [activeSearch])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  async function handleRelease(id, quoteRef) {
    if (
      !window.confirm(
        `Send ${quoteRef || 'this booking'} to Available Jobs? Drivers and dispatch will see it there.`,
      )
    ) {
      return
    }
    setBusyId(id)
    setMessage('')
    setError('')
    try {
      await releaseAdminPhoneBookingToAvailableJobs(id)
      setMessage(
        `${quoteRef || 'Booking'} sent to Available Jobs. Open Available Jobs (filter: All paid) to assign a driver.`,
      )
      onReleased?.(id)
      await load()
      setTab('sent')
    } catch (e) {
      setError(e?.message || 'Could not send to Available Jobs.')
    } finally {
      setBusyId('')
    }
  }

  async function handleDelete(id, quoteRef) {
    if (
      !window.confirm(
        `Delete ${quoteRef || 'this booking'} permanently? This cannot be undone.`,
      )
    ) {
      return
    }
    setBusyId(id)
    setMessage('')
    setError('')
    try {
      await deletePendingAdminPhoneBooking(id)
      setMessage(`${quoteRef || 'Booking'} deleted.`)
      await load()
    } catch (e) {
      setError(e?.message || 'Could not delete booking.')
    } finally {
      setBusyId('')
    }
  }

  const rows = tab === 'sent' ? sentRows : waitingRows

  return (
    <section
      id="admin-phone-booking-my-jobs"
      className="rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-brand-100/50"
    >
      <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
        <h3 className="text-lg font-bold text-slate-900">My jobs created</h3>
        <p className="mt-1 text-sm text-slate-600">
          Every phone booking you create appears here first. Send to{' '}
          <strong className="font-semibold text-slate-800">Available Jobs</strong> when you are ready.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {TABS.map((t) => {
            const count = t.id === 'sent' ? sentRows.length : waitingRows.length
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? 'border-brand-500 bg-brand-50 text-brand-900 ring-2 ring-brand-500/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {t.label}
                <span
                  className={`rounded-md px-1.5 py-0.5 text-xs tabular-nums ${
                    active ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {loading ? '…' : count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-6">
        <AdminRecordsSearchRow
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search ref, name, phone, address…"
        />

        {message ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              {activeSearch
                ? 'No matching jobs in this tab.'
                : tab === 'waiting'
                  ? 'No jobs waiting — create one with the form below.'
                  : 'No jobs sent yet — use "Send to Available Jobs" on the Waiting tab.'}
            </p>
            {tab === 'waiting' ? (
              <p>
                Job already sent? Open the{' '}
                <button
                  type="button"
                  onClick={() => setTab('sent')}
                  className="font-semibold text-brand-700 underline"
                >
                  In Available Jobs
                </button>{' '}
                tab.
              </p>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {rows.map((q) => (
              <PhoneBookingJobRow
                key={String(q.id)}
                q={q}
                mode={tab === 'sent' ? 'sent' : 'waiting'}
                busy={busyId === String(q.id)}
                onRelease={(id, ref) => void handleRelease(id, ref)}
                onDelete={(id, ref) => void handleDelete(id, ref)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
