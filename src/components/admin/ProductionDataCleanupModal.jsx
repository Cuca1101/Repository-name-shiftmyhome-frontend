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
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onDone?: () => void | Promise<void>,
 *   showPinHint?: boolean,
 * }} props
 */
export default function ProductionDataCleanupModal({
  open,
  onClose,
  onDone,
  showPinHint = false,
}) {
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
  const [lastResult, setLastResult] = useState(
    /** @type {Awaited<ReturnType<typeof runAdminTestDataCleanup>> | null} */ (null),
  )

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
      setLastResult(null)
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
      setLastResult(result)
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
          ? `Funnel cleared: ${result.funnelEvents} events, ${result.funnelLeads} leads`
          : null,
        `${result.skippedProtected} protected (Stripe-linked) skipped`,
        `Lists after refresh: ${result.quotesAfter.length} quote(s), ${result.journeysAfter.length} journey(s) visible`,
        result.quotesRemainingVisible > 0
          ? `Warning: ${result.quotesRemainingVisible} non-protected row(s) still visible — re-run or check DB`
          : null,
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
        {showPinHint ? (
          <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            Protected verification complete. Confirm below to archive pre-launch test data.
          </p>
        ) : null}
        <p className="mt-2 text-sm text-slate-600">
          Archives quotes without a real Stripe payment ID, hides journeys, clears funnel test rows, and
          downloads a CSV backup first. Only Stripe-linked live payments are kept.
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Scanning…</p>
        ) : preview ? (
          <ul className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-800">
            <li>
              <span className="font-semibold">{archiveCount}</span> quote(s) to archive
            </li>
            <li>
              <span className="font-semibold">{journeyCount}</span> journey(s) to archive
            </li>
            <li>
              <span className="font-semibold">{preview.linkedJobCards}</span> job card(s) to cancel
            </li>
            <li>
              <span className="font-semibold">{preview.marketplaceVisibleCount ?? 0}</span> marketplace
              listing(s) today
            </li>
            <li>
              <span className="font-semibold">{protectedCount}</span> Stripe-linked — kept
            </li>
            {preview.funnelEvents != null ? (
              <li>
                Funnel: <span className="font-semibold">{preview.funnelEvents}</span> events,{' '}
                <span className="font-semibold">{preview.funnelLeads}</span> leads
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
