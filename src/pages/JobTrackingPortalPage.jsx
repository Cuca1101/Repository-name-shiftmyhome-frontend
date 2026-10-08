import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import SeoHead from '../components/seo/SeoHead'
import TrackingDriverMap from '../components/tracking/TrackingDriverMap'
import { formatTimeUK, resolveTrackingMotion } from '../lib/driverMotionStatus'
import { formatDateTimeUK, formatDateUK } from '../lib/formatDateDisplay'
import {
  customerJobStatusLabel,
  photoSectionForType,
  trackingClient,
} from '../lib/jobCustomerTracking'
import { resolveJobPhotoDisplayMeta } from '../lib/jobPhotoDisplayMeta'
import { GOOGLE_LEAVE_REVIEW_URL } from '../lib/reviews/externalReviews'
import {
  isTrackingGpsFresh,
  resolveTrackingDriverEta,
} from '../lib/trackingDriverEta'
import { resolveGpsStatusHeadline, resolveTrackingJobStage } from '../lib/trackingJobStage'

const POLL_MS = 10000
const MEDIA_REFRESH_MS = 10 * 60 * 1000

function trackingMediaKey(portal) {
  const photos = Array.isArray(portal?.photos) ? portal.photos : []
  const waivers = Array.isArray(portal?.waivers) ? portal.waivers : []
  return [...photos, ...waivers].map((p) => String(p.id || p.storage_path || '')).join('|')
}

function Section({ title, children, bodyClassName = 'mt-3 space-y-2 text-sm text-slate-700' }) {
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5">
      <h2 className="text-base font-bold text-slate-900 sm:text-lg">{title}</h2>
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

function Row({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-2 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[65%] text-right font-medium text-slate-900">{value}</span>
    </div>
  )
}

function IconTruck({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 7h11v10H3V7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 10h4.2L21 13.2V17h-7v-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="7" cy="18.5" r="1.5" fill="currentColor" />
      <circle cx="17.5" cy="18.5" r="1.5" fill="currentColor" />
    </svg>
  )
}

function IconCar({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 14h16l-1.2-4.2A2 2 0 0 0 16.9 8H7.1a2 2 0 0 0-1.9 1.8L4 14Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M4 14v3h2.2M18 17H20v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="7.5" cy="17.5" r="1.5" fill="currentColor" />
      <circle cx="16.5" cy="17.5" r="1.5" fill="currentColor" />
    </svg>
  )
}

function IconClock({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v4.5L15 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function IconPin({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.2" fill="currentColor" />
    </svg>
  )
}

function IconFlag({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 21V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 5h13v8H5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 5v8M11 5v8M14 5v8M5 9h13" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
    </svg>
  )
}

function IconCompass({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="m15.5 8.5-2.2 5.8-5.8 2.2 2.2-5.8 5.8-2.2Z" fill="currentColor" />
    </svg>
  )
}

export default function JobTrackingPortalPage() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const viewEvidence = searchParams.get('view') === 'evidence'
  const [data, setData] = useState(null)
  const [media, setMedia] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [etaView, setEtaView] = useState(null)
  const mediaFetchedAtRef = useRef(0)
  const mediaKeyRef = useRef('')
  const etaCacheRef = useRef({})
  const etaRunRef = useRef(0)

  const load = useCallback(async (opts = {}) => {
    const { force = false } = opts
    const t = String(token || '').trim()
    const client = trackingClient()
    if (!t || !client) {
      setError(
        !client
          ? 'Tracking is temporarily unavailable. Please try again in a moment.'
          : 'Tracking link unavailable.',
      )
      setLoading(false)
      return
    }
    // UUID from email / SMS — reject garbage before RPC (avoids cryptic Postgres errors).
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)) {
      setError('Invalid tracking link.')
      setData(null)
      setLoading(false)
      return
    }
    // Background tabs: skip quiet polls only — never leave the first open stuck on “Loading…”.
    if (
      !force
      && typeof document !== 'undefined'
      && document.visibilityState !== 'visible'
    ) {
      return
    }
    try {
      const { data: portal, error: rpcErr } = await client.rpc('public_get_job_tracking', { p_token: t })
      if (rpcErr) throw rpcErr
      if (!portal?.ok) {
        setError(
          portal?.error === 'revoked'
            ? 'This tracking link has been revoked (booking cancelled).'
            : portal?.error === 'expired'
              ? 'This tracking link has expired.'
              : portal?.error === 'not_paid'
                ? 'Tracking is available after payment is confirmed.'
                : 'Invalid tracking link.',
        )
        setData(null)
        return
      }
      setData(portal)
      setError('')

      const nextKey = trackingMediaKey(portal)
      const mediaDue =
        nextKey !== mediaKeyRef.current || Date.now() - mediaFetchedAtRef.current >= MEDIA_REFRESH_MS
      if (!mediaDue) return

      const { data: mediaRes } = await client.functions.invoke('get-job-tracking-media', {
        body: { token: t },
      })
      if (mediaRes?.photos) {
        mediaKeyRef.current = nextKey
        mediaFetchedAtRef.current = Date.now()
        setMedia(mediaRes.photos)
      }
    } catch (e) {
      const msg = String(e?.message || e || '')
      setError(
        /invalid input syntax for type uuid/i.test(msg)
          ? 'Invalid tracking link.'
          : msg || 'Could not load tracking.',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load({ force: true })
    const id = window.setInterval(() => void load(), POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load({ force: true })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const mapLat = Number(data?.location?.latitude)
  const mapLng = Number(data?.location?.longitude)
  const mapHeading = Number(data?.location?.heading)
  const showMap = Boolean(
    data?.location?.available && Number.isFinite(mapLat) && Number.isFinite(mapLng),
  )
  const mapToken = String(import.meta.env.VITE_MAPBOX_TOKEN || '').trim()
  const motion = resolveTrackingMotion(data?.location)
  const gpsFresh = isTrackingGpsFresh({
    trackingLive: data?.tracking_live,
    location: data?.location,
  })
  // RPC may leave operational_status stale while quotes.status / completed_at is done.
  const completed = Boolean(
    data?.completed
    || data?.completed_at
    || /completed/i.test(String(data?.operational_status || ''))
    || /completed/i.test(String(data?.status_raw || '')),
  )
  const googleReviewHref = String(GOOGLE_LEAVE_REVIEW_URL || '').trim()
    || 'https://g.page/r/CWmwRUPz2dC7EAE/review'
  const jobStage = useMemo(
    () =>
      completed
        ? {
            stage: 'completed',
            badge: 'Completed',
            etaKind: null,
            placeLabel: null,
            showLiveEta: false,
            arrivedMessage: null,
            stageMessage: null,
          }
        : resolveTrackingJobStage(data?.operational_status, data?.status_raw),
    [completed, data?.operational_status, data?.status_raw],
  )
  const etaDestination = jobStage.showLiveEta && jobStage.etaKind
    ? { kind: jobStage.etaKind, placeLabel: jobStage.placeLabel }
    : null

  useEffect(() => {
    if (!data || completed || !etaDestination || !mapToken) {
      setEtaView(null)
      if (!etaDestination) etaCacheRef.current = {}
      return undefined
    }

    const destAddress =
      etaDestination.kind === 'collection'
        ? String(data.pickup_address || '').trim()
        : String(data.delivery_address || '').trim()
    if (!destAddress) {
      setEtaView(null)
      return undefined
    }

    const runId = ++etaRunRef.current
    const freshForEta = isTrackingGpsFresh({
      trackingLive: data?.tracking_live,
      location: data?.location,
    })

    ;(async () => {
      const result = await resolveTrackingDriverEta({
        token: mapToken,
        driver: { lng: mapLng, lat: mapLat },
        destinationAddress: destAddress,
        kind: etaDestination.kind,
        placeLabel: etaDestination.placeLabel,
        gpsFresh: freshForEta,
        cache: etaCacheRef.current,
      })
      if (runId !== etaRunRef.current) return
      etaCacheRef.current = result.cache || etaCacheRef.current
      if (!result.active) {
        setEtaView(null)
        return
      }
      setEtaView({
        kind: result.kind,
        placeLabel: result.placeLabel,
        status: result.status,
        message: result.message,
        minutesLabel: result.minutesLabel,
        clock: result.clock,
        milesLabel: result.milesLabel,
        routeCoordinates: result.routeCoordinates || null,
        destination: result.destination || null,
      })
    })().catch(() => {
      if (runId !== etaRunRef.current) return
      setEtaView({
        kind: etaDestination.kind,
        placeLabel: etaDestination.placeLabel,
        status: 'error',
        message: 'ETA temporarily unavailable',
        minutesLabel: null,
        clock: null,
        milesLabel: null,
        routeCoordinates: null,
        destination: null,
      })
    })

    return undefined
  }, [
    completed,
    data,
    etaDestination,
    gpsFresh,
    mapLat,
    mapLng,
    mapToken,
    motion.state,
    data?.location?.updated_at,
    data?.tracking_live,
    data?.pickup_address,
    data?.delivery_address,
  ])

  const inventory = useMemo(() => {
    if (Array.isArray(data?.inventory) && data.inventory.length) return data.inventory
    return []
  }, [data])

  const photoGroups = useMemo(() => {
    const groups = { pickup: [], loaded: [], delivery: [], damage: [], waiver: [], general: [] }
    for (const p of media) {
      const key = photoSectionForType(p.photo_type, p.stop_type)
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    }
    return groups
  }, [media])

  const statusLabel = customerJobStatusLabel(data?.operational_status || data?.status_raw)

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-slate-600">Loading your booking…</div>
    )
  }

  if (error || !data) {
    return (
      <>
        <SeoHead title="Tracking | ShiftMyHome" path={`/track/${token || ''}`} robots="noindex, nofollow" />
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Unable to open tracking</h1>
          <p className="mt-3 text-sm text-slate-600">{error}</p>
          <Link to="/" className="mt-8 inline-flex text-sm font-semibold text-brand-700 hover:underline">
            Back to home
          </Link>
        </div>
      </>
    )
  }

  const badgeText = jobStage.badge || statusLabel
  const destKind =
    etaView?.kind
    || jobStage.etaKind
    || (jobStage.placeLabel === 'delivery' ? 'delivery' : jobStage.placeLabel === 'collection' ? 'collection' : null)
  const destAddress =
    destKind === 'delivery'
      ? data.delivery_address
      : destKind === 'collection'
        ? data.pickup_address
        : jobStage.placeLabel === 'delivery'
          ? data.delivery_address
          : jobStage.placeLabel === 'collection'
            ? data.pickup_address
            : null
  const gpsUpdatedAt = motion.updated_at || data.location?.updated_at
  const etaReady = Boolean(
    gpsFresh
    && etaView?.status === 'ready'
    && etaView.minutesLabel
    && etaView.clock
    && etaView.milesLabel
    && etaView.milesLabel !== '—',
  )
  const gpsStatusHeadline = resolveGpsStatusHeadline(motion, gpsFresh)
  const gpsStatusLive = gpsFresh && (motion.state === 'moving' || motion.state === 'stationary')
  const addressTitle =
    destKind === 'delivery' || jobStage.placeLabel === 'delivery'
      ? 'Delivery address'
      : 'Collection address'

  return (
    <>
      <SeoHead
        title={`Track booking ${data.quote_ref || ''} | ShiftMyHome`}
        description="Live driver tracking and job evidence for your ShiftMyHome booking."
        path={`/track/${token}`}
        robots="noindex, nofollow"
      />
      <div className="min-h-screen bg-[#eef3f8] pb-16">
        <header className="border-b border-slate-200/70 bg-white">
          <div className="mx-auto flex max-w-[880px] flex-wrap items-start justify-between gap-3 px-4 py-5 sm:px-6 sm:py-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-600">
                ShiftMyHome
              </p>
              <h1 className="mt-1 text-[1.75rem] font-bold tracking-tight text-slate-900 sm:text-[2rem]">
                {viewEvidence || completed ? 'Job evidence' : 'Track my driver'}
              </h1>
              <p className="mt-1 font-mono text-sm font-medium text-slate-500 sm:text-[15px]">
                {data.quote_ref}
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3.5 py-2 text-xs font-semibold text-sky-800 shadow-sm sm:text-[13px]">
              <IconTruck className="h-4 w-4 shrink-0 text-sky-700" />
              <span>{badgeText}</span>
            </div>
          </div>
        </header>

        <main className="mx-auto mt-4 flex max-w-[880px] flex-col gap-4 px-4 sm:mt-5 sm:gap-5 sm:px-6">
          {!completed ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)] sm:p-5">
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">Live location</h2>

              {showMap ? (
                <div className="mt-3.5 space-y-3 sm:space-y-3.5">
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
                    <TrackingDriverMap
                      latitude={mapLat}
                      longitude={mapLng}
                      heading={Number.isFinite(mapHeading) ? mapHeading : null}
                      live={gpsFresh}
                      driverName={data.driver?.full_name || ''}
                      quoteRef={data.quote_ref || ''}
                      routeCoordinates={etaView?.routeCoordinates || null}
                      destination={etaView?.destination || null}
                      destinationKind={destKind}
                      className="h-[19rem] w-full sm:h-[25rem] lg:h-[28rem]"
                    />
                  </div>

                  {/* Green ETA / arrived / collected panel */}
                  {jobStage.arrivedMessage ? (
                    <div className="rounded-xl border border-emerald-200 bg-[#ecfdf5] px-4 py-3.5 sm:px-5">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <IconCar />
                        </div>
                        <div>
                          <p className="text-[15px] font-bold text-slate-900 sm:text-base">
                            {jobStage.arrivedMessage}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-600">
                            Live ETA pauses while the driver is at this stop.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : etaDestination ? (
                    <div
                      className={`rounded-xl border px-4 py-3.5 sm:px-5 ${
                        etaReady
                          ? 'border-emerald-200 bg-[#ecfdf5]'
                          : 'border-amber-200 bg-amber-50'
                      }`}
                    >
                      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div
                            className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                              etaReady
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            <IconCar />
                          </div>
                          <div className="min-w-0">
                            {jobStage.stageMessage ? (
                              <p className="mb-1 text-[13px] font-semibold text-emerald-800">
                                {jobStage.stageMessage}
                              </p>
                            ) : null}
                            {etaReady ? (
                              <>
                                <p className="text-[15px] font-bold leading-snug text-slate-900 sm:text-base">
                                  Arriving at {etaView.placeLabel} in approximately{' '}
                                  {etaView.minutesLabel}
                                </p>
                                <p className="mt-0.5 text-sm text-slate-600">
                                  {etaView.milesLabel} miles away · ETA {etaView.clock}
                                  {' · '}
                                  Destination:{' '}
                                  {etaView.placeLabel === 'delivery' ? 'Delivery' : 'Collection'}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-[15px] font-bold leading-snug text-slate-900 sm:text-base">
                                  {etaView?.message
                                    || (gpsFresh
                                      ? 'Calculating arrival time…'
                                      : 'ETA paused — waiting for a fresh driver location')}
                                </p>
                                <p className="mt-0.5 text-sm text-slate-600">
                                  Destination:{' '}
                                  {etaDestination.placeLabel === 'delivery' ? 'Delivery' : 'Collection'}
                                  {etaView?.routeCoordinates?.length
                                    ? ' · Showing last known road route'
                                    : ''}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                        {etaReady ? (
                          <div className="grid grid-cols-3 gap-0 border-t border-emerald-200/80 pt-3 text-center sm:min-w-[260px] sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                            <div className="flex flex-col items-center gap-1 px-1">
                              <IconClock className="h-4 w-4 text-emerald-700" />
                              <p className="text-sm font-bold text-slate-900">{etaView.minutesLabel}</p>
                              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                                Estimated time
                              </p>
                            </div>
                            <div className="flex flex-col items-center gap-1 border-x border-emerald-200/70 px-1">
                              <IconPin className="h-4 w-4 text-emerald-700" />
                              <p className="text-sm font-bold text-slate-900">
                                {etaView.milesLabel} miles
                              </p>
                              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                                Distance
                              </p>
                            </div>
                            <div className="flex flex-col items-center gap-1 px-1">
                              <IconFlag className="h-4 w-4 text-emerald-700" />
                              <p className="text-sm font-bold text-slate-900">{etaView.clock}</p>
                              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                                Expected arrival
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {/* Blue GPS / movement status */}
                  <div
                    className={`rounded-xl border px-4 py-3.5 sm:px-5 ${
                      gpsStatusLive
                        ? 'border-sky-200 bg-[#eff6ff]'
                        : 'border-amber-200 bg-amber-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                          gpsStatusLive
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        <IconCompass />
                      </div>
                      <div>
                        <p
                          className={`text-[15px] font-bold sm:text-base ${
                            gpsStatusLive ? 'text-sky-900' : 'text-amber-900'
                          }`}
                        >
                          {gpsStatusHeadline}
                        </p>
                        <p className={`mt-0.5 text-sm ${gpsStatusLive ? 'text-slate-600' : 'text-amber-800'}`}>
                          Last GPS update: {gpsUpdatedAt ? formatTimeUK(gpsUpdatedAt) : '—'}
                          {motion.last_moved_at
                            ? ` · Last movement: ${formatTimeUK(motion.last_moved_at)}`
                            : ''}
                          {!gpsFresh && showMap ? ' · Showing last known position' : ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Destination address card */}
                  {destAddress ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 sm:px-5">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-red-600 shadow-sm ring-1 ring-red-100">
                          <IconPin className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[15px] font-bold text-slate-900 sm:text-base">
                            {addressTitle}
                          </p>
                          <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{destAddress}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3.5 rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-900">
                  {!mapToken
                    ? 'Map is temporarily unavailable.'
                    : data.location?.message ||
                      'Location temporarily unavailable. The map appears when your driver is sharing GPS.'}
                </p>
              )}
            </section>
          ) : (
            <Section title="Job completed">
              <p className="text-slate-700">
                Live tracking has stopped. Evidence, feedback and tip options remain available below.
              </p>
              <Row label="Completed" value={data.completed_at ? formatDateTimeUK(data.completed_at) : '—'} />
            </Section>
          )}

          <Section title="Driver">
            <Row label="Name" value={data.driver?.full_name} />
            <Row label="Telephone" value={data.driver?.phone} />
            <Row label="Vehicle type" value={data.driver?.vehicle_type} />
            <Row label="Registration" value={data.driver?.vehicle_registration} />
            {!data.driver ? <p className="text-slate-500">Driver details will appear once assigned.</p> : null}
          </Section>

          <Section title="Booking">
            <Row label="Reference" value={data.quote_ref} />
            <Row label="Move date" value={formatDateUK(data.move_date)} />
            <Row label="Arrival window" value={data.arrival_window} />
            <Row label="Pickup" value={data.pickup_address} />
            <Row label="Delivery" value={data.delivery_address} />
            <Row label="Status" value={statusLabel} />
          </Section>

          <Section title="Inventory">
            {inventory.length ? (
              <ul className="list-inside list-disc space-y-1">
                {inventory.map((line, i) => (
                  <li key={i}>
                    {line.quantity ?? line.qty ?? 1}× {line.name || line.item_name || line.label || 'Item'}
                  </li>
                ))}
              </ul>
            ) : data.inventory_text ? (
              <p className="whitespace-pre-wrap">{data.inventory_text}</p>
            ) : (
              <p className="text-slate-500">No inventory listed.</p>
            )}
          </Section>

          <Section title="Waiver & signature">
            {photoGroups.waiver.length ? (
              <div className="space-y-3">
                {photoGroups.waiver.map((p) => (
                  <div key={p.id} className="rounded-xl border border-slate-100 p-3">
                    <Row label="Type" value={p.photo_type === 'pod_signature' ? 'Proof of delivery' : 'Customer waiver'} />
                    <Row label="Signed" value={p.created_at ? formatDateTimeUK(p.created_at) : null} />
                    {p.signed_url ? (
                      <a href={p.signed_url} target="_blank" rel="noreferrer" className="mt-2 inline-block">
                        <img src={p.signed_url} alt="Signature" className="max-h-40 rounded-lg border border-slate-200" />
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500">No waiver signed yet.</p>
            )}
          </Section>

          {[
            ['pickup', 'Pickup photos'],
            ['loaded', 'Loaded vehicle photos'],
            ['delivery', 'Delivery photos'],
            ['damage', 'Damage or issue photos'],
          ].map(([key, title]) =>
            photoGroups[key]?.length ? (
              <Section key={key} title={title}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photoGroups[key].map((p) => {
                    const meta = resolveJobPhotoDisplayMeta(p.metadata, p)
                    return (
                    <figure key={p.id} className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                      {p.signed_url ? (
                        <a href={p.signed_url} target="_blank" rel="noreferrer">
                          <img src={p.signed_url} alt="" className="aspect-square w-full object-cover" />
                        </a>
                      ) : (
                        <div className="flex aspect-square items-center justify-center text-xs text-slate-400">No preview</div>
                      )}
                      <figcaption className="space-y-0.5 p-2 text-[11px] text-slate-600">
                        <div>{meta.capturedAtDisplay || (p.created_at ? formatDateTimeUK(p.created_at) : '')}</div>
                        <div className="capitalize">{meta.displayTitle || String(p.photo_type || '').replace(/_/g, ' ')}</div>
                        {meta.capturedAtAddress ? (
                          <div className="leading-snug text-slate-800" title={meta.capturedAtAddress}>
                            Taken at: {meta.capturedAtAddress}
                          </div>
                        ) : meta.addressText ? (
                          <div className="leading-snug text-slate-700" title={meta.addressText}>
                            {meta.addressText}
                          </div>
                        ) : null}
                        {meta.mapUrl ? (
                          <a
                            href={meta.mapUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-brand-700 hover:underline"
                          >
                            Open map
                          </a>
                        ) : null}
                      </figcaption>
                    </figure>
                    )
                  })}
                </div>
              </Section>
            ) : null,
          )}

          {completed ? (
            <Section title="After your move">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <a
                  href={googleReviewHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-bold text-white"
                >
                  ⭐ Leave us a Google Review
                </a>
                <Link
                  to={`/track/${token}/tip`}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800"
                >
                  💷 Leave a Tip
                </Link>
                <Link
                  to={`/track/${token}/feedback`}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800"
                >
                  Leave Feedback
                </Link>
              </div>
              <p className="text-xs text-slate-500">Tips are optional and separate from your booking payment.</p>
              {data.feedback_submitted ? (
                <p className="text-sm text-emerald-700">Thanks — feedback received.</p>
              ) : null}
              {Number(data.tip_total_gbp) > 0 ? (
                <p className="text-sm text-slate-600">Tip paid: £{Number(data.tip_total_gbp).toFixed(2)}</p>
              ) : null}
            </Section>
          ) : null}
        </main>
      </div>
    </>
  )
}
