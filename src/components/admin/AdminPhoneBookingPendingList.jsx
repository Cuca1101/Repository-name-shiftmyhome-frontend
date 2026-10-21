import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { subscribeAdminDataRefresh } from '../../lib/adminDataRefresh'
import { supabase } from '../../lib/supabase'
import {
  fetchPendingAdminPhoneBookings,
  fetchSentAdminPhoneBookings,
  fetchTrashedAdminPhoneBookings,
  holdAdminPhoneBookingFromAvailableJobs,
  purgeTrashedAdminPhoneBooking,
  releaseAdminPhoneBookingToAvailableJobs,
  restoreTrashedAdminPhoneBooking,
  trashPendingAdminPhoneBooking,
} from '../../lib/data/quotesAdminRepository'
import { readPhoneBookingAttribution } from '../../lib/adminPhoneBooking'
import { formatDateTimeUK, formatDateUK } from '../../lib/formatDateDisplay'
import { previewPhoneQuoteEmail, sendPhoneQuoteEmail } from '../../lib/phoneQuoteApi'
import { PHONE_QUOTE_DEPOSIT_GBP, phoneQuoteFinalTotal, phoneQuotePaymentOptions } from '../../lib/phoneQuotePaymentRules'
import { copyTextToClipboard } from '../../lib/quoteRecoveryAdminApi'
import PhoneQuoteStatusBadge, { QuoteEmailSentBadge } from './PhoneQuoteStatusBadge'

const TABS = [
  { id: 'waiting', label: 'Drafts & quotes sent' },
  { id: 'sent', label: 'In Available Jobs' },
  { id: 'trash', label: 'Trash' },
]

/**
 * Latest successful quote-email recipient for each quote. Falls back to the quote email.
 * @param {string[]} ids
 */
async function latestQuoteEmailRecipients(ids) {
  const map = new Map()
  if (!supabase || !ids.length) return map
  const { data, error } = await supabase
    .from('customer_email_archive')
    .select('quote_id, recipient_email, sent_at')
    .in('quote_id', ids)
    .eq('event_key', 'phone_quote_sent')
    .order('sent_at', { ascending: false })
  if (error || !Array.isArray(data)) return map
  for (const row of data) {
    const id = String(row.quote_id || '')
    const email = String(row.recipient_email || '').trim()
    if (id && email && !map.has(id)) map.set(id, email)
  }
  return map
}

function money(n) {
  if (n == null || n === '') return '—'
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `£${v.toFixed(2)}`
}

/**
 * @param {{
 *   q: Record<string, unknown>,
 *   mode: 'waiting' | 'sent' | 'trash',
 *   busy: boolean,
 *   onRelease?: (id: string, ref: string) => void,
 *   onHold?: (id: string, ref: string) => void,
 *   onDelete?: (id: string, ref: string) => void,
 *   onRestore?: (id: string, ref: string) => void,
 *   onPurge?: (id: string, ref: string) => void,
 *   onCopyLink?: (id: string, ref: string, paymentType: 'full' | 'deposit') => void,
 *   onSendLink?: (id: string, ref: string, paymentType: 'full' | 'deposit') => void,
 *   recipientEmail?: string,
 * }} props
 */
function PhoneBookingJobRow({ q, mode, busy, onRelease, onHold, onDelete, onRestore, onPurge, onCopyLink, onSendLink, recipientEmail = '' }) {
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
  const attribution = readPhoneBookingAttribution(q)
  const latestPriceChange = attribution.priceChanges.length
    ? attribution.priceChanges[attribution.priceChanges.length - 1]
    : null
  const depositTitle = paymentOptions.depositAllowed
    ? ''
    : paymentOptions.alreadyPaid
      ? 'This quote is already paid.'
      : 'A £50 deposit is only available when the total is more than £50.'
  const btn =
    'inline-flex min-h-9 max-w-full items-center justify-center rounded-lg px-3 py-1.5 text-center text-xs font-semibold leading-none sm:text-sm disabled:opacity-50'

  return (
    <li className="min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:px-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-mono text-sm font-bold text-slate-900">{ref}</p>
          <PhoneQuoteStatusBadge q={q} />
          <QuoteEmailSentBadge sentAt={q.quote_sent_at} recipient={recipientEmail || q.email} />
          <p className="min-w-0 break-words text-sm font-semibold text-slate-900">{String(q.full_name || '—')}</p>
        </div>
        <p className="flex shrink-0 flex-wrap items-baseline gap-x-4 text-sm text-slate-800">
          <span>
            Total <strong className="tabular-nums text-slate-900">{money(total)}</strong>
          </span>
          <span>
            Outstanding <strong className="tabular-nums text-slate-900">{money(balance)}</strong>
          </span>
        </p>
      </div>
      <p className="mt-1 break-words text-sm leading-snug text-slate-700">
        <span>{String(q.pickup_address || '—')}</span>
        {q.delivery_address ? <span> → {String(q.delivery_address)}</span> : null}
        <span className="text-slate-300"> | </span>
        <span>Move: {q.move_date ? formatDateUK(q.move_date) : '—'}</span>
      </p>
      <p className="mt-0.5 text-xs leading-snug text-slate-500">
        Quote by: {attribution.quoteBy?.name || '—'} · {formatDateTimeUK(attribution.quoteBy?.at || q.created_at)}
        {q.quote_sent_at ? '' : ' · Not sent yet'}
        {mode === 'trash' && q.deleted_at ? ` · Deleted ${formatDateTimeUK(q.deleted_at)}` : ''}
      </p>
      {latestPriceChange ? (
        <p className="text-xs leading-snug text-slate-500">
          Price updated by: {latestPriceChange.by || '—'} · {formatDateTimeUK(latestPriceChange.at)}
          {latestPriceChange.from != null && latestPriceChange.to != null
            ? ` · ${money(latestPriceChange.from)} → ${money(latestPriceChange.to)}`
            : ''}
        </p>
      ) : null}
      <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
        <Link
          to={`/admin/new-phone-booking?edit=${encodeURIComponent(id)}`}
          className={`${btn} bg-sky-100 text-sky-800 hover:bg-sky-200`}
        >
          View &amp; Edit Quote
        </Link>
        {mode === 'trash' ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onRestore?.(id, ref)}
              className={`${btn} bg-emerald-100 text-emerald-800 hover:bg-emerald-200`}
            >
              Restore
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPurge?.(id, ref)}
              className={`${btn} border border-red-200 bg-white text-red-600 hover:bg-red-50`}
            >
              Delete permanently
            </button>
          </>
        ) : (
          <>
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
              className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}
            >
              Send payment link
            </button>
            <button
              type="button"
              disabled={busy || !paymentOptions.depositAllowed}
              title={depositTitle}
              onClick={() => onCopyLink?.(id, ref, 'deposit')}
              className={`${btn} border border-slate-200 bg-white text-slate-800 hover:bg-slate-50`}
            >
              Copy £{PHONE_QUOTE_DEPOSIT_GBP} link
            </button>
            <button
              type="button"
              disabled={busy || !paymentOptions.depositAllowed}
              title={depositTitle}
              onClick={() => onSendLink?.(id, ref, 'deposit')}
              className={`${btn} bg-slate-900 text-white hover:bg-slate-800`}
            >
              Send £{PHONE_QUOTE_DEPOSIT_GBP} link
            </button>
            {mode === 'waiting' ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRelease?.(id, ref)}
                  className={`${btn} bg-emerald-100 text-emerald-800 hover:bg-emerald-200`}
                >
                  Send to Available Jobs
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDelete?.(id, ref)}
                  className={`${btn} border border-red-200 bg-white text-red-600 hover:bg-red-50`}
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
          </>
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
  const [trashRows, setTrashRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sentRecipientById, setSentRecipientById] = useState(() => new Map())
  const [busyId, setBusyId] = useState('')
  const [message, setMessage] = useState('')
  const refreshTimer = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setActiveSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    if (!silent) setError('')
    try {
      const [waiting, sent, trash] = await Promise.all([
        fetchPendingAdminPhoneBookings(activeSearch),
        fetchSentAdminPhoneBookings(activeSearch),
        fetchTrashedAdminPhoneBookings(activeSearch),
      ])
      setWaitingRows(waiting)
      setSentRows(sent)
      setTrashRows(trash)
      const sentIds = [...waiting, ...sent, ...trash]
        .filter((row) => row?.quote_sent_at)
        .map((row) => String(row.id))
      try {
        setSentRecipientById(await latestQuoteEmailRecipients(sentIds))
      } catch {
        setSentRecipientById(new Map())
      }
      if (silent) setError('')
    } catch (e) {
      setError(e?.message || 'Could not load your jobs.')
      if (!silent) {
        setWaitingRows([])
        setSentRows([])
        setTrashRows([])
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [activeSearch])

  const scheduleSilentReload = useCallback(() => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null
      void load({ silent: true })
    }, 300)
  }, [load])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  useEffect(() => subscribeAdminDataRefresh(() => scheduleSilentReload()), [scheduleSilentReload])

  useEffect(() => {
    if (!supabase) return undefined
    const channel = supabase
      .channel('phone-booking-quote-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, () => {
        scheduleSilentReload()
      })
      .subscribe()
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
      void supabase.removeChannel(channel)
    }
  }, [scheduleSilentReload])

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
        `Move ${quoteRef || 'this booking'} to Trash? You can restore it from the Trash tab.`,
      )
    ) {
      return
    }
    setBusyId(id)
    setMessage('')
    setError('')
    try {
      await trashPendingAdminPhoneBooking(id)
      setMessage(`${quoteRef || 'Booking'} moved to Trash.`)
      await load()
      setTab('trash')
    } catch (e) {
      setError(e?.message || 'Could not move booking to Trash.')
    } finally {
      setBusyId('')
    }
  }

  async function handleRestore(id, quoteRef) {
    setBusyId(id)
    setMessage('')
    setError('')
    try {
      await restoreTrashedAdminPhoneBooking(id)
      setMessage(`${quoteRef || 'Booking'} is back in Drafts & quotes sent.`)
      await load()
      setTab('waiting')
    } catch (e) {
      setError(e?.message || 'Could not restore this booking.')
    } finally {
      setBusyId('')
    }
  }

  async function handlePurge(id, quoteRef) {
    if (
      !window.confirm(
        `Delete ${quoteRef || 'this booking'} permanently? It leaves Trash and cannot be restored.`,
      )
    ) {
      return
    }
    setBusyId(id)
    setMessage('')
    setError('')
    try {
      await purgeTrashedAdminPhoneBooking(id)
      setMessage(`${quoteRef || 'Booking'} deleted permanently.`)
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

  const rows = tab === 'sent' ? sentRows : tab === 'trash' ? trashRows : waitingRows

  return (
    <section id="admin-phone-booking-my-jobs" className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-900">My saved quotes</h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            A saved quote stays here. Open it only when you want. Delete moves a quote to Trash. In Trash,
            Restore brings it back, and Delete permanently removes it for good.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onCreateNew?.()}
          className="inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Create a new quote
        </button>
      </div>
      <div className="mt-3 flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-wrap gap-2">
          {TABS.map((t) => {
            const count = t.id === 'sent' ? sentRows.length : t.id === 'trash' ? trashRows.length : waitingRows.length
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex min-h-10 items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-sm font-semibold transition ${
                  active
                    ? 'border-blue-500 text-slate-900 ring-2 ring-blue-500/20'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                {t.label}
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs tabular-nums text-slate-600">
                  {loading ? '…' : count}
                </span>
              </button>
            )
          })}
        </div>
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            setActiveSearch(searchInput.trim())
          }}
        >
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search ref, name, phone, address..."
            className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            className="inline-flex min-h-10 shrink-0 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Search
          </button>
        </form>
      </div>

      <div className="mt-3 space-y-2">

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
                  : tab === 'trash'
                    ? 'Trash is empty.'
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
          <ul className="flex w-full min-w-0 flex-col gap-2">
            {rows.map((q) => (
              <PhoneBookingJobRow
                key={String(q.id)}
                q={q}
                mode={tab === 'sent' ? 'sent' : tab === 'trash' ? 'trash' : 'waiting'}
                busy={busyId === String(q.id)}
                onRelease={(id, ref) => void handleRelease(id, ref)}
                onHold={(id, ref) => void handleHold(id, ref)}
                onDelete={(id, ref) => void handleDelete(id, ref)}
                onRestore={(id, ref) => void handleRestore(id, ref)}
                onPurge={(id, ref) => void handlePurge(id, ref)}
                onCopyLink={(id, ref, paymentType) => void handleCopyLink(id, ref, paymentType)}
                onSendLink={(id, ref, paymentType) => void handleSendLink(id, ref, paymentType)}
                recipientEmail={sentRecipientById.get(String(q.id)) || ''}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
