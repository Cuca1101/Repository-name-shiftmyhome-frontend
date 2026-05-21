import { useCallback, useEffect, useState } from 'react'
import {
  buildAdminCleanupPreview,
  downloadCleanupCsv,
  exportQuotesCleanupCsv,
  LIVE_LAUNCH_CONFIRMATION_TEXT,
  runAdminTestDataCleanup,
} from '../../lib/adminDemoDataCleanup'
import { fetchLiveLaunchCleanupStats } from '../../lib/data/adminLiveLaunchCleanupRepository'
import { fetchAllJourneysForAdmin } from '../../lib/data/journeysRepository'
import { fetchAllJobs } from '../../lib/data/jobsRepository'
import { fetchQuotesForAdmin } from '../../lib/data/quotesAdminRepository'
import { fetchWebsiteFunnelCleanupStats } from '../../lib/data/websiteFunnelCleanupRepository'

/**
 * @param {{ open: boolean, onClose: () => void, onDone?: () => void | Promise<void> }} props
 */
export default function ProductionDataCleanupModal({ open, onClose, onDone }) {
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [preview, setPreview] = useState(
    /** @type {ReturnType<typeof buildAdminCleanupPreview> | null} */ (null),
  )
  const [serverStats, setServerStats] = useState(
    /** @type {{ quotesToArchive: number, quotesProtected: number, journeysToArchive: number } | null} */ (null),
  )
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [confirmText, setConfirmText] = useState('')

  const loadPreview = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const [quotes, journeys, jobs, funnelStats, rpcStats] = await Promise.all([
        fetchQuotesForAdmin('all', ''),
        fetchAllJourneysForAdmin(),
        fetchAllJobs(),
        fetchWebsiteFunnelCleanupStats().catch(() => null),
        fetchLiveLaunchCleanupStats().catch(() => null),
      ])
      setServerStats(rpcStats)
      setPreview(
        buildAdminCleanupPreview(quotes, journeys, jobs, {
          funnelEvents: funnelStats?.eventsTotal ?? 0,
          funnelLeads: funnelStats?.abandonedSessionsTotal ?? 0,
        }),
      )
    } catch (e) {
      setErr(e?.message || 'Could not load preview.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setConfirmText('')
      setMsg('')
      setErr('')
      setProgress('')
      void loadPreview()
    }
  }, [open, loadPreview])

  const confirmed =
    confirmText.trim().toUpperCase() === LIVE_LAUNCH_CONFIRMATION_TEXT

  async function handleRun() {
    if (!confirmed || !preview) return
    setBusy(true)
    setErr('')
    setMsg('')
    setProgress('Starting…')
    try {
      downloadCleanupCsv(
        exportQuotesCleanupCsv(preview.archiveQuotes),
        `smh-prelaunch-quotes-backup-${new Date().toISOString().slice(0, 10)}.csv`,
      )
      const result = await runAdminTestDataCleanup({
        archiveQuotes: true,
        hideTestJourneys: true,
        clearFunnel: true,
        clearJobPhotos: true,
        waiveCharges: true,
        cancelJobCards: true,
        useServerBatch: true,
        onProgress: setProgress,
      })
      if (result.errors.length) {
        setErr(`Completed with ${result.errors.length} error(s). First: ${result.errors[0]}`)
      }
      const parts = [
        `${result.archived} quote(s) archived`,
        `${result.journeysHidden} journey(s) hidden`,
        result.jobCardsCancelled ? `${result.jobCardsCancelled} job card(s) cancelled` : null,
        result.photosDeleted ? `${result.photosDeleted} photo(s) removed` : null,
        result.chargesWaived ? `${result.chargesWaived} charge(s) waived` : null,
        result.funnelEvents || result.funnelLeads
          ? `Funnel: ${result.funnelEvents} event(s), ${result.funnelLeads} lead(s) cleared`
          : null,
        `${result.preview.protectedQuotes} Stripe/paid booking(s) kept`,
      ].filter(Boolean)
      setMsg(parts.join('. ') + '.')
      await onDone?.()
      await loadPreview()
    } catch (e) {
      setErr(e?.message || 'Cleanup failed.')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  if (!open) return null

  const archiveCount = serverStats?.quotesToArchive ?? preview?.archiveQuoteCount ?? 0
  const journeyCount = serverStats?.journeysToArchive ?? preview?.testJourneyCount ?? 0
  const protectedCount = serverStats?.quotesProtected ?? preview?.protectedQuotes ?? 0
  const total =
    archiveCount +
    journeyCount +
    (preview?.linkedJobCards ?? 0)

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-slate-900/55 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prod-cleanup-title"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="prod-cleanup-title" className="text-lg font-bold text-slate-900">
          Clear all existing test/demo admin data
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Prepares admin for live launch. Archives every quote that is not a real Stripe-linked payment,
          hides journeys, cancels linked job cards, clears funnel test data, and downloads a CSV backup
          first. Pricing, items library, CMS, and driver accounts are not changed.
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Scanning…</p>
        ) : preview ? (
          <ul className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-800">
            <li>
              <span className="font-semibold">{archiveCount}</span> quote(s) to archive (all pre-launch
              except protected)
            </li>
            <li>
              <span className="font-semibold">{journeyCount}</span> journey(s) to archive
            </li>
            <li>
              <span className="font-semibold">{preview.linkedJobCards}</span> linked job card(s) to cancel
            </li>
            <li>
              <span className="font-semibold">{protectedCount}</span> protected (paid / Stripe) — kept
            </li>
            {preview.funnelEvents != null ? (
              <li>
                <span className="font-semibold">{preview.funnelEvents}</span> funnel event(s),{' '}
                <span className="font-semibold">{preview.funnelLeads}</span> lead row(s) eligible for
                cleanup
              </li>
            ) : null}
          </ul>
        ) : null}

        <label className="mt-4 block text-sm font-medium text-slate-800">
          Type <span className="font-mono text-red-800">{LIVE_LAUNCH_CONFIRMATION_TEXT}</span> to confirm
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200/60"
            placeholder={LIVE_LAUNCH_CONFIRMATION_TEXT}
          />
        </label>

        {progress ? <p className="mt-3 text-xs text-slate-600">{progress}</p> : null}
        {err ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {err}
          </p>
        ) : null}
        {msg ? <p className="mt-3 text-sm text-emerald-800">{msg}</p> : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !confirmed || total === 0}
            onClick={() => void handleRun()}
            className="min-h-[44px] rounded-xl bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Run live launch cleanup'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void loadPreview()}
            className="min-h-[44px] rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Refresh counts
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
