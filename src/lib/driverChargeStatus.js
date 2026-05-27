/** @typedef {'pending'|'paid'|'not_paid'|'removed'} DriverChargeStatusCanonical */

export const DRIVER_CHARGE_FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'paid', label: 'Paid' },
  { id: 'not_paid', label: 'Not paid' },
  { id: 'removed', label: 'Removed' },
]

/**
 * Normalize legacy DB statuses to canonical admin statuses.
 * @param {unknown} status
 * @returns {DriverChargeStatusCanonical}
 */
export function normalizeDriverChargeStatus(status) {
  const s = String(status || 'pending').toLowerCase()
  if (s === 'applied' || s === 'disputed') return 'not_paid'
  if (s === 'waived' || s === 'cancelled') return 'removed'
  if (s === 'paid' || s === 'not_paid' || s === 'pending' || s === 'removed') return s
  return 'pending'
}

/**
 * @param {unknown} status
 */
export function isDriverChargeStatusRemoved(status) {
  return normalizeDriverChargeStatus(status) === 'removed'
}

/**
 * @param {{ status?: unknown }} charge
 * @param {string} filterId
 */
export function driverChargeMatchesFilter(charge, filterId) {
  const f = String(filterId || 'all')
  if (f === 'all') return true
  return normalizeDriverChargeStatus(charge?.status) === f
}
