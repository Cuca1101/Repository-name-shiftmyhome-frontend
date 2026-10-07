import { haversineMetres } from './jobLocationAnalytics.js'

const UK_TIME_ZONE = 'Europe/London'

/** Metres — ignore GPS jitter below this. */
export const DRIVER_MOVE_THRESHOLD_M = 40

/** m/s — clear movement by speed (~3.1 mph). */
export const DRIVER_MOVE_SPEED_MPS = 1.4

/**
 * @param {unknown} speed
 * @returns {number | null} metres per second
 */
export function normalizeSpeedMps(speed) {
  if (speed == null || speed === '') return null
  const n = Number(speed)
  if (!Number.isFinite(n) || n < 0) return null
  return n > 45 ? n / 2.23694 : n
}

/**
 * @param {string | null | undefined} iso
 * @returns {string} HH:MM Europe/London
 */
export function formatTimeUK(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-GB', {
    timeZone: UK_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * Pure motion calculation from consecutive GPS points (oldest → newest).
 * Used for unit tests and optional client refinement.
 *
 * @param {Array<{ lat: number, lng: number, recorded_at: string, speed?: number | null }>} points
 * @param {{ now?: number, staleMs?: number, moveThresholdM?: number, speedMps?: number }} [opts]
 */
export function computeMotionFromPoints(points, opts = {}) {
  const now = opts.now ?? Date.now()
  const staleMs = opts.staleMs ?? 3 * 60 * 1000
  const moveM = opts.moveThresholdM ?? DRIVER_MOVE_THRESHOLD_M
  const speedMps = opts.speedMps ?? DRIVER_MOVE_SPEED_MPS

  const sorted = [...(points || [])]
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.recorded_at)
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())

  if (!sorted.length) {
    return {
      state: 'unavailable',
      label: 'Location temporarily unavailable',
      last_moved_at: null,
      stationary_minutes: null,
      updated_at: null,
    }
  }

  const latest = sorted[sorted.length - 1]
  const updatedAt = latest.recorded_at
  const updatedMs = new Date(updatedAt).getTime()
  const fresh = Number.isFinite(updatedMs) && now - updatedMs <= staleMs

  let lastMovedAt = sorted[0].recorded_at
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]
    const cur = sorted[i]
    const dist = haversineMetres(prev.lng, prev.lat, cur.lng, cur.lat)
    const spd = normalizeSpeedMps(cur.speed)
    if (dist >= moveM || (spd != null && spd >= speedMps)) {
      lastMovedAt = cur.recorded_at
    }
  }

  const lastMovedMs = new Date(lastMovedAt).getTime()
  const latestSpd = normalizeSpeedMps(latest.speed)
  let moving = false
  if (sorted.length >= 2) {
    const prev = sorted[sorted.length - 2]
    const dist = haversineMetres(prev.lng, prev.lat, latest.lng, latest.lat)
    const gapMs = updatedMs - new Date(prev.recorded_at).getTime()
    if (dist >= moveM && gapMs <= 2 * 60 * 1000) moving = true
  }
  if (latestSpd != null && latestSpd >= speedMps) moving = true

  if (!fresh) {
    return {
      state: 'stale',
      label: 'Last known location — waiting for a fresh GPS update',
      last_moved_at: lastMovedAt,
      stationary_minutes: null,
      updated_at: updatedAt,
    }
  }

  if (moving) {
    return {
      state: 'moving',
      label: 'Driver moving',
      last_moved_at: lastMovedAt,
      stationary_minutes: null,
      updated_at: updatedAt,
    }
  }

  const stationarySeconds = Math.max(0, Math.floor((updatedMs - lastMovedMs) / 1000))
  const stationaryMinutes = Math.floor(stationarySeconds / 60)
  return {
    state: 'stationary',
    label: stationaryMinutes < 1 ? 'Stationary' : `Stationary for ${stationaryMinutes} min`,
    last_moved_at: lastMovedAt,
    stationary_minutes: stationaryMinutes,
    stationary_seconds: stationarySeconds,
    updated_at: updatedAt,
  }
}

/**
 * Normalize motion payload from public_get_job_tracking location.motion.
 * @param {Record<string, unknown> | null | undefined} location
 */
export function resolveTrackingMotion(location) {
  const motion = location?.motion && typeof location.motion === 'object' ? location.motion : null
  const updatedAt = location?.updated_at != null ? String(location.updated_at) : null
  if (motion) {
    const state = String(motion.state || '').toLowerCase()
    return {
      state: state || 'unavailable',
      label: String(motion.label || ''),
      last_moved_at: motion.last_moved_at != null ? String(motion.last_moved_at) : null,
      stationary_minutes:
        motion.stationary_minutes != null && Number.isFinite(Number(motion.stationary_minutes))
          ? Number(motion.stationary_minutes)
          : null,
      updated_at: updatedAt,
    }
  }
  if (location?.live === false && location?.available) {
    return {
      state: 'stale',
      label: String(location.message || 'Last known location — waiting for a fresh GPS update'),
      last_moved_at: null,
      stationary_minutes: null,
      updated_at: updatedAt,
    }
  }
  return {
    state: 'unavailable',
    label: String(location?.message || 'Location temporarily unavailable'),
    last_moved_at: null,
    stationary_minutes: null,
    updated_at: updatedAt,
  }
}
