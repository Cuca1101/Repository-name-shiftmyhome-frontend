/**
 * One-shot: public_get_job_tracking + Mapbox ETA for a real token.
 * Usage: node scripts/verify-track-portal-live.mjs <token>
 */
import { readFileSync } from 'node:fs'
import { resolveTrackingDriverEta, resolveTrackingEtaDestination, isTrackingGpsFresh } from '../src/lib/trackingDriverEta.js'

function loadEnv() {
  const out = {}
  try {
    for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([^=]+)=(.*)$/)
      if (!m) continue
      out[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* ignore */
  }
  return out
}

const env = loadEnv()
const token = String(process.argv[2] || '').trim()
if (!token) {
  console.error('Usage: node scripts/verify-track-portal-live.mjs <tracking-token>')
  process.exit(1)
}

const url = env.VITE_SUPABASE_URL
const anon = env.VITE_SUPABASE_ANON_KEY
const mapbox = env.VITE_MAPBOX_TOKEN

const res = await fetch(`${url}/rest/v1/rpc/public_get_job_tracking`, {
  method: 'POST',
  headers: {
    apikey: anon,
    Authorization: `Bearer ${anon}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ p_token: token }),
})
const portal = await res.json()
if (!portal?.ok) {
  console.log('portal_error', portal)
  process.exit(1)
}

const dest = resolveTrackingEtaDestination(portal.operational_status, portal.status_raw)
const fresh = isTrackingGpsFresh({
  trackingLive: portal.tracking_live,
  location: portal.location,
})
const ageMin = portal.location?.updated_at
  ? (Date.now() - Date.parse(portal.location.updated_at)) / 60000
  : null

console.log({
  quote_ref: portal.quote_ref,
  status: `${portal.operational_status}/${portal.status_raw}`,
  driver: portal.driver?.full_name,
  tracking_live: portal.tracking_live,
  location_available: portal.location?.available,
  location_live: portal.location?.live,
  motion: portal.location?.motion?.state,
  gps_age_min: ageMin != null ? Number(ageMin.toFixed(1)) : null,
  eta_destination: dest,
  gps_fresh: fresh,
})

if (!portal.location?.available || !dest) {
  process.exit(0)
}

const staleResult = await resolveTrackingDriverEta({
  token: mapbox,
  driver: {
    lng: Number(portal.location.longitude),
    lat: Number(portal.location.latitude),
  },
  destinationAddress: dest.kind === 'delivery' ? portal.delivery_address : portal.pickup_address,
  kind: dest.kind,
  placeLabel: dest.placeLabel,
  gpsFresh: false,
  cache: {},
})

const liveResult = await resolveTrackingDriverEta({
  token: mapbox,
  driver: {
    lng: Number(portal.location.longitude),
    lat: Number(portal.location.latitude),
  },
  destinationAddress: dest.kind === 'delivery' ? portal.delivery_address : portal.pickup_address,
  kind: dest.kind,
  placeLabel: dest.placeLabel,
  gpsFresh: true,
  cache: {},
})

console.log('route_when_stale', {
  status: staleResult.status,
  routePts: staleResult.routeCoordinates?.length || 0,
  hasDestination: Boolean(staleResult.destination),
  liveEtaHidden: staleResult.minutesLabel == null,
})
console.log('route_if_gps_fresh', {
  status: liveResult.status,
  minutes: liveResult.minutesLabel,
  miles: liveResult.milesLabel,
  clock: liveResult.clock,
  routePts: liveResult.routeCoordinates?.length || 0,
})
