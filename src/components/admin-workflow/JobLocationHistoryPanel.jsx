import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDateTimeUK } from '../../lib/formatDateDisplay'
import { fetchDriverLocationHistoryForQuote } from '../../lib/data/driverLocationHistoryRepository'
import {
  analyzeRouteDeviation,
  detectLocationStops,
} from '../../lib/jobLocationAnalytics'
import { resolveQuoteCollectionAddress, resolveQuoteDeliveryAddress } from '../../lib/quoteAddressResolve'
import { geocodeAddressCached } from '../../lib/operationsMapGeocodeCache'

/**
 * Per-job GPS trail: stops, dwell time, deviation from planned route.
 */
export default function JobLocationHistoryPanel({ quote, linkedJob = null, mapboxToken = '' }) {
  const quoteId = quote?.id != null ? String(quote.id) : ''
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(false)
  const [coords, setCoords] = useState({ pickup: null, delivery: null })

  const load = useCallback(async () => {
    if (!quoteId) return
    setLoading(true)
    try {
      const rows = await fetchDriverLocationHistoryForQuote(quoteId)
      setPoints(rows)
    } finally {
      setLoading(false)
    }
  }, [quoteId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!mapboxToken || !quote) return
    let cancelled = false
    void (async () => {
      const puAddr = resolveQuoteCollectionAddress(quote, linkedJob)
      const dlAddr = resolveQuoteDeliveryAddress(quote, linkedJob)
      const pickup =
        puAddr && puAddr !== '—' ? await geocodeAddressCached(puAddr, mapboxToken) : null
      const delivery =
        dlAddr && dlAddr !== '—' ? await geocodeAddressCached(dlAddr, mapboxToken) : null
      if (!cancelled) setCoords({ pickup, delivery })
    })()
    return () => {
      cancelled = true
    }
  }, [quote, linkedJob, mapboxToken])

  const stops = useMemo(() => detectLocationStops(points), [points])
  const deviation = useMemo(
    () => analyzeRouteDeviation(points, coords.pickup, coords.delivery),
    [points, coords.pickup, coords.delivery],
  )

  const hasTrail = points.length >= 2
  const offRoute = deviation.offRoutePct >= 15 || deviation.maxDeviationM >= 500

  return (
    <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Driver GPS history
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            Trail while on this job — stops, dwell time, route deviation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {loading && points.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Loading GPS trail…</p>
      ) : null}

      {!loading && points.length === 0 ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No GPS points recorded yet. Driver must be on duty with location enabled and job started
          in the mobile app. Points appear on the Operations Map → Drivers tab.
        </p>
      ) : null}

      {hasTrail ? (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-2">
            <dt className="text-slate-500">GPS points</dt>
            <dd className="text-lg font-bold text-slate-900">{points.length}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <dt className="text-slate-500">Stops (≥3 min)</dt>
            <dd className="text-lg font-bold text-slate-900">{stops.length}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <dt className="text-slate-500">Max off-route</dt>
            <dd className="text-lg font-bold text-slate-900">
              {deviation.maxDeviationM > 0 ? `${deviation.maxDeviationM} m` : '—'}
            </dd>
          </div>
          <div
            className={`rounded-lg p-2 ${offRoute ? 'bg-amber-50' : 'bg-emerald-50'}`}
          >
            <dt className={offRoute ? 'text-amber-800' : 'text-emerald-800'}>Deviation</dt>
            <dd
              className={`text-lg font-bold ${offRoute ? 'text-amber-900' : 'text-emerald-900'}`}
            >
              {offRoute ? `${deviation.offRoutePct}% off line` : 'On route'}
            </dd>
          </div>
        </dl>
      ) : null}

      {stops.length > 0 ? (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Stops</p>
          <ul className="mt-1.5 max-h-40 space-y-1.5 overflow-y-auto">
            {stops.map((s, i) => (
              <li
                key={`${s.startedAt}-${i}`}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs"
              >
                <span className="font-semibold text-slate-800">Stop {i + 1}</span>
                <span className="tabular-nums text-slate-600">
                  {formatDateTimeUK(s.startedAt)} → {formatDateTimeUK(s.endedAt)}
                </span>
                <span className="w-full font-medium text-brand-700">
                  Parked ~{s.dwellMinutes} min ({s.pointCount} readings)
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasTrail ? (
        <p className="mt-2 text-[10px] text-slate-500">
          First point {formatDateTimeUK(points[0].recorded_at)} · Last{' '}
          {formatDateTimeUK(points[points.length - 1].recorded_at)}
        </p>
      ) : null}
    </div>
  )
}
