import { useEffect, useState } from 'react'
import QuoteRouteMap from '../quote-wizard/QuoteRouteMap'
import { resolveQuoteRouteCoordinates } from '../../lib/quoteRouteCoordinates'

const DISPATCH_MAP_PLACEHOLDER =
  'flex h-[220px] min-h-[220px] items-center justify-center text-xs text-slate-500 sm:h-[260px] sm:min-h-[260px] md:h-[280px] md:min-h-[280px] lg:h-[300px] lg:min-h-[300px] xl:h-[320px] xl:min-h-[320px]'

/**
 * Route map for Job Accepted / Available Job dispatch screen.
 * @param {{ q: Record<string, unknown>, job?: Record<string, unknown> | null }} props
 */
export default function JobDispatchRouteMap({ q, job = null }) {
  const token = (import.meta.env.VITE_MAPBOX_TOKEN || '').trim()
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

  const ready =
    coords.pickupLng != null &&
    coords.pickupLat != null &&
    coords.deliveryLng != null &&
    coords.deliveryLat != null

  return (
    <div className="relative w-full bg-slate-100">
      {coords.loading ? (
        <div className={DISPATCH_MAP_PLACEHOLDER}>Loading route map…</div>
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
