import { useEffect, useState } from 'react'
import { fetchTeamsCallHistory } from '../../lib/adminCallHistoryApi'
import TeamsCallButtons from './TeamsCallButtons'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30'

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
  return { startDate: shiftDate(endDate, -6), endDate, phone: '', direction: 'all', unansweredOnly: false }
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
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

function otherParty(call) {
  if (call.direction === 'inbound') return call.callerNumber || '—'
  if (call.direction === 'outbound') return call.calleeNumber || '—'
  return call.callerNumber || call.calleeNumber || '—'
}

export default function CallHistoryPanel() {
  const [draft, setDraft] = useState(defaultFilters)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  async function load(filters) {
    setLoading(true)
    setError('')
    try {
      const payload = await fetchTeamsCallHistory(filters)
      setResult(payload)
    } catch (err) {
      setResult(null)
      setError(err?.message || 'Could not load call history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const filters = defaultFilters()
    setDraft(filters)
    load(filters)
  }, [])

  const calls = Array.isArray(result?.calls) ? result.calls : []
  const configured = result?.configured === true

  return (
    <div className="space-y-4">
      <div className="admin-surface">
        <h3 className="text-base font-bold text-slate-900">Teams Phone history</h3>
        <p className="mt-1 text-sm text-slate-600">
          Rows come from Microsoft Graph PSTN call logs. Nothing is shown until that connection is configured.
        </p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault()
            load(draft)
          }}
        >
          <label className="text-sm font-medium text-slate-700">
            From
            <input type="date" value={draft.startDate} onChange={(event) => setDraft((c) => ({ ...c, startDate: event.target.value }))} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            To
            <input type="date" value={draft.endDate} onChange={(event) => setDraft((c) => ({ ...c, endDate: event.target.value }))} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Number
            <input value={draft.phone} onChange={(event) => setDraft((c) => ({ ...c, phone: event.target.value }))} className={`${inputClass} mt-1`} placeholder="Optional" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Direction
            <select value={draft.direction} onChange={(event) => setDraft((c) => ({ ...c, direction: event.target.value }))} className={`${inputClass} mt-1`}>
              <option value="all">All</option>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={draft.unansweredOnly}
              onChange={(event) => setDraft((c) => ({ ...c, unansweredOnly: event.target.checked }))}
            />
            Unanswered inbound only
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <button type="submit" className="inline-flex min-h-[40px] items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">
              Search
            </button>
          </div>
        </form>
      </div>

      {result?.message ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{result.message}</p>
      ) : null}
      {result?.missedNote ? <p className="text-sm text-slate-600">{result.missedNote}</p> : null}
      {result ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          Recordings: {result.recordingsAvailable ? 'Available' : 'Not available'}. {result.recordingsNote}
        </p>
      ) : null}
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading call history…</p> : null}

      {!loading && result && configured && calls.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">No Teams Phone calls in this range.</p>
      ) : null}
      {result?.truncated ? (
        <p className="text-sm text-slate-600">Microsoft Graph returned more rows than this page loads. Narrow the dates.</p>
      ) : null}

      {calls.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Direction</th>
                <th className="px-3 py-2">Number</th>
                <th className="px-3 py-2">Agent</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2">Call</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr key={call.id} className="border-b border-slate-100">
                  <td className="px-3 py-3">{formatWhen(call.startedAt)}</td>
                  <td className="px-3 py-3 capitalize">{call.direction}</td>
                  <td className="px-3 py-3 font-mono text-xs">{otherParty(call)}</td>
                  <td className="px-3 py-3">{call.agentName || '—'}</td>
                  <td className="px-3 py-3">{formatDuration(call.durationSeconds)}</td>
                  <td className="px-3 py-3">{call.unanswered ? 'Unanswered' : call.callType || '—'}</td>
                  <td className="px-3 py-3">
                    <TeamsCallButtons phone={otherParty(call) === '—' ? '' : otherParty(call)} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
