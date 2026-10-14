import { useEffect, useState } from 'react'
import QuoteRouteMap from '../quote-wizard/QuoteRouteMap'
import CustomerLeadRouteMap from '../admin/CustomerLeadRouteMap'
import { resolveQuoteRouteCoordinates } from '../../lib/quoteRouteCoordinates'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { isDriverLocationStale } from '../../lib/data/driverLivePositionsRepository'
import { formatDateTimeUK } from '../../lib/formatDateDisplay'

const DISPATCH_MAP_PLACEHOLDER =
  'flex h-[220px] min-h-[220px] items-center justify-center text-xs text-slate-500 sm:h-[260px] sm:min-h-[260px] md:h-[280px] md:min-h-[280px] lg:h-[300px] lg:min-h-[300px] xl:h-[320px] xl:min-h-[320px]'
const TRACKING_MAP_FRAME =
  'relative block h-[220px] min-h-[220px] w-full min-w-0 overflow-hidden sm:h-[260px] sm:min-h-[260px] md:h-[280px] md:min-h-[280px] lg:h-[300px] lg:min-h-[300px] xl:h-[320px] xl:min-h-[320px]'

/**
 * Route map for Job Accepted / Available Job dispatch screen.
 * @param {{ q: Record<string, unknown>, job?: Record<string, unknown> | null, liveTracking?: boolean }} props
 */
export default function JobDispatchRouteMap({ q, job = null, liveTracking = false }) {
  const token = (import.meta.env.VITE_MAPBOX_TOKEN || '').trim()
  const quoteDriverId = String(q?.assigned_driver_id || job?.assigned_driver_id || '').trim()
  const driverName = String(q?.assigned_driver_name || job?.assigned_driver_name || '').trim()
  const [assignmentDriverId, setAssignmentDriverId] = useState('')
  const driverId = quoteDriverId || assignmentDriverId
  const [driverFix, setDriverFix] = useState(null)
  const [coords, setCoords] = useState({
    pickupLng: null,
    pickupLat: null,
    deliveryLng: null,
    deliveryLat: null,
    loading: true,
    error: '',
    pickupAddress: '',
    deliveryAddress: '',
  })

  useEffect(() => {
    let cancelled = false
    setCoords((c) => ({ ...c, loading: true, error: '' }))

    void (async () => {
      try {
        const result = await resolveQuoteRouteCoordinates(q, job, token)
        if (cancelled) return
        setCoords({
          pickupLng: result.pickupLng,
          pickupLat: result.pickupLat,
          deliveryLng: result.deliveryLng,
          deliveryLat: result.deliveryLat,
          loading: false,
          error: result.error || '',
          pickupAddress: result.pickupAddress,
          deliveryAddress: result.deliveryAddress,
        })
      } catch {
        if (!cancelled) {
          setCoords((c) => ({
            ...c,
            loading: false,
            error: 'Route map unavailable. Check your connection and Mapbox token.',
          }))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [q, job, token])

  useEffect(() => {
    if (!liveTracking || quoteDriverId || !q?.id || !isSupabaseConfigured || !supabase) {
      setAssignmentDriverId('')
      return undefined
    }
    let cancelled = false
    void supabase
      .from('job_assignments')
      .select('driver_id, status')
      .eq('quote_id', String(q.id))
      .order('updated_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (cancelled) return
        const row = (data || []).find((item) => {
          const status = String(item?.status || '').trim().toLowerCase()
          return status && !['cancelled', 'inactive', 'completed'].includes(status)
        })
        setAssignmentDriverId(row?.driver_id ? String(row.driver_id) : '')
      })
    return () => {
      cancelled = true
    }
  }, [liveTracking, quoteDriverId, q?.id])

  useEffect(() => {
    if (!liveTracking || !driverId || !isSupabaseConfigured || !supabase) {
      setDriverFix(null)
      return undefined
    }
    let cancelled = false
    const apply = (row) => {
      if (cancelled || !row) return
      const lat = Number(row.latitude ?? row.lat)
      const lng = Number(row.longitude ?? row.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      const updatedAt = row.updated_at != null ? String(row.updated_at) : ''
      setDriverFix({
        lat,
        lng,
        updatedAt,
        live: !isDriverLocationStale(updatedAt),
      })
    }
    const pull = () => {
      void supabase
        .from('driver_locations')
        .select('latitude, longitude, updated_at, status')
        .eq('driver_id', driverId)
        .maybeSingle()
        .then(({ data }) => apply(data))
    }
    pull()
    const poll = window.setInterval(pull, 15000)
    const channel = supabase
      .channel(`job-accepted-track-${driverId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${driverId}` },
        (payload) => apply(payload.new),
      )
      .subscribe()
    return () => {
      cancelled = true
      window.clearInterval(poll)
      void supabase.removeChannel(channel)
    }
  }, [liveTracking, driverId])

  const ready =
    coords.pickupLng != null &&
    coords.pickupLat != null &&
    coords.deliveryLng != null &&
    coords.deliveryLat != null

  return (
    <div className="relative w-full bg-slate-100">
      {coords.loading ? (
        <div className={DISPATCH_MAP_PLACEHOLDER}>Loading route map…</div>
      ) : ready && liveTracking ? (
        <>
          <CustomerLeadRouteMap
            pickupAddress={coords.pickupAddress}
            deliveryAddress={coords.deliveryAddress}
            pickupLng={coords.pickupLng}
            pickupLat={coords.pickupLat}
            deliveryLng={coords.deliveryLng}
            deliveryLat={coords.deliveryLat}
            frameClass={TRACKING_MAP_FRAME}
            driverLng={driverFix?.lng ?? (driverId ? coords.pickupLng : null)}
            driverLat={driverFix?.lat ?? (driverId ? coords.pickupLat : null)}
            driverLive={Boolean(driverFix?.live)}
            driverWaiting={Boolean(driverId) && !driverFix}
            driverName={driverName}
          />
          <p className="border-t border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-600">
            {!driverId
              ? 'Assign a driver to track this job.'
              : !driverFix
                ? `On this job${driverName ? ` · ${driverName}` : ''} · waiting for live GPS`
                : driverFix.live
                  ? `Tracking${driverName ? ` ${driverName}` : ''} · live`
                  : `Last location${driverName ? ` · ${driverName}` : ''}${driverFix.updatedAt ? ` · ${formatDateTimeUK(driverFix.updatedAt)}` : ''}`}
          </p>
        </>
      ) : ready ? (
        <QuoteRouteMap
          variant="dispatch"
          pickupLng={coords.pickupLng}
          pickupLat={coords.pickupLat}
          deliveryLng={coords.deliveryLng}
          deliveryLat={coords.deliveryLat}
        />
      ) : (
        <div className={`${DISPATCH_MAP_PLACEHOLDER} flex-col gap-2 px-4 text-center`}>
          <p className="max-w-md font-medium text-slate-700">
            {coords.error || 'Add valid pickup and delivery addresses to show the route.'}
          </p>
          {!token ? (
            <p className="text-[11px] text-amber-800">
              Create <code className="rounded bg-amber-100 px-1">.env</code> with{' '}
              <code className="rounded bg-amber-100 px-1">VITE_MAPBOX_TOKEN=pk.…</code> then restart the dev
              server.
            </p>
          ) : null}
          {coords.pickupAddress && coords.pickupAddress !== '—' ? (
            <p className="text-[10px] text-slate-500">
              <span className="font-semibold">From:</span> {coords.pickupAddress}
            </p>
          ) : null}
          {coords.deliveryAddress && coords.deliveryAddress !== '—' ? (
            <p className="text-[10px] text-slate-500">
              <span className="font-semibold">To:</span> {coords.deliveryAddress}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
