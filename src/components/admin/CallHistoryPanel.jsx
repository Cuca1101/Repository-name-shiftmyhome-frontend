import { useEffect, useRef, useState } from 'react'
import { fetchCallHistory, fetchCallRecording } from '../../lib/adminCallHistoryApi'
import { subscribeAmazonConnectCallEnded } from '../../lib/amazonConnectCcp'
import PhoneActions from './PhoneActions'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30'

const STATUS_CLASS = {
  answered: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  missed: 'bg-amber-50 text-amber-950 ring-amber-200',
  abandoned: 'bg-slate-100 text-slate-700 ring-slate-200',
  rejected: 'bg-orange-50 text-orange-900 ring-orange-200',
  in_progress: 'bg-sky-50 text-sky-800 ring-sky-200',
  failed: 'bg-red-50 text-red-800 ring-red-200',
}

function londonDateInput(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function shiftDate(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day))
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

function defaultFilters() {
  const endDate = londonDateInput(new Date())
  return {
    startDate: shiftDate(endDate, -6),
    endDate,
    phone: '',
    direction: 'all',
    status: 'all',
  }
}

function formatWhen(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds)) || Number(seconds) < 0) return '—'
  const total = Math.round(Number(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

function StatusPill({ status, label }) {
  const tone = STATUS_CLASS[status] || STATUS_CLASS.abandoned
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${tone}`}>
      {label || '—'}
    </span>
  )
}

function recordingStateOf(call) {
  if (call.recordingState === 'available' || call.recordingState === 'processing' || call.recordingState === 'none') {
    return call.recordingState
  }
  return call.recordingAvailable ? 'available' : 'none'
}

function RecordingControl({ contactId, recordingState }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  if (recordingState === 'processing') {
    return <span className="text-sm text-amber-800">Recording processing</span>
  }
  if (recordingState !== 'available') {
    return <span className="text-sm text-slate-500">No recording</span>
  }

  async function play() {
    setBusy(true)
    setMessage('')
    try {
      const result = await fetchCallRecording(contactId)
      if (result?.recordingState === 'processing') {
        setMessage('Recording processing')
        return
      }
      if (!result?.recordingAvailable || !result?.playbackUrl) {
        setMessage('No recording')
        return
      }
      setUrl(result.playbackUrl)
    } catch (error) {
      setMessage(error?.message || 'Could not open the recording.')
    } finally {
      setBusy(false)
    }
  }

  if (message === 'No recording') return <span className="text-sm text-slate-500">No recording</span>
  if (message === 'Recording processing') {
    return <span className="text-sm text-amber-800">Recording processing</span>
  }

  return (
    <div className="min-w-0">
      {url ? (
        <audio controls preload="metadata" src={url} className="h-10 w-full max-w-xs">
          Your browser cannot play this recording.
        </audio>
      ) : (
        <button
          type="button"
          onClick={play}
          disabled={busy}
          className="inline-flex min-h-[40px] items-center rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? 'Opening…' : 'Play recording'}
        </button>
      )}
      {message ? <p className="mt-1 text-xs text-red-700">{message}</p> : null}
    </div>
  )
}

function HistoryPhone({ phone }) {
  if (!phone) return <span className="text-slate-500">Unknown</span>
  return <PhoneActions compact phone={phone} />
}

function CallCard({ call, refreshKey }) {
  const rows = [
    ['Telephone', <HistoryPhone key="phone" phone={call.phone} />],
    ['Direction', call.directionLabel || '—'],
    ['Queue', call.queue || '—'],
    ['Agent', call.agent || '—'],
    ['Waiting', formatDuration(call.waitSeconds)],
    ['Talk', formatDuration(call.talkSeconds)],
    ['Total', formatDuration(call.totalSeconds)],
  ]
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{formatWhen(call.initiatedAt)}</p>
        <StatusPill status={call.status} label={call.statusLabel} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className={label === 'Telephone' ? 'col-span-2 min-w-0' : 'min-w-0'}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
            <dd className={label === 'Telephone' ? 'text-slate-800' : 'truncate text-slate-800'}>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recording</p>
        <div className="mt-1">
          <RecordingControl
            key={`${call.id}-${refreshKey}`}
            contactId={call.id}
            recordingState={recordingStateOf(call)}
          />
        </div>
      </div>
    </article>
  )
}

export default function CallHistoryPanel() {
  const [draft, setDraft] = useState(defaultFilters)
  const [applied, setApplied] = useState(defaultFilters)
  const [pages, setPages] = useState([])
  const [pageIndex, setPageIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshGeneration, setRefreshGeneration] = useState(0)
  const appliedRef = useRef(applied)
  const loadRef = useRef(null)
  appliedRef.current = applied

  async function load(filters, cursor, mode) {
    setLoading(true)
    setError('')
    try {
      const result = await fetchCallHistory({
        startDate: filters.startDate,
        endDate: filters.endDate,
        phone: filters.phone,
        direction: filters.direction,
        status: filters.status,
        cursor: cursor || null,
      })
      const entry = {
        contacts: Array.isArray(result.contacts) ? result.contacts : [],
        nextCursor: result.nextCursor || null,
        totalCount: Number.isFinite(result.totalCount) ? result.totalCount : null,
      }
      if (mode === 'replace') {
        setPages([entry])
        setPageIndex(0)
        setRefreshGeneration((current) => current + 1)
      } else {
        setPages((current) => [...current, entry])
        setPageIndex((current) => current + 1)
      }
    } catch (err) {
      setError(err?.message || 'Could not load call history.')
      if (mode === 'replace') {
        setPages([])
        setPageIndex(0)
      }
    } finally {
      setLoading(false)
    }
  }

  loadRef.current = load

  useEffect(() => {
    const filters = defaultFilters()
    setDraft(filters)
    setApplied(filters)
    load(filters, null, 'replace')
    // The first search uses the default London date range only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let followUp = 0
    const unsubscribe = subscribeAmazonConnectCallEnded(() => {
      loadRef.current?.(appliedRef.current, null, 'replace')
      window.clearTimeout(followUp)
      followUp = window.setTimeout(() => {
        loadRef.current?.(appliedRef.current, null, 'replace')
      }, 20000)
    })
    return () => {
      window.clearTimeout(followUp)
      unsubscribe()
    }
  }, [])

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function onSubmit(event) {
    event.preventDefault()
    const next = { ...draft }
    setApplied(next)
    load(next, null, 'replace')
  }

  const page = pages[pageIndex] || null
  const contacts = page?.contacts || []

  function showPrevious() {
    if (pageIndex > 0) setPageIndex((current) => current - 1)
  }

  function showNext() {
    if (!page?.nextCursor || loading) return
    const cached = pages[pageIndex + 1]
    if (cached) {
      setPageIndex((current) => current + 1)
      return
    }
    load(applied, page.nextCursor, 'append')
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="admin-surface">
        <h3 className="text-base font-bold tracking-tight text-slate-900">Call History</h3>
        <p className="mt-1 text-sm text-slate-600">Previous Amazon Connect voice calls for this instance.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="block text-sm font-medium text-slate-700">
            From
            <input
              type="date"
              value={draft.startDate}
              onChange={(event) => updateDraft('startDate', event.target.value)}
              className={`${inputClass} mt-1`}
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            To
            <input
              type="date"
              value={draft.endDate}
              onChange={(event) => updateDraft('endDate', event.target.value)}
              className={`${inputClass} mt-1`}
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
            Telephone number
            <input
              type="search"
              inputMode="tel"
              autoComplete="off"
              placeholder="e.g. 07700 900123"
              value={draft.phone}
              onChange={(event) => updateDraft('phone', event.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Direction
            <select
              value={draft.direction}
              onChange={(event) => updateDraft('direction', event.target.value)}
              className={`${inputClass} mt-1`}
            >
              <option value="all">All</option>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Call status
            <select
              value={draft.status}
              onChange={(event) => updateDraft('status', event.target.value)}
              className={`${inputClass} mt-1`}
            >
              <option value="all">All</option>
              <option value="answered">Answered</option>
              <option value="missed">Missed</option>
              <option value="abandoned">Abandoned</option>
              <option value="rejected">Rejected</option>
              <option value="in_progress">In progress</option>
              <option value="failed">Failed</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-[40px] items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? 'Searching…' : 'Apply filters'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => load(applied, null, 'replace')}
            className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            Refresh
          </button>
          {page?.totalCount != null ? (
            <p className="text-sm text-slate-500">{page.totalCount} calls in this range</p>
          ) : null}
        </div>
      </form>

      {error === 'AWS configuration required' ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950" role="alert">
          AWS configuration required
        </p>
      ) : error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {loading && contacts.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" aria-hidden />
          Loading call history…
        </div>
      ) : null}

      {!loading && !error && contacts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          No calls matched these filters.
        </div>
      ) : null}

      {contacts.length > 0 ? (
        <>
          <div className="space-y-3 lg:hidden">
            {contacts.map((call) => (
              <CallCard key={`${call.id}-${refreshGeneration}`} call={call} refreshKey={refreshGeneration} />
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-[960px] w-full border-collapse text-left text-sm">
                <caption className="sr-only">Amazon Connect call history</caption>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-3 py-2">Date and time</th>
                    <th scope="col" className="px-3 py-2">Telephone</th>
                    <th scope="col" className="px-3 py-2">Direction</th>
                    <th scope="col" className="px-3 py-2">Queue</th>
                    <th scope="col" className="px-3 py-2">Agent</th>
                    <th scope="col" className="px-3 py-2">Status</th>
                    <th scope="col" className="px-3 py-2">Waiting</th>
                    <th scope="col" className="px-3 py-2">Talk</th>
                    <th scope="col" className="px-3 py-2">Total</th>
                    <th scope="col" className="px-3 py-2">Recording</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((call) => (
                    <tr key={call.id} className="border-b border-slate-100 last:border-0">
                      <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-900">{formatWhen(call.initiatedAt)}</td>
                      <td className="min-w-[16rem] px-3 py-3 text-slate-800">
                        <HistoryPhone phone={call.phone} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">{call.directionLabel || '—'}</td>
                      <td className="max-w-[10rem] truncate px-3 py-3 text-slate-700">{call.queue || '—'}</td>
                      <td className="max-w-[10rem] truncate px-3 py-3 text-slate-700">{call.agent || '—'}</td>
                      <td className="px-3 py-3">
                        <StatusPill status={call.status} label={call.statusLabel} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">{formatDuration(call.waitSeconds)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">{formatDuration(call.talkSeconds)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">{formatDuration(call.totalSeconds)}</td>
                      <td className="px-3 py-3">
                        <RecordingControl
                          key={`${call.id}-${refreshGeneration}`}
                          contactId={call.id}
                          recordingState={recordingStateOf(call)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
      {contacts.length > 0 || page?.nextCursor || pageIndex > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={showPrevious}
              disabled={pageIndex === 0 || loading}
              className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Newer calls
            </button>
            <p className="text-sm text-slate-500">Page {pageIndex + 1}</p>
            <button
              type="button"
              onClick={showNext}
              disabled={!page?.nextCursor || loading}
              className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Older calls
            </button>
          </div>
      ) : null}
    </div>
  )
}
