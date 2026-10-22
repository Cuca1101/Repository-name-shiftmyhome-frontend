/**
 * Fill missing collection and delivery coordinates for open bookings.
 * A result is saved only when Mapbox returns a street address or a full
 * postcode, so a town name cannot become the 100 m arrival point.
 * Existing coordinates are not overwritten.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = readFileSync(resolve(root, '.env'), 'utf8')
const token = (env.match(/^VITE_MAPBOX_TOKEN=(.*)$/m)?.[1] || '').trim().replace(/^["']|["']$/g, '')
if (!token) {
  console.error('VITE_MAPBOX_TOKEN is missing')
  process.exit(1)
}

function specificAddress(value) {
  const text = String(value || '').trim()
  if (text.length < 8) return false
  if (/^(no|n\/a|na|test)$/i.test(text)) return false
  return /\d/.test(text) && /[a-z]/i.test(text)
}

async function geocode(query) {
  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`)
  url.searchParams.set('access_token', token)
  url.searchParams.set('country', 'gb')
  url.searchParams.set('limit', '1')
  const response = await fetch(url)
  if (!response.ok) return null
  const body = await response.json()
  const feature = body.features?.[0]
  if (!feature?.center || feature.center.length < 2) return null
  const types = feature.place_type || []
  const street = types.includes('address') || types.includes('poi')
  const fullPostcode = types.includes('postcode') && /[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i.test(query)
  if (!street && !fullPostcode) return null
  const [lng, lat] = feature.center
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const selectFile = resolve(root, '.tmp-stop-coordinates-select.sql')
writeFileSync(
  selectFile,
  `select id, pickup_address, delivery_address, pickup_lat, delivery_lat
from quotes
where cancelled_at is null
  and completed_at is null
  and lower(coalesce(operational_status, '')) is distinct from 'cancelled'
  and (
    (coalesce(pickup_address, '') <> '' and pickup_lat is null)
    or (coalesce(delivery_address, '') <> '' and delivery_lat is null)
  );`,
  'utf8',
)
const raw = execFileSync(npx, ['supabase', 'db', 'query', '--linked', '--file', selectFile], {
  cwd: root,
  encoding: 'utf8',
  shell: true,
  maxBuffer: 20 * 1024 * 1024,
})
const parsed = JSON.parse(raw.slice(raw.indexOf('{')))
const rows = parsed.rows || []
const cache = new Map()

async function pointFor(address) {
  const key = String(address || '').trim().toLowerCase()
  if (!key || !specificAddress(address)) return null
  if (cache.has(key)) return cache.get(key)
  const point = await geocode(address)
  cache.set(key, point)
  return point
}

const updates = []
let savedStops = 0
let skipped = 0
for (const row of rows) {
  const pickup = row.pickup_lat == null ? await pointFor(row.pickup_address) : null
  const delivery = row.delivery_lat == null ? await pointFor(row.delivery_address) : null
  if (!pickup && !delivery) {
    skipped += 1
    continue
  }
  const sets = []
  if (pickup) {
    sets.push(`pickup_lat = ${pickup.lat}`, `pickup_lng = ${pickup.lng}`)
    savedStops += 1
  }
  if (delivery) {
    sets.push(`delivery_lat = ${delivery.lat}`, `delivery_lng = ${delivery.lng}`)
    savedStops += 1
  }
  updates.push(
    `update public.quotes set ${sets.join(', ')} where id = '${row.id}' and (pickup_lat is null or delivery_lat is null);`,
  )
}

if (!updates.length) {
  console.log(`No street-level coordinates to save. Skipped ${skipped} bookings.`)
  process.exit(0)
}

const file = resolve(root, '.tmp-stop-coordinates.sql')
writeFileSync(file, updates.join('\n'), 'utf8')
execFileSync(npx, ['supabase', 'db', 'query', '--linked', '--file', file], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
})
unlinkSync(file)
unlinkSync(selectFile)
console.log(`Saved ${savedStops} stop coordinates across ${updates.length} bookings. Skipped ${skipped}.`)
