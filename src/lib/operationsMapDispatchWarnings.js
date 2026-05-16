import { haversineMiles } from './operationsMapHelpers'
import { quoteJobRef } from './operationsMapHelpers'
import { driverStatusFromContext } from './operationsMapDispatchStatus'
import { JOURNEY_VAN_CAPACITY_M3 } from './journeySummary'
import { parsePricingText } from './quoteJobAdminModel'
import { filterActiveQuotes } from './adminWorkflowFilters'

/**
 * Extended dispatch warnings — merged with legacy warnings in page.
 * @param {{
 *   quotes: Record<string, unknown>[],
 *   jobs: Record<string, unknown>[],
 *   coordsByQuoteId: Record<string, { pickup?: { lng: number, lat: number }, delivery?: { lng: number, lat: number } }>,
 *   visibleJobQuotes: Record<string, unknown>[] | null,
 *   driversList: Record<string, unknown>[],
 *   liveByDriverKey: Record<string, Record<string, unknown>>,
 *   activeQuotesForMap: Record<string, unknown>[],
 *   etaByDriverId?: Record<string, { pickup?: { label: string, delayed?: boolean }, delivery?: { label: string, delayed?: boolean } }>,
 * }} ctx
 */
export function buildExtendedDispatchWarnings(ctx) {
  const w = []
  const {
    quotes,
    jobs,
    coordsByQuoteId,
    visibleJobQuotes,
    driversList,
    liveByDriverKey,
    activeQuotesForMap,
    etaByDriverId = {},
  } = ctx

  const list = visibleJobQuotes || []

  /** Driver too far from assigned job */
  for (const q of activeQuotesForMap || []) {
    const driverName = String(q.assigned_driver_name || '').trim().toLowerCase()
    if (!driverName) continue
    const driver = driversList.find((d) => String(d.name || '').trim().toLowerCase() === driverName)
    if (!driver) continue
    const live = liveByDriverKey[String(driver.id)]
    if (!live || !Number.isFinite(Number(live.lng))) continue
    const c = coordsByQuoteId[String(q.id)]
    if (!c?.pickup) continue
    const mi = haversineMiles(Number(live.lng), Number(live.lat), c.pickup.lng, c.pickup.lat)
    if (mi > 35) {
      w.push(`Driver far from job (${Math.round(mi)} mi): ${quoteJobRef(q)}`)
    }
  }

  /** Overloaded driver */
  const jobsByDriver = new Map()
  for (const q of activeQuotesForMap || []) {
    const dn = String(q.assigned_driver_name || '').trim().toLowerCase()
    if (!dn) continue
    jobsByDriver.set(dn, (jobsByDriver.get(dn) || 0) + 1)
  }
  for (const [dn, count] of jobsByDriver) {
    if (count >= 4) w.push(`Overloaded driver (${count} active jobs): ${dn}`)
  }

  /** Idle driver with nearby unassigned jobs */
  for (const d of driversList) {
    const id = String(d.id)
    const live = liveByDriverKey[id]
    const assigned = (activeQuotesForMap || []).filter(
      (q) => String(q.assigned_driver_name || '').trim().toLowerCase() === String(d.name || '').trim().toLowerCase(),
    )
    const status = driverStatusFromContext(d, live, assigned)
    if (status !== 'idle' && status !== 'assigned') continue
    if (!live || !Number.isFinite(Number(live.lng))) continue
    const unassigned = list.filter((q) => !String(q.assigned_driver_name || '').trim())
    for (const q of unassigned.slice(0, 40)) {
      const c = coordsByQuoteId[String(q.id)]
      if (!c?.pickup) continue
      const mi = haversineMiles(Number(live.lng), Number(live.lat), c.pickup.lng, c.pickup.lat)
      if (mi <= 12) {
        w.push(`Idle driver near unassigned job (${Math.round(mi)} mi): ${String(d.name)} → ${quoteJobRef(q)}`)
        break
      }
    }
  }

  /** Route delay / ETA risk */
  for (const d of driversList) {
    const id = String(d.id)
    const eta = etaByDriverId[id]
    if (!eta) continue
    if (eta.pickup?.delayed || eta.delivery?.delayed) {
      w.push(`Delay risk: ${String(d.name)} (${eta.pickup?.label || eta.delivery?.label})`)
    }
    if (String(eta.pickup?.label || '').includes('Traffic')) {
      w.push(`Traffic delay: ${String(d.name)} pickup`)
    }
  }

  /** Capacity on visible active quotes bundle */
  let volSum = 0
  for (const q of filterActiveQuotes(quotes, jobs)) {
    const parsed = parsePricingText(q.pricing)
    if (parsed.volumeM3 != null) volSum += parsed.volumeM3
  }
  if (volSum > JOURNEY_VAN_CAPACITY_M3 * 1.2) {
    w.push(`Fleet volume high today (~${volSum.toFixed(0)} m³ planned)`)
  }

  return [...new Set(w)].slice(0, 10)
}
