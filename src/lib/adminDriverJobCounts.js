import { quotePassesActiveStrict } from './adminJobListRules'
import { isDriverEligibleForAssignment } from './driverAdminLifecycle'
/**
 * Count accepted/active (non-terminal) jobs per driver id for admin picker cards.
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, unknown>[]} [_jobs]
 * @returns {Record<string, number>}
 */
export function countAcceptedJobsByDriverId(quotes, _jobs = []) {
  /** @type {Record<string, number>} */
  const out = {}
  for (const q of quotes) {
    if (!q || typeof q !== 'object') continue
    if (!quotePassesActiveStrict(q)) continue
    const id = q.assigned_driver_id != null ? String(q.assigned_driver_id).trim() : ''
    if (!id) continue
    out[id] = (out[id] || 0) + 1
  }
  return out
}

/**
 * @param {ReturnType<typeof import('./data/driversRepository.js').fleetDriverToAdminRecord>[]} drivers
 * @param {string} search
 */
/**
 * Fleet drivers eligible for mobile job assignment (active account, not suspended).
 * @param {ReturnType<typeof import('./data/driversRepository.js').fleetDriverToAdminRecord>[]} drivers
 */
export function filterActiveFleetDriversForAssignment(drivers) {
  return (drivers || []).filter((d) => isDriverEligibleForAssignment(d))
}

export function filterDriversForPicker(drivers, search) {
  const active = filterActiveFleetDriversForAssignment(drivers)
  const q = String(search || '').trim().toLowerCase()
  if (!q) return active
  return active.filter((d) => {
    const blob = [d.name, d.phone, d.email, d.status, d.notes, d.vehicleType].join(' ').toLowerCase()
    return blob.includes(q)
  })
}
