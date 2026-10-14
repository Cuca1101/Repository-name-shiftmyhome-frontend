import { useEffect, useRef, useState } from 'react'
import { driverStatusFromContext } from '../../lib/operationsMapDispatchStatus'
import { formatDriverTrackingStatus } from '../../lib/data/driverLivePositionsRepository'

const LERP_MS = 2800
const MOVING_SPEED_MPH = 3

/**
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 */
function quotesForDriver(activeQuotes, driverId, driverName) {
  const id = String(driverId || '').trim()
  const nameNorm = String(driverName || '').trim().toLowerCase()
  return (activeQuotes || []).filter((q) => {
    const aid = String(q.assigned_driver_id || '').trim()
    if (aid && id && aid === id) return true
    const dn = String(q.assigned_driver_name || '').trim().toLowerCase()
    return Boolean(dn && nameNorm && dn === nameNorm)
  })
}

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
 * @param {Record<string, { pickup?: { lng: number, lat: number } | null }>} [coordsByQuoteId]
 */
export function useAnimatedDrivers(driversList, liveByDriverKey, activeQuotes, coordsByQuoteId = {}) {
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
    let changed = false
    for (const d of driversList || []) {
      const id = String(d?.id ?? '').trim()
      if (!id) continue
      const live = liveByDriverKey[id]
      const assigned = quotesForDriver(activeQuotes, id, d.name)
      const status = driverStatusFromContext(d, live, assigned)
      const hasGps = live != null && Number.isFinite(Number(live.lng)) && Number.isFinite(Number(live.lat))
      const jobPoint = assigned
        .map((q) => coordsByQuoteId[String(q.id)]?.pickup)
        .find((point) => point && Number.isFinite(Number(point.lng)) && Number.isFinite(Number(point.lat)))
      const targetLng = hasGps ? Number(live.lng) : jobPoint ? Number(jobPoint.lng) : null
      const targetLat = hasGps ? Number(live.lat) : jobPoint ? Number(jobPoint.lat) : null

      let slot = animRef.current[id]
      if (targetLng == null || targetLat == null) {
        if (slot && !hasGps) {
          delete animRef.current[id]
          changed = true
        }
        continue
      }
      if (!slot) {
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
        changed = true
        continue
      }

      slot.status = status
      slot.lastGpsAt = live?.updated_at != null ? String(live.updated_at) : slot.lastGpsAt

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
    if (changed) setTick((x) => x + 1)
  }, [driversList, liveByDriverKey, activeQuotes, coordsByQuoteId])

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
      const assigned = quotesForDriver(activeQuotes, id, d.name)
      const live = liveByDriverKey[id]
      const quoteRefFromLive =
        live?.quote_ref != null && String(live.quote_ref).trim()
          ? String(live.quote_ref).trim()
          : ''
      const activeJobRef =
        quoteRefFromLive ||
        (assigned[0] ? String(assigned[0].quote_ref || assigned[0].id).slice(0, 12) : '')
      return {
        driverId: id,
        name: String(live?.driver_name || d.name || 'Driver'),
        initials: String(live?.driver_name || d.name || 'DR').slice(0, 2).toUpperCase(),
        lng: slot.lng,
        lat: slot.lat,
        bearing: slot.bearing,
        speedMph: slot.speedMph,
        moving: slot.moving && !live?.stale,
        status: slot.status,
        trackingStatus: formatDriverTrackingStatus(
          live?.tracking_status || live?.status || '',
        ),
        lastGpsAt: slot.lastGpsAt,
        assignedCount: assigned.length,
        activeJobRef,
        assignmentRef: live?.assignment_ref != null ? String(live.assignment_ref) : '',
        driverPhone: live?.driver_phone != null ? String(live.driver_phone) : String(d.phone || ''),
        stale: Boolean(live?.stale),
        staleLabel: live?.stale_label != null ? String(live.stale_label) : null,
        online: live != null && !live?.stale && String(d.status) !== 'Suspended',
        waitingGps: !(live != null && Number.isFinite(Number(live.lng)) && Number.isFinite(Number(live.lat))),
      }
    })
    .filter(Boolean)

  void tick
  return animated
}
