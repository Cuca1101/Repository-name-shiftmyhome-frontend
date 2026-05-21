import { useCallback, useEffect, useState } from 'react'
import {
  fetchWebsiteFunnelCleanupStats,
  runWebsiteFunnelCleanup,
} from '../../lib/data/websiteFunnelCleanupRepository'

const PRESETS = [
  { days: 7, label: 'Older than 7 days' },
  { days: 30, label: 'Older than 30 days' },
  { days: 90, label: 'Older than 90 days' },
]

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onCleaned: () => void | Promise<void>,
 * }} props
 */
export default function WebsiteFunnelCleanupModal({ open, onClose, onCleaned }) {
  const [presetDays, setPresetDays] = useState(30)
  const [clearEvents, setClearEvents] = useState(true)
  const [clearAbandoned, setClearAbandoned] = useState(true)
  const [clearDemo, setClearDemo] = useState(false)
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    setError('')
    try {
      const s = await fetchWebsiteFunnelCleanupStats()
      setStats(s)
    } catch (e) {
      setError(e?.message || 'Could not load stats.')
      setStats(null)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setToast('')
    setError('')
    setProgress('')
    void loadStats()
  }, [open, loadStats])

  useEffect(() => {
    if (!toast) return undefined
    const t = window.setTimeout(() => setToast(''), 5000)
    return () => window.clearTimeout(t)
  }, [toast])

  if (!open) return null

  async function handleRun(options = {}) {
    const events = options.clearEvents ?? clearEvents
    const abandoned = options.clearAbandoned ?? clearAbandoned
    const demo = options.clearDemo ?? clearDemo
    const days = options.presetDays ?? presetDays

    if (!events && !abandoned && !demo) {
      setError('Select at least one type of data to remove.')
      return
    }

    const summary = [
      events ? `analytics/events older than ${days} days` : null,
      abandoned ? `abandoned sessions older than ${days} days` : null,
      demo
        ? 'unpaid test funnel rows (by name/ref only — never paid or Stripe-linked quotes)'
        : null,
    ]
      .filter(Boolean)
      .join(', ')

    if (
      !window.confirm(
        `Remove ${summary}?\n\nPaid bookings and completed customer quotes will not be deleted.`,
      )
    ) {
      return
    }

    setRunning(true)
    setError('')
    setProgress('Starting cleanup…')
    try {
      const result = await runWebsiteFunnelCleanup({
        olderThanDays: days,
        clearEvents: events,
        clearAbandoned: abandoned,
        clearDemo: demo,
        onProgress: setProgress,
      })
      const parts = []
      if (result.eventsDeleted > 0) parts.push(`${result.eventsDeleted} event row(s)`)
      if (result.leadsDeleted > 0) parts.push(`${result.leadsDeleted} lead/session row(s)`)
      setToast(parts.length ? `Cleanup complete — removed ${parts.join(' and ')}.` : 'Cleanup complete — nothing matched.')
      await onCleaned()
      await loadStats()
    } catch (e) {
      setError(e?.message || 'Cleanup failed.')
    } finally {
      setRunning(false)
      setProgress('')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/50 p-3 sm:items-center sm:p-4"
      role="presentation"
      onClick={() => {
        if (!running) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="funnel-cleanup-title"
        className="max-h-[min(92vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200/90 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
          <h3 id="funnel-cleanup-title" className="text-lg font-bold text-slate-900">
            Clear old funnel data
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Admin-only cleanup for visitor analytics and idle funnel sessions. Tracking on the live site is
            unchanged.
          </p>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Analytics rows</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                {statsLoading ? '…' : (stats?.eventsTotal ?? '—')}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Abandoned sessions
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                {statsLoading ? '…' : (stats?.abandonedSessionsTotal ?? '—')}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Oldest event</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {statsLoading ? '…' : stats?.oldestEventLabel ?? '—'}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Age preset</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  disabled={running}
                  onClick={() => setPresetDays(p.days)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    presetDays === p.days
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <fieldset className="space-y-2" disabled={running}>
            <legend className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Include in cleanup
            </legend>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={clearEvents}
                onChange={(e) => setClearEvents(e.target.checked)}
              />
              <span className="text-sm text-slate-800">
                <span className="font-semibold">Visitor analytics & website events</span>
                <span className="mt-0.5 block text-xs text-slate-500">Page views, clicks, and funnel events</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={clearAbandoned}
                onChange={(e) => setClearAbandoned(e.target.checked)}
              />
              <span className="text-sm text-slate-800">
                <span className="font-semibold">Abandoned / idle sessions</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Browse-only and stale quote sessions (not paid)
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={clearDemo}
                onChange={(e) => setClearDemo(e.target.checked)}
              />
              <span className="text-sm text-slate-800">
                <span className="font-semibold">Test funnel rows</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Website leads/events with test-style name, email, or quote ref only.
                  Paid, deposit, or Stripe-linked quotes are always kept.
                </span>
              </span>
            </label>
          </fieldset>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={running}
              onClick={() =>
                void handleRun({ clearEvents: true, clearAbandoned: false, clearDemo: false })
              }
              className="min-h-[40px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Clear old analytics
            </button>
            <button
              type="button"
              disabled={running}
              onClick={() =>
                void handleRun({ clearEvents: true, clearDemo: true, clearAbandoned: true })
              }
              className="min-h-[40px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Clear test funnel data
            </button>
          </div>

          <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
            Never deletes: paid or deposit quotes, completed bookings, job records, quotes with Stripe
            payments, or leads linked to paid quotes. Does not remove rows from the quotes table.
          </p>

          {progress ? (
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600"
                aria-hidden
              />
              {progress}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          ) : null}
          {toast ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
              {toast}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
          <button
            type="button"
            disabled={running}
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => void handleRun()}
            className="min-h-[44px] rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {running ? 'Cleaning up…' : 'Run cleanup'}
          </button>
        </div>
      </div>
    </div>
  )
}
