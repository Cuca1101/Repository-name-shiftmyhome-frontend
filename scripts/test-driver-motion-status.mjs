import {
  computeMotionFromPoints,
  DRIVER_MOVE_THRESHOLD_M,
} from '../src/lib/driverMotionStatus.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const base = { lat: 56.46, lng: -2.97 }
const t0 = Date.parse('2026-10-07T14:00:00Z')

/** Build points every `stepMs`, optionally shifting east by metres≈111111*dLat. */
function pts(specs) {
  return specs.map((s, i) => ({
    lat: base.lat + (s.northM || 0) / 111111,
    lng: base.lng + (s.eastM || 0) / (111111 * Math.cos((base.lat * Math.PI) / 180)),
    recorded_at: new Date(t0 + (s.t ?? i * 60000)).toISOString(),
    speed: s.speed ?? 0,
  }))
}

// 1) Moving: last hop > 40m
{
  const points = pts([
    { t: 0, eastM: 0 },
    { t: 60000, eastM: 10 },
    { t: 120000, eastM: 80 },
  ])
  const m = computeMotionFromPoints(points, { now: t0 + 120000 })
  assert(m.state === 'moving', `expected moving, got ${m.state}`)
}

// 2) Stationary with fresh same-spot pings — timer from first stop, not reset
{
  const points = pts([
    { t: 0, eastM: 0 },
    { t: 60000, eastM: 100 }, // moved
    { t: 120000, eastM: 100 }, // stop starts
    { t: 180000, eastM: 105 }, // drift < 40m
    { t: 240000, eastM: 108 },
  ])
  const m = computeMotionFromPoints(points, { now: t0 + 240000 })
  assert(m.state === 'stationary', `expected stationary, got ${m.state}`)
  assert(m.stationary_minutes >= 2, `expected >=2 min stationary, got ${m.stationary_minutes}`)
  assert(m.last_moved_at === points[1].recorded_at, 'last movement should be the 100m hop')
}

// 3) Stale GPS must not say stationary
{
  const points = pts([
    { t: 0, eastM: 0 },
    { t: 60000, eastM: 0 },
  ])
  const m = computeMotionFromPoints(points, { now: t0 + 60000 + 5 * 60 * 1000 })
  assert(m.state === 'stale', `expected stale, got ${m.state}`)
  assert(/waiting for a fresh GPS/i.test(m.label), `unexpected label ${m.label}`)
}

// 4) Speed alone counts as movement
{
  const points = pts([
    { t: 0, eastM: 0, speed: 0 },
    { t: 30000, eastM: 5, speed: 8 },
  ])
  const m = computeMotionFromPoints(points, { now: t0 + 30000 })
  assert(m.state === 'moving', `speed should mark moving, got ${m.state}`)
}

console.log('ok driver motion tests', { thresholdM: DRIVER_MOVE_THRESHOLD_M })
