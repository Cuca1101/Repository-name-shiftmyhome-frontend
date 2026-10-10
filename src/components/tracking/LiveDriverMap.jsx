import { useEffect, useRef, useState } from 'react'
import TrackingDriverMap from './TrackingDriverMap'
import { resolveJobRoadRoute } from '../../lib/trackingDriverEta'

const MAP_CLASS = 'h-[min(58dvh,22rem)] w-full max-w-full sm:h-[min(50dvh,26rem)] lg:h-[28rem]'

/**
 * Same live map as Track my driver: header controls, road route, stop pins, and van.
 * Pass jobRoute when the parent already loads the route (the tracking page uses it for ETA).
 */
export default function LiveDriverMap({
  latitude,
  longitude,
  heading = null,
  live = false,
  driverName = '',
  quoteRef = '',
  pickupAddress = '',
  deliveryAddress = '',
  destinationKind = null,
  jobRoute: jobRouteProp = undefined,
  onRouteRetry = null,
}) {
  const [controlsHost, setControlsHost] = useState(null)
  const [ownRoute, setOwnRoute] = useState(null)
  const [ownRetry, setOwnRetry] = useState(0)
  const ownKeyRef = useRef('')
  const managed = jobRouteProp === undefined
  const jobRoute = managed ? ownRoute : jobRouteProp
  const mapToken = String(import.meta.env.VITE_MAPBOX_TOKEN || '').trim()
  const pickup = String(pickupAddress || '').trim()
  const delivery = String(deliveryAddress || '').trim()

  useEffect(() => {
    if (!managed || !mapToken || !pickup || !delivery) return undefined
    const key = `${pickup}|${delivery}|${ownRetry}`
    if (ownKeyRef.current === key) return undefined
    ownKeyRef.current = key
    let cancelled = false
    resolveJobRoadRoute({ token: mapToken, pickupAddress: pickup, deliveryAddress: delivery })
      .then((result) => {
        if (!cancelled) setOwnRoute(result)
      })
      .catch(() => {
        if (!cancelled) {
          setOwnRoute({
            status: 'error',
            message: 'Route could not be loaded. Try again.',
            collection: null,
            delivery: null,
            coordinates: null,
          })
        }
      })
    return () => {
      cancelled = true
      if (ownKeyRef.current === key) ownKeyRef.current = ''
    }
  }, [managed, mapToken, pickup, delivery, ownRetry])

  function retryRoute() {
    if (onRouteRetry) {
      onRouteRetry()
      return
    }
    ownKeyRef.current = ''
    setOwnRetry((n) => n + 1)
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="text-base font-bold text-slate-900 sm:text-lg">Live location</h2>
        <div ref={setControlsHost} className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2" />
      </div>
      <div className="mt-3.5 overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
        <TrackingDriverMap
          latitude={latitude}
          longitude={longitude}
          heading={Number.isFinite(Number(heading)) ? Number(heading) : null}
          live={live}
          driverName={driverName}
          quoteRef={quoteRef}
          routeControls
          controlsHost={controlsHost}
          collection={jobRoute?.collection || null}
          delivery={jobRoute?.delivery || null}
          jobRouteCoordinates={jobRoute?.coordinates || null}
          destinationKind={destinationKind}
          className={MAP_CLASS}
        />
        {jobRoute?.status === 'error' ? (
          <p className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {jobRoute.message || 'Route could not be loaded. Try again.'}{' '}
            <button type="button" className="font-semibold underline" onClick={retryRoute}>
              Try again
            </button>
          </p>
        ) : null}
      </div>
    </>
  )
}
