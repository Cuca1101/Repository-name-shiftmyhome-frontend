/**
 * Map driver-app workflow status → quotes.operational_status (+ completion timestamps).
 * @param {string} driverStatus
 * @param {string} [isoNow]
 * @returns {Record<string, unknown>}
 */
export function quotePatchFromDriverStatus(driverStatus, isoNow = new Date().toISOString()) {
  const s = String(driverStatus || '').trim()
  if (s === 'Completed') {
    return {
      operational_status: 'Completed',
      completed_at: isoNow,
      marketplace_visibility: 'assigned',
    }
  }
  if (s === 'Cancelled') {
    return {
      operational_status: 'Cancelled',
      cancelled_at: isoNow,
      marketplace_visibility: 'cancelled',
    }
  }
  if (s === 'Assigned' || s === 'Accepted') {
    return {
      operational_status: 'Assigned',
      marketplace_visibility: 'assigned',
      completed_at: null,
      cancelled_at: null,
    }
  }
  return {
    operational_status: s || 'Assigned',
    marketplace_visibility: 'assigned',
  }
}

/**
 * Initial assignment from admin.
 * @returns {Record<string, unknown>}
 */
export function quotePatchForAdminDriverAssign() {
  return {
    operational_status: 'Assigned',
    marketplace_visibility: 'assigned',
    completed_at: null,
    cancelled_at: null,
  }
}
