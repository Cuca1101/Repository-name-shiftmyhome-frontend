import { useEffect, useState } from 'react'
import QuoteRouteMap from '../quote-wizard/QuoteRouteMap'
import { geocodeAddressCached } from '../../lib/operationsMapGeocodeCache'
import { resolveQuoteCollectionAddress, resolveQuoteDeliveryAddress } from '../../lib/quoteAddressResolve'

const DISPATCH_MAP_PLACEHOLDER =
  'flex h-[220px] min-h-[220px] items-center justify-center text-xs text-slate-500 sm:h-[260px] sm:min-h-[260px] md:h-[280px] md:min-h-[280px] lg:h-[300px] lg:min-h-[300px] xl:h-[320px] xl:min-h-[320px]'

/**
 * @param {{ q: Record<string, unknown> }} props
 */
export default function JobDispatchRouteMap({ q }) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  const [coords, setCoords] = useState({
    pickupLng: null,
    pickupLat: null,
    deliveryLng: null,
    deliveryLat: null,
    loading: true,
    error: '',
  })

  useEffect(() => {
    let cancelled = false
    const pickupAddr = resolveQuoteCollectionAddress(q)
    const deliveryAddr = resolveQuoteDeliveryAddress(q)

    if (!token) {
      setCoords((c) => ({ ...c, loading: false, error: 'Map token not configured' }))
      return () => {
        cancelled = true
      }
    }

    setCoords((c) => ({ ...c, loading: true, error: '' }))
    void (async () => {
      try {
        const [pickup, delivery] = await Promise.all([
          geocodeAddressCached(pickupAddr, token),
          geocodeAddressCached(deliveryAddr, token),
        ])
        if (cancelled) return
        setCoords({
          pickupLng: pickup?.lng ?? null,
          pickupLat: pickup?.lat ?? null,
          deliveryLng: delivery?.lng ?? null,
          deliveryLat: delivery?.lat ?? null,
          loading: false,
          error: pickup && delivery ? '' : 'Could not geocode one or both addresses',
        })
      } catch {
        if (!cancelled) {
          setCoords((c) => ({ ...c, loading: false, error: 'Route map unavailable' }))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [q, token])

  const ready =
    coords.pickupLng != null &&
    coords.pickupLat != null &&
    coords.deliveryLng != null &&
    coords.deliveryLat != null

  return (
    <div className="relative w-full bg-slate-100">
      {coords.loading ? (
        <div className={DISPATCH_MAP_PLACEHOLDER}>Loading route…</div>
      ) : ready ? (
        <QuoteRouteMap
          variant="dispatch"
          pickupLng={coords.pickupLng}
          pickupLat={coords.pickupLat}
          deliveryLng={coords.deliveryLng}
          deliveryLat={coords.deliveryLat}
        />
      ) : (
        <div className={`${DISPATCH_MAP_PLACEHOLDER} flex-col gap-1 px-4 text-center`}>
          <p>{coords.error || 'Add valid pickup and delivery addresses to show the route.'}</p>
        </div>
      )}
    </div>
  )
}
