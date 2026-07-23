import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import mapboxgl from 'mapbox-gl'
import SeoHead from '../components/seo/SeoHead'
import { formatDateTimeUK, formatDateUK } from '../lib/formatDateDisplay'
import {
  customerJobStatusLabel,
  photoSectionForType,
  trackingClient,
} from '../lib/jobCustomerTracking'
import 'mapbox-gl/dist/mapbox-gl.css'

const POLL_MS = 15000

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-bold text-slate-900 sm:text-lg">{title}</h2>
      <div className="mt-3 space-y-2 text-sm text-slate-700">{children}</div>
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

export default function JobTrackingPortalPage() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const viewEvidence = searchParams.get('view') === 'evidence'
  const [data, setData] = useState(null)
  const [media, setMedia] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const mapRef = useRef(null)
  const mapObjRef = useRef(null)
  const markerRef = useRef(null)

  const load = useCallback(async () => {
    const t = String(token || '').trim()
    const client = trackingClient()
    if (!t || !client) {
      setError('Tracking link unavailable.')
      setLoading(false)
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

      const { data: mediaRes } = await client.functions.invoke('get-job-tracking-media', {
        body: { token: t },
      })
      if (mediaRes?.photos) setMedia(mediaRes.photos)
    } catch (e) {
      setError(e?.message || 'Could not load tracking.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(id)
  }, [load])

  const live = Boolean(data?.tracking_live && data?.location?.available)
  const mapToken = import.meta.env.VITE_MAPBOX_TOKEN

  useEffect(() => {
    if (!live || !mapToken || !mapRef.current || !data?.location) return
    const lng = Number(data.location.longitude)
    const lat = Number(data.location.latitude)
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return

    if (!mapObjRef.current) {
      mapboxgl.accessToken = mapToken
      mapObjRef.current = new mapboxgl.Map({
        container: mapRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [lng, lat],
        zoom: 13,
      })
      mapObjRef.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right')
      markerRef.current = new mapboxgl.Marker({ color: '#0284c7' }).setLngLat([lng, lat]).addTo(mapObjRef.current)
    } else {
      markerRef.current?.setLngLat([lng, lat])
      mapObjRef.current.easeTo({ center: [lng, lat], duration: 800 })
    }
  }, [live, mapToken, data?.location?.latitude, data?.location?.longitude])

  useEffect(() => {
    return () => {
      mapObjRef.current?.remove()
      mapObjRef.current = null
      markerRef.current = null
    }
  }, [])

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

  const completed = Boolean(data?.completed)
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

  return (
    <>
      <SeoHead
        title={`Track booking ${data.quote_ref || ''} | ShiftMyHome`}
        description="Live driver tracking and job evidence for your ShiftMyHome booking."
        path={`/track/${token}`}
        robots="noindex, nofollow"
      />
      <div className="min-h-screen bg-slate-50 pb-16">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">ShiftMyHome</p>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                {viewEvidence || completed ? 'Job evidence' : 'Track my driver'}
              </h1>
              <p className="mt-0.5 font-mono text-sm text-slate-600">{data.quote_ref}</p>
            </div>
            <div className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">{statusLabel}</div>
          </div>
        </header>

        <main className="mx-auto mt-4 flex max-w-3xl flex-col gap-4 px-4 sm:mt-6 sm:px-6">
          {!completed ? (
            <Section title="Live location">
              {live && mapToken ? (
                <div ref={mapRef} className="h-64 w-full overflow-hidden rounded-xl sm:h-80" />
              ) : (
                <p className="rounded-xl bg-amber-50 px-3 py-3 text-amber-900">
                  {data.location?.message || 'Location temporarily unavailable'}
                </p>
              )}
              <Row
                label="Last update"
                value={data.location?.updated_at ? formatDateTimeUK(data.location.updated_at) : '—'}
              />
            </Section>
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
                  {photoGroups[key].map((p) => (
                    <figure key={p.id} className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                      {p.signed_url ? (
                        <a href={p.signed_url} target="_blank" rel="noreferrer">
                          <img src={p.signed_url} alt="" className="aspect-square w-full object-cover" />
                        </a>
                      ) : (
                        <div className="flex aspect-square items-center justify-center text-xs text-slate-400">No preview</div>
                      )}
                      <figcaption className="space-y-0.5 p-2 text-[11px] text-slate-600">
                        <div>{p.created_at ? formatDateTimeUK(p.created_at) : ''}</div>
                        <div className="capitalize">{String(p.photo_type || '').replace(/_/g, ' ')}</div>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </Section>
            ) : null,
          )}

          {completed ? (
            <Section title="After your move">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  to={`/track/${token}/feedback`}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-bold text-white"
                >
                  Leave Feedback
                </Link>
                <Link
                  to={`/track/${token}/tip`}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800"
                >
                  Leave a Tip
                </Link>
              </div>
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
