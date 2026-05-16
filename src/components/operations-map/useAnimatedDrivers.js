import { useEffect, useRef, useState } from 'react'
import { driverStatusFromContext } from '../../lib/operationsMapDispatchStatus'

const LERP_MS = 2800
const MOVING_SPEED_MPH = 3

/**
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 */
function bearingDeg(lat1, lng1, lat2, lng2) {
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/**
 * @param {Record<string, unknown>[]} driversList
 * @param {Record<string, Record<string, unknown>>} liveByDriverKey
 * @param {Record<string, unknown>[]} activeQuotes
 */
export function useAnimatedDrivers(driversList, liveByDriverKey, activeQuotes) {
  /** @type {React.MutableRefObject<Record<string, {
   *   lng: number, lat: number, bearing: number, speedMph: number,
   *   moving: boolean, status: string, targetLng: number, targetLat: number,
   *   fromLng: number, fromLat: number, startMs: number, lastGpsAt: string | null,
   * }>>} */
  const animRef = useRef({})
  const [tick, setTick] = useState(0)
  const lastPublishRef = useRef(0)

  useEffect(() => {
    const now = performance.now()
    for (const d of driversList || []) {
      const id = String(d?.id ?? '').trim()
      if (!id) continue
      const live = liveByDriverKey[id]
      const nameNorm = String(d.name || '').trim().toLowerCase()
      const assigned = (activeQuotes || []).filter(
        (q) => String(q.assigned_driver_name || '').trim().toLowerCase() === nameNorm,
      )
      const status = driverStatusFromContext(d, live, assigned)
      const hasGps = live != null && Number.isFinite(Number(live.lng)) && Number.isFinite(Number(live.lat))
      const targetLng = hasGps ? Number(live.lng) : null
      const targetLat = hasGps ? Number(live.lat) : null

      let slot = animRef.current[id]
      if (!slot) {
        if (targetLng == null) continue
        slot = {
          lng: targetLng,
          lat: targetLat,
          bearing: 0,
          speedMph: 0,
          moving: false,
          status,
          targetLng,
          targetLat,
          fromLng: targetLng,
          fromLat: targetLat,
          startMs: now,
          lastGpsAt: live?.updated_at != null ? String(live.updated_at) : null,
        }
        animRef.current[id] = slot
        continue
      }

      slot.status = status
      slot.lastGpsAt = live?.updated_at != null ? String(live.updated_at) : slot.lastGpsAt

      if (targetLng == null || targetLat == null) continue

      const dist =
        Math.abs(targetLng - slot.lng) + Math.abs(targetLat - slot.lat)
      if (dist > 0.00002) {
        slot.fromLng = slot.lng
        slot.fromLat = slot.lat
        slot.targetLng = targetLng
        slot.targetLat = targetLat
        slot.startMs = now
        slot.bearing = bearingDeg(slot.fromLat, slot.fromLng, targetLat, targetLng)
      }
    }
  }, [driversList, liveByDriverKey, activeQuotes])

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const now = performance.now()
      let moved = false
      for (const id of Object.keys(animRef.current)) {
        const s = animRef.current[id]
        const t = Math.min(1, (now - s.startMs) / LERP_MS)
        const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
        const lng = s.fromLng + (s.targetLng - s.fromLng) * ease
        const lat = s.fromLat + (s.targetLat - s.fromLat) * ease
        if (Math.abs(lng - s.lng) > 0.000001 || Math.abs(lat - s.lat) > 0.000001) moved = true
        s.lng = lng
        s.lat = lat
        const dtSec = Math.max(0.5, (now - s.startMs) / 1000)
        const distMi =
          Math.hypot(s.targetLng - s.fromLng, s.targetLat - s.fromLat) * 69 * Math.cos((s.lat * Math.PI) / 180)
        s.speedMph = distMi > 0 ? (distMi / dtSec) * 3600 : 0
        s.moving = t < 1 && s.speedMph > MOVING_SPEED_MPH
      }
      if (moved && now - lastPublishRef.current > 120) {
        lastPublishRef.current = now
        setTick((x) => x + 1)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const animated = (driversList || [])
    .map((d) => {
      const id = String(d?.id ?? '')
      const slot = animRef.current[id]
      if (!slot) return null
      const nameNorm = String(d.name || '').trim().toLowerCase()
      const assigned = (activeQuotes || []).filter(
        (q) => String(q.assigned_driver_name || '').trim().toLowerCase() === nameNorm,
      )
      const live = liveByDriverKey[id]
      return {
        driverId: id,
        name: String(d.name || 'Driver'),
        initials: String(d.name || 'DR').slice(0, 2).toUpperCase(),
        lng: slot.lng,
        lat: slot.lat,
        bearing: slot.bearing,
        speedMph: slot.speedMph,
        moving: slot.moving,
        status: slot.status,
        lastGpsAt: slot.lastGpsAt,
        assignedCount: assigned.length,
        activeJobRef: assigned[0] ? String(assigned[0].quote_ref || assigned[0].id).slice(0, 12) : '',
        online: live != null && String(d.status) !== 'Suspended',
      }
    })
    .filter(Boolean)

  void tick
  return animated
}
