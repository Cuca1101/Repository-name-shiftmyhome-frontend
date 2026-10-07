const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MANAGEMENT_TOKEN || ''
const REF = process.env.SUPABASE_PROJECT_REF || 'msjhkfdqogymkartariq'
if (!TOKEN) {
  console.error('Set SUPABASE_ACCESS_TOKEN (or SUPABASE_MANAGEMENT_TOKEN) to run this live test.')
  process.exit(1)
}
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: sql }),
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${t}`)
  const parsed = JSON.parse(t)
  return Array.isArray(parsed) ? parsed : parsed.value || parsed
}

function row(result) {
  return Array.isArray(result) ? result[0] : result
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const linked = row(
  await q(`
  select t.token::text,
         q.assigned_driver_id::text as driver_id,
         dl.latitude::float8 as latitude,
         dl.longitude::float8 as longitude,
         d.full_name as driver_name,
         q.quote_ref
  from job_tracking_tokens t
  join quotes q on q.id = t.quote_id
  join driver_locations dl on dl.driver_id = q.assigned_driver_id
  left join drivers d on d.id = q.assigned_driver_id
  where t.revoked_at is null
    and (t.expires_at is null or t.expires_at > now())
    and lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid')
    and lower(coalesce(q.operational_status, '')) not in ('completed', 'cancelled')
    and dl.latitude is not null
    and dl.longitude is not null
  order by dl.updated_at desc
  limit 1`),
)

if (!linked?.token || !linked?.driver_id) throw new Error('no paid live-tracking job with GPS')

const driverId = linked.driver_id
const lat = Number(linked.latitude)
const lng = Number(linked.longitude)
const trackToken = linked.token
console.log('using', {
  driver: linked.driver_name,
  quote_ref: linked.quote_ref,
  driverId,
  token: trackToken.slice(0, 8),
})

const lat2 = lat + 80 / 111111
await q(
  `update driver_locations set latitude=${lat2}, longitude=${lng}, speed=0, updated_at=now() where driver_id='${driverId}'`,
)
let s = row(await q(`select motion_state, last_moved_at, updated_at from driver_locations where driver_id='${driverId}'`))
console.log('after move', s)
if (s.motion_state !== 'moving') throw new Error(`expected moving, got ${s.motion_state}`)

const lm1 = s.last_moved_at
const lat3 = lat2 + 5 / 111111
await sleep(1100)
await q(
  `update driver_locations set latitude=${lat3}, longitude=${lng}, speed=0, updated_at=now() where driver_id='${driverId}'`,
)
s = row(await q(`select motion_state, last_moved_at, updated_at from driver_locations where driver_id='${driverId}'`))
console.log('after stationary ping', s)
if (s.motion_state !== 'stationary') throw new Error(`expected stationary, got ${s.motion_state}`)
if (String(s.last_moved_at).slice(0, 19) !== String(lm1).slice(0, 19)) {
  throw new Error(`last_moved_at reset: ${lm1} -> ${s.last_moved_at}`)
}

await q(`update driver_locations set updated_at=now() where driver_id='${driverId}'`)
const portalRow = row(await q(`select public_get_job_tracking('${trackToken}'::uuid) as p`))
const p = portalRow.p
console.log('RPC live motion', p.location?.motion)
console.log('driver', p.driver)
console.log('quote_ref', p.quote_ref)
console.log('tracking_live', p.tracking_live)

if (!p?.ok) throw new Error(`RPC not ok: ${JSON.stringify(p)}`)
if (!p.driver?.full_name) throw new Error('missing driver full_name')
if (!p.quote_ref) throw new Error('missing quote_ref')
if (!p.location?.motion?.state) throw new Error('missing motion in RPC')
if (p.tracking_live !== true) throw new Error('expected tracking_live after fresh GPS')
if (p.location.motion.state !== 'stationary') {
  throw new Error(`expected stationary motion, got ${p.location.motion.state}`)
}
if (p.location.motion.state === 'stationary' && p.location.motion.stationary_minutes == null) {
  throw new Error('stationary missing minutes')
}

// Stale GPS must NOT report stationary.
// driver_locations_set_updated_at always rewrites updated_at=now() on UPDATE,
// so disable it briefly to simulate a phone that stopped sending GPS.
await q(`alter table public.driver_locations disable trigger driver_locations_set_updated_at`)
try {
  await q(
    `update driver_locations set updated_at = now() - interval '4 minutes' where driver_id='${driverId}'`,
  )
  const staleRow = row(await q(`select public_get_job_tracking('${trackToken}'::uuid) as p`))
  const stale = staleRow.p
  console.log('RPC stale motion', stale.location?.motion)
  if (stale.tracking_live) throw new Error('expected not live when GPS is 4 min old')
  if (stale.location?.motion?.state !== 'stale') {
    throw new Error(`expected stale, got ${stale.location?.motion?.state}`)
  }
  if (!/waiting for a fresh GPS/i.test(String(stale.location?.motion?.label || ''))) {
    throw new Error(`unexpected stale label: ${stale.location?.motion?.label}`)
  }
} finally {
  await q(`alter table public.driver_locations enable trigger driver_locations_set_updated_at`)
  await q(`update driver_locations set updated_at=now() where driver_id='${driverId}'`)
}

console.log('ok live motion sequence')
