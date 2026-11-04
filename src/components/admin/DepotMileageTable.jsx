import { useEffect, useState } from 'react'
import { fetchDrivingRoute, geocodeAddress, metersToMiles } from '../../lib/mapboxRouteApi'

const DEPOT_GEOCODE_QUERY = '43 Kingswood Drive, Glasgow, G44 4RF'

/** @type {{ lng: number, lat: number } | null} */
let depotPointCache = null
/** @type {Map<string, { distanceMeters: number, durationSeconds: number }>} */
const routeCache = new Map()

function finitePoint(lng, lat) {
  const x = Number(lng)
  const y = Number(lat)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  if (Math.abs(x) < 0.00001 && Math.abs(y) < 0.00001) return null
  return { lng: x, lat: y }
}

function pointKey(point) {
  return `${point.lng.toFixed(5)},${point.lat.toFixed(5)}`
}

async function depotPoint(token) {
  if (depotPointCache) return depotPointCache
  const point = await geocodeAddress(DEPOT_GEOCODE_QUERY, token)
  if (point) depotPointCache = point
  return point
}

async function drivingLeg(from, to, token) {
  const key = `${pointKey(from)}|${pointKey(to)}`
  const saved = routeCache.get(key)
  if (saved) return saved
  const route = await fetchDrivingRoute(from, to, token)
  if (!route) return null
  const leg = { distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds }
  routeCache.set(key, leg)
  return leg
}

function formatMiles(meters) {
  if (!Number.isFinite(meters)) return '—'
  const miles = metersToMiles(meters)
  if (miles >= 10) return `${Math.round(miles)} mi`
  if (miles > 0 && miles < 0.5) return '<1 mi'
  return `${miles.toFixed(1)} mi`
}

function formatDriveClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const totalMinutes = Math.max(0, Math.round(seconds / 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}:${String(minutes).padStart(2, '0')}`
}

function sumLegs(legs) {
  if (legs.some((leg) => !leg)) return null
  return legs.reduce(
    (total, leg) => ({
      distanceMeters: total.distanceMeters + leg.distanceMeters,
      durationSeconds: total.durationSeconds + leg.durationSeconds,
    }),
    { distanceMeters: 0, durationSeconds: 0 },
  )
}

/**
 * Drive from the company address to collection, back from delivery, and the round trip.
 * @param {{
 *   pickupLng?: unknown,
 *   pickupLat?: unknown,
 *   deliveryLng?: unknown,
 *   deliveryLat?: unknown,
 *   pickupAddress?: string,
 *   deliveryAddress?: string,
 * }} props
 */
export default function DepotMileageTable({
  pickupLng,
  pickupLat,
  deliveryLng,
  deliveryLat,
  pickupAddress = '',
  deliveryAddress = '',
}) {
  const token = String(import.meta.env.VITE_MAPBOX_TOKEN || '').trim()
  const [open, setOpen] = useState(false)
  const [legs, setLegs] = useState(/** @type {{ toPickup: object | null, backHome: object | null, roundTrip: object | null, loading: boolean }} */ ({
    toPickup: null,
    backHome: null,
    roundTrip: null,
    loading: false,
  }))

  const pickupSaved = finitePoint(pickupLng, pickupLat)
  const deliverySaved = finitePoint(deliveryLng, deliveryLat)
  const pickupText = String(pickupAddress || '').trim()
  const deliveryText = String(deliveryAddress || '').trim()

  useEffect(() => {
    if (!open || !token || (!pickupSaved && !pickupText) || (!deliverySaved && !deliveryText)) {
      if (!open) setLegs({ toPickup: null, backHome: null, roundTrip: null, loading: false })
      return undefined
    }
    let cancelled = false
    setLegs((current) => ({ ...current, loading: true }))
    void (async () => {
      const [depot, pickup, delivery] = await Promise.all([
        depotPoint(token),
        pickupSaved ? Promise.resolve(pickupSaved) : geocodeAddress(pickupText, token),
        deliverySaved ? Promise.resolve(deliverySaved) : geocodeAddress(deliveryText, token),
      ])
      if (!depot || !pickup || !delivery) {
        if (!cancelled) setLegs({ toPickup: null, backHome: null, roundTrip: null, loading: false })
        return
      }
      const [toPickup, job, backHome] = await Promise.all([
        drivingLeg(depot, pickup, token),
        drivingLeg(pickup, delivery, token),
        drivingLeg(delivery, depot, token),
      ])
      if (cancelled) return
      setLegs({
        toPickup,
        backHome,
        roundTrip: sumLegs([toPickup, job, backHome]),
        loading: false,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [
    token,
    pickupSaved?.lng,
    pickupSaved?.lat,
    deliverySaved?.lng,
    deliverySaved?.lat,
    pickupText,
    deliveryText,
    open,
  ])

  const rows = [
    { label: 'Your address to pickup', leg: legs.toPickup, shaded: false, strong: false },
    { label: 'Drop off to your address', leg: legs.backHome, shaded: true, strong: false },
    { label: 'Round trip', leg: legs.roundTrip, shaded: false, strong: true },
  ]

  return (
    <div className="border-t border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-8 items-center rounded-full border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
      >
        More info
      </button>
      {open ? (
        <div role="table" aria-label="Drive to pickup and back" className="-mx-3 mt-2">
          {rows.map((row) => (
            <div
              key={row.label}
              role="row"
              className={`grid grid-cols-[minmax(0,1fr)_4.5rem_3.25rem] items-center gap-2 px-3 py-1.5 ${
                row.shaded ? 'bg-slate-100' : ''
              } ${row.strong ? 'font-semibold text-slate-950' : ''}`}
            >
              <span role="cell" className="min-w-0">
                {row.label}
              </span>
              <span role="cell" className="text-right tabular-nums">
                {legs.loading ? '…' : formatMiles(row.leg?.distanceMeters)}
              </span>
              <span role="cell" className="text-right tabular-nums">
                {legs.loading ? '…' : formatDriveClock(row.leg?.durationSeconds)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
