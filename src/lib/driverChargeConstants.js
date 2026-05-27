import { normalizeDriverChargeStatus } from './driverChargeStatus'

/** @typedef {'deallocation'|'cancellation'|'damage'|'no_show'|'late_arrival'|'customer_complaint'|'admin_adjustment'|'other'} DriverChargeType */

/** @typedef {'pending'|'paid'|'not_paid'|'removed'} DriverChargeStatus */

export const DRIVER_CHARGE_TYPES = [
  { value: 'deallocation', label: 'Deallocation charge' },
  { value: 'cancellation', label: 'Cancellation charge' },
  { value: 'damage', label: 'Damage charge' },
  { value: 'no_show', label: 'No-show charge' },
  { value: 'late_arrival', label: 'Late arrival charge' },
  { value: 'customer_complaint', label: 'Customer complaint charge' },
  { value: 'admin_adjustment', label: 'Admin adjustment' },
  { value: 'other', label: 'Other' },
]

export const DRIVER_CHARGE_STATUSES = [
  { value: 'pending', label: 'Pending', tone: 'amber' },
  { value: 'not_paid', label: 'Not paid', tone: 'rose' },
  { value: 'paid', label: 'Paid', tone: 'emerald' },
  { value: 'removed', label: 'Removed', tone: 'slate' },
]

/** Statuses that reduce net driver payout. */
export const DRIVER_CHARGE_DEDUCTIBLE_STATUSES = new Set(['pending', 'not_paid'])

/**
 * @param {unknown} type
 */
export function driverChargeTypeLabel(type) {
  const hit = DRIVER_CHARGE_TYPES.find((t) => t.value === String(type || ''))
  return hit?.label || String(type || 'Charge')
}

/**
 * @param {unknown} status
 */
export function driverChargeStatusMeta(status) {
  const s = normalizeDriverChargeStatus(status)
  const hit = DRIVER_CHARGE_STATUSES.find((x) => x.value === s)
  return hit || { value: s, label: s, tone: 'slate' }
}

/**
 * @param {unknown} status
 */
export function isDriverChargeDeductible(status) {
  return DRIVER_CHARGE_DEDUCTIBLE_STATUSES.has(normalizeDriverChargeStatus(status))
}
