import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminRecordsSearchRow from './AdminRecordsSearchRow'
import {
  deletePendingAdminPhoneBooking,
  fetchPendingAdminPhoneBookings,
  fetchSentAdminPhoneBookings,
  holdAdminPhoneBookingFromAvailableJobs,
  releaseAdminPhoneBookingToAvailableJobs,
} from '../../lib/data/quotesAdminRepository'
import { formatDateTimeUK, formatDateUK } from '../../lib/formatDateDisplay'
import { previewPhoneQuoteEmail, sendPhoneQuoteEmail } from '../../lib/phoneQuoteApi'
import { PHONE_QUOTE_DEPOSIT_GBP, phoneQuoteFinalTotal, phoneQuotePaymentOptions } from '../../lib/phoneQuotePaymentRules'
import { copyTextToClipboard } from '../../lib/quoteRecoveryAdminApi'
import PhoneQuoteStatusBadge from './PhoneQuoteStatusBadge'

const TABS = [
  { id: 'waiting', label: 'Drafts & quotes sent' },
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
 *   onHold?: (id: string, ref: string) => void,
 *   onDelete?: (id: string, ref: string) => void,
 *   onCopyLink?: (id: string, ref: string, paymentType: 'full' | 'deposit') => void,
 *   onSendLink?: (id: string, ref: string, paymentType: 'full' | 'deposit') => void,
 * }} props
 */
function PhoneBookingJobRow({ q, mode, busy, onRelease, onHold, onDelete, onCopyLink, onSendLink }) {
  const id = String(q.id)
  const ref = String(q.quote_ref || '—')
  const total = phoneQuoteFinalTotal(q)
  const balance =
    q.remaining_balance != null && q.remaining_balance !== '' ? q.remaining_balance : total
  const paymentOptions = phoneQuotePaymentOptions({
    moveDate: q.move_date,
    arrivalTime: q.arrival_time || q.arrival_window,
    total,
    amountPaid: q.amount_paid,
    paymentStatus: q.payment_status,
  })
  const paid = paymentOptions.alreadyPaid
  const btn =
    'inline-flex min-h-[44px] items-center rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50'

  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-sm font-bold text-slate-900">{ref}</p>
          <PhoneQuoteStatusBadge q={q} />
        </div>
        <p className="mt-0.5 text-sm font-semibold text-slate-800">{String(q.full_name || '—')}</p>
        <p className="mt-1 text-xs text-slate-600">
          {String(q.pickup_address || '—')}
          {q.delivery_address ? ` → ${String(q.delivery_address)}` : ''}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Move {q.move_date ? formatDateUK(q.move_date) : '—'} · Created {formatDateTimeUK(q.created_at)}
          {q.quote_sent_at ? ` · Quote sent ${formatDateTimeUK(q.quote_sent_at)}` : ''}
        </p>
        <p className="mt-1 text-xs text-slate-700">
          Total <strong className="tabular-nums">{money(total)}</strong>
          {Number(q.amount_paid) > 0 ? (
            <>
              {' '}· Paid <strong className="tabular-nums">{money(q.amount_paid)}</strong>
            </>
          ) : null}
          {' '}· Balance <strong className="tabular-nums">{money(balance)}</strong>
        </p>
        {mode === 'sent' ? (
          <p className="mt-1 text-xs font-medium text-emerald-700">In Available Jobs</p>
        ) : (
          <p className="mt-1 text-xs font-medium text-amber-800">Not in Available Jobs yet</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <Link
          to={`/admin/new-phone-booking?edit=${encodeURIComponent(id)}`}
          className={`${btn} border border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100`}
        >
          Open quote
        </Link>
        <button
          type="button"
          disabled={busy || paid || total == null}
          onClick={() => onCopyLink?.(id, ref, 'full')}
          className={`${btn} border border-slate-200 bg-white text-slate-800 hover:bg-slate-50`}
        >
          {busy ? 'Working…' : 'Copy payment link'}
        </button>
        <button
          type="button"
          disabled={busy || paid || total == null}
          onClick={() => onSendLink?.(id, ref, 'full')}
          className={`${btn} bg-brand-600 text-white hover:bg-brand-700`}
        >
          Send payment link
        </button>
        {paymentOptions.depositAllowed ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onCopyLink?.(id, ref, 'deposit')}
              className={`${btn} border border-slate-200 bg-white text-slate-800 hover:bg-slate-50`}
            >
              Copy £{PHONE_QUOTE_DEPOSIT_GBP} link
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSendLink?.(id, ref, 'deposit')}
              className={`${btn} bg-slate-900 text-white hover:bg-slate-800`}
            >
              Send £{PHONE_QUOTE_DEPOSIT_GBP} link
            </button>
          </>
        ) : null}
        {mode === 'waiting' ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onRelease?.(id, ref)}
              className={`${btn} border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100`}
            >
              Send to Available Jobs
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDelete?.(id, ref)}
              className={`${btn} border border-red-200 bg-white text-red-800 hover:bg-red-50`}
            >
              Delete
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy || paid}
            onClick={() => onHold?.(id, ref)}
            className={`${btn} border border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100`}
          >
            Take out of Available Jobs
          </button>
        )}
      </div>
    </li>
  )
}

/**
 * @param {{ refreshKey?: number, onReleased?: (id: string) => void, onCreateNew?: () => void }} props
 */
export default function AdminPhoneBookingPendingList({ refreshKey = 0, onReleased, onCreateNew }) {
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

  async function handleHold(id, quoteRef) {
    if (
      !window.confirm(
        `Take ${quoteRef || 'this booking'} out of Available Jobs? It comes back here so you can edit it or send a payment link. Drivers will no longer see it.`,
      )
    ) {
      return
    }
    setBusyId(id)
    setMessage('')
    setError('')
    try {
      await holdAdminPhoneBookingFromAvailableJobs(id)
      setMessage(`${quoteRef || 'Booking'} is back on New phone booking.`)
      onReleased?.(id)
      await load()
      setTab('waiting')
    } catch (e) {
      setError(e?.message || 'Could not take this job out of Available Jobs.')
    } finally {
      setBusyId('')
    }
  }

  async function handleCopyLink(id, quoteRef, paymentType) {
    setBusyId(id)
    setMessage('')
    setError('')
    try {
      const res = await previewPhoneQuoteEmail(id, paymentType)
      const link = String(res?.pay_url || '').trim()
      if (!link) throw new Error('No payment link was returned.')
      await copyTextToClipboard(link)
      const label = paymentType === 'deposit' ? `£${PHONE_QUOTE_DEPOSIT_GBP} deposit link` : 'payment link'
      setMessage(`${label} for ${quoteRef || 'this quote'} copied. Paste it to the customer.`)
    } catch (e) {
      setError(e?.message || 'Could not copy the payment link.')
    } finally {
      setBusyId('')
    }
  }

  async function handleSendLink(id, quoteRef, paymentType) {
    const label = paymentType === 'deposit' ? `£${PHONE_QUOTE_DEPOSIT_GBP} deposit link` : 'full payment link'
    if (!window.confirm(`Email the ${label} for ${quoteRef || 'this quote'} to the customer?`)) return
    setBusyId(id)
    setMessage('')
    setError('')
    try {
      const res = await sendPhoneQuoteEmail(id, paymentType)
      setMessage(`${label} sent to ${res.to || 'the customer'}.`)
      await load()
    } catch (e) {
      setError(e?.message || 'Could not send the payment link.')
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">My saved quotes</h3>
            <p className="mt-1 text-sm text-slate-600">
              A saved quote stays here. Open it only when you want. The buttons under each quote copy or send the
              payment link, or add and remove it from Available Jobs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCreateNew?.()}
            className="inline-flex min-h-[44px] items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Create a new quote
          </button>
        </div>
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
                  ? 'No saved quotes yet. Press Create a new quote.'
                  : 'Nothing in Available Jobs yet — paid quotes move here automatically.'}
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
                onHold={(id, ref) => void handleHold(id, ref)}
                onDelete={(id, ref) => void handleDelete(id, ref)}
                onCopyLink={(id, ref, paymentType) => void handleCopyLink(id, ref, paymentType)}
                onSendLink={(id, ref, paymentType) => void handleSendLink(id, ref, paymentType)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
