import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchActiveFleetDriversForDispatch } from '../../lib/journeyFleetDrivers'
import {
  assessJourneyDriverAssignReadiness,
  assessQuoteDriverAssignmentEligibility,
  assignJourneyInternalDriver,
  journeyQuoteIdsFromStops,
} from '../../lib/journeyDriverAssign'
import { journeyAssignedDriverLabel } from '../../lib/journeyPlannerDisplay'
import JourneyAssignDriverModal from './JourneyAssignDriverModal'

/**
 * @param {{
 *   journey: Record<string, unknown> | null,
 *   journeyId: string,
 *   quotes: Record<string, unknown>[],
 *   stops: import('../../lib/journeyPlannerModel.js').JourneyStop[],
 *   variant?: 'dark' | 'light' | 'primary',
 *   onAssigned?: () => void | Promise<void>,
 *   className?: string,
 * }} props
 */
export default function JourneyAssignDriverButton({
  journey,
  journeyId,
  quotes,
  stops,
  variant = 'light',
  onAssigned,
  className = '',
}) {
  const [drivers, setDrivers] = useState(/** @type {{ id: string, name: string }[]} */ ([]))
  const [driversLoaded, setDriversLoaded] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [toast, setToast] = useState(/** @type {{ type: 'ok' | 'err', text: string } | null} */ (null))

  useEffect(() => {
    let cancelled = false
    void fetchActiveFleetDriversForDispatch()
      .then((list) => {
        if (cancelled) return
        setDrivers(list.map((d) => ({ id: d.id, name: d.name })))
      })
      .finally(() => {
        if (!cancelled) setDriversLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const t = window.setTimeout(() => setToast(null), 7000)
    return () => window.clearTimeout(t)
  }, [toast])

  const readiness = useMemo(
    () =>
      assessJourneyDriverAssignReadiness({
        journey,
        journeyId,
        quotes,
        stops,
        activeDrivers: drivers,
      }),
    [journey, journeyId, quotes, stops, drivers],
  )

  const assignedDriverName = useMemo(
    () => (journey ? journeyAssignedDriverLabel(journey, quotes) : ''),
    [journey, quotes],
  )

  const handleOpen = useCallback(() => {
    if (!driversLoaded) {
      setToast({ type: 'err', text: 'Loading drivers…' })
      return
    }
    if (readiness.blockReason) {
      setToast({ type: 'err', text: readiness.blockReason })
      return
    }
    if (!readiness.canOpenModal) {
      setToast({ type: 'err', text: readiness.blockReason || 'Cannot assign driver right now.' })
      return
    }
    setModalOpen(true)
  }, [driversLoaded, readiness])

  async function handleConfirm(driver, _opts) {
    setAssigning(true)
    try {
      const quoteIds = journeyQuoteIdsFromStops(stops, quotes)
      const quotesById = new Map(quotes.map((q) => [String(q.id), q]))
      const toAssign = quoteIds
        .map((id) => quotesById.get(id))
        .filter((q) => q && assessQuoteDriverAssignmentEligibility(q, driver.id).eligible)

      const result = await assignJourneyInternalDriver({
        journeyId,
        quotes: toAssign,
        driverId: driver.id,
        driverName: driver.name,
      })

      const parts = []
      if (result.assigned.length) {
        parts.push(
          `${result.assigned.length} job${result.assigned.length === 1 ? '' : 's'} assigned to ${driver.name}.`,
        )
      }
      if (result.skipped.length) {
        parts.push(`${result.skipped.length} skipped.`)
      }
      if (result.failed.length) {
        parts.push(`${result.failed.length} failed.`)
      }

      setModalOpen(false)
      if (result.failed.length && !result.assigned.length) {
        setToast({ type: 'err', text: parts.join(' ') || 'Assignment failed.' })
      } else if (result.failed.length || result.skipped.length) {
        setToast({
          type: result.assigned.length ? 'ok' : 'err',
          text: parts.join(' '),
        })
      } else {
        setToast({ type: 'ok', text: parts.join(' ') || `Dispatched to ${driver.name}.` })
      }
      await onAssigned?.()
    } catch (e) {
      setToast({ type: 'err', text: e?.message || 'Assignment failed.' })
    } finally {
      setAssigning(false)
    }
  }

  const btnClass =
    variant === 'primary' || variant === 'light'
      ? 'min-h-[44px] w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-500 disabled:opacity-60'
      : variant === 'dark'
        ? 'min-h-[44px] w-full rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-60'
        : 'min-h-[44px] w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 shadow-sm hover:bg-brand-50 disabled:opacity-60'

  return (
    <div className={`space-y-2 ${className}`}>
      {toast ? (
        <div
          role="status"
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            toast.type === 'ok' ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'
          }`}
        >
          {toast.text}
        </div>
      ) : null}
      {readiness.blockReason && driversLoaded ? (
        <p
          className={`rounded-lg px-2 py-1.5 text-xs leading-snug ${
            variant === 'dark' ? 'bg-amber-500/20 text-amber-100' : 'bg-amber-50 text-amber-900'
          }`}
        >
          {readiness.blockReason}
        </p>
      ) : null}
      {assignedDriverName ? (
        <p
          className={`flex items-center gap-2 text-xs font-semibold ${
            variant === 'dark' ? 'text-emerald-200' : 'text-emerald-800'
          }`}
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white">
            ✓
          </span>
          Driver: {assignedDriverName}
        </p>
      ) : null}
      <button type="button" onClick={handleOpen} disabled={assigning} className={btnClass}>
        {assigning ? 'Assigning…' : 'Assign internal driver'}
      </button>

      <JourneyAssignDriverModal
        open={modalOpen}
        onClose={() => !assigning && setModalOpen(false)}
        journey={journey || {}}
        journeyId={journeyId}
        quotes={quotes}
        stops={stops}
        assigning={assigning}
        onConfirm={handleConfirm}
      />
    </div>
  )
}
