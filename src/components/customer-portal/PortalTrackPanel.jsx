import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import LiveDriverMap from '../tracking/LiveDriverMap'
import { groupJobPhotos, trackingClient } from '../../lib/jobCustomerTracking'
import {
  isTrackingGpsFresh,
  resolveTrackingDriverEta,
  resolveTrackingGpsState,
  trackingEtaAddress,
} from '../../lib/trackingDriverEta'
import { resolveCustomerTrackingStage } from '../../lib/trackingJobStage'
import { portalTrackingPresentation } from '../../lib/customerPortalModel'

/**
 * Uses the existing tracking link. A booking page does not grant edit rights.
 */
export default function PortalTrackPanel({ token }) {
  const [data, setData] = useState(null)
  const [photos, setPhotos] = useState([])
  const [eta, setEta] = useState(null)
  const [error, setError] = useState('')
  const etaCacheRef = useRef({})

  useEffect(() => {
    const client = trackingClient()
    const id = String(token || '').trim()
    if (!client || !id) return undefined
    let cancelled = false

    async function load() {
      const { data: portal, error: rpcError } = await client.rpc('public_get_job_tracking', { p_token: id })
      if (cancelled) return
      if (rpcError || !portal?.ok) {
        setError('Tracking is not available for this booking yet.')
        setData(null)
        return
      }
      setError('')
      setData(portal)
      const { data: mediaRes } = await client.functions.invoke('get-job-tracking-media', {
        body: { token: id },
      })
      if (!cancelled) setPhotos(Array.isArray(mediaRes?.photos) ? mediaRes.photos : [])
    }

    load()
    const timer = window.setInterval(load, 10000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [token])

  const stage = useMemo(() => resolveCustomerTrackingStage(data), [data])
  const photoGroups = useMemo(() => groupJobPhotos(photos), [photos])
  const gpsFresh = isTrackingGpsFresh({ trackingLive: data?.tracking_live, location: data?.location })
  const hasCoords = Number.isFinite(Number(data?.location?.latitude)) && Number.isFinite(Number(data?.location?.longitude))
  const presentation = portalTrackingPresentation({ stage: stage.stage, gpsFresh, hasCoords })

  useEffect(() => {
    if (!data || !presentation.showLivePosition || !stage.showLiveEta) {
      setEta(null)
      return undefined
    }
    let cancelled = false
    const address = trackingEtaAddress(stage.etaKind, data.pickup_address, data.delivery_address)
    const gpsState = resolveTrackingGpsState({ trackingLive: data?.tracking_live, location: data?.location })
    const mapToken = String(import.meta.env.VITE_MAPBOX_TOKEN || '').trim()
    resolveTrackingDriverEta({
      token: mapToken,
      driver: { lng: Number(data.location.longitude), lat: Number(data.location.latitude) },
      destinationAddress: address,
      kind: stage.etaKind,
      placeLabel: stage.placeLabel,
      gpsFresh: gpsState === 'fresh',
      gpsState,
      gpsUpdatedAt: data?.location?.updated_at || null,
      cache: etaCacheRef.current,
    }).then((result) => {
      if (cancelled) return
      etaCacheRef.current = result.cache || etaCacheRef.current
      setEta(result)
    })
    return () => {
      cancelled = true
    }
  }, [data, presentation.showLivePosition, stage.etaKind, stage.placeLabel, stage.showLiveEta, token])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-bold">Driver tracking</h2>
          <p className="mt-1 break-words text-sm text-slate-600">
            {presentation.awaitingStart
              ? presentation.message
              : stage.stageMessage || stage.arrivedMessage || presentation.message || stage.badge}
          </p>
        </div>
        {token ? (
          <Link
            to={`/track/${token}`}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
          >
            Track my driver
          </Link>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-sm text-slate-500">{error}</p> : null}
      {presentation.showLivePosition ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-medium text-slate-800">{stage.badge}</p>
          {eta?.phrase && (eta.status === 'ready' || eta.status === 'stale') ? (
            <p className="text-sm text-slate-600">
              {eta.phrase}
              {eta.status === 'stale'
                ? ' · GPS delayed'
                : ''}
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              {eta?.message || 'Calculating arrival time…'}
            </p>
          )}
          <LiveDriverMap
            latitude={Number(data.location.latitude)}
            longitude={Number(data.location.longitude)}
            heading={Number(data.location.heading)}
            live={gpsFresh}
            driverName={data.driver?.full_name || ''}
            quoteRef={data.quote_ref || ''}
            pickupAddress={data.pickup_address || ''}
            deliveryAddress={data.delivery_address || ''}
            destinationKind={stage.etaKind || (stage.stage === 'en_route_collection' ? 'collection' : null)}
          />
        </div>
      ) : null}
      {!presentation.awaitingStart && !presentation.showLivePosition && data ? (
        <p className="mt-3 text-sm text-slate-500">{presentation.message}</p>
      ) : null}
      <JobPhotos groups={photoGroups} />
    </section>
  )
}

const PHOTO_SECTIONS = [
  ['pickup', 'Pickup photos'],
  ['loaded', 'Loaded vehicle photos'],
  ['delivery', 'Delivery photos'],
  ['proof', 'Proof photos'],
  ['damage', 'Damage or issue photos'],
  ['general', 'Photos'],
  ['waiver', 'Waiver and signature'],
]

function JobPhotos({ groups }) {
  const visible = PHOTO_SECTIONS.filter(([key]) => groups[key]?.length)
  if (!visible.length) return null
  return (
    <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
      {visible.map(([key, title]) => (
        <div key={key}>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {groups[key].map((photo) => {
              const src = photo.signed_url || photo.signedUrl || ''
              const id = photo.id || photo.storage_path || src
              return src ? (
                <a key={id} href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-100">
                  <img src={src} alt="" className="aspect-square w-full object-cover" />
                </a>
              ) : (
                <div key={id} className="flex aspect-square items-center justify-center rounded-lg bg-slate-50 text-[11px] text-slate-400">No preview</div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
