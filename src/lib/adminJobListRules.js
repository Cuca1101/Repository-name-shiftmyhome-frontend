import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { quoteVisibleInAdminLists } from './adminProductionFilters'
import {
  ADMIN_PHONE_BOOKING_SOURCE,
  LEGACY_ADMIN_PHONE_BOOKING_SOURCE,
  PHONE_BOOKING_PENDING_OPERATIONAL_STATUS,
} from './data/quotesRepository'

/**
 * Admin job inbox rules (quotes row + merged session when DB columns absent).
 * Used for Available Jobs, Marketplace, and Active lists — not public booking.
 */

/** @param {Record<string, unknown>} q */
export function quoteHasAssignedDriver(q) {
  const id = q?.assigned_driver_id
  if (id != null && String(id).trim() !== '') return true
  const nm = q?.assigned_driver_name
  if (nm != null && String(nm).trim() !== '') return true
  if (typeof q?.marketplace_visibility === 'string') return false
  return (mergedAdminWorkflowForQuote(q).assignedDriver || '').trim().length > 0
}

/** @param {Record<string, unknown>} q */
export function quoteHasAssignedPartner(q) {
  const id = q?.assigned_partner_id
  if (id != null && String(id).trim() !== '') return true
  const co = q?.assigned_partner_company
  if (co != null && String(co).trim() !== '') return true
  if (typeof q?.marketplace_visibility === 'string') return false
  return (mergedAdminWorkflowForQuote(q).assignedPartnerCompany || '').trim().length > 0
}

/** @param {Record<string, unknown>} q */
export function quoteIsCardPaid(q) {
  const ps = String(q.payment_status ?? '').trim().toLowerCase()
  return ps === 'paid' || ps === 'deposit_paid'
}

/** Staff phone booking (any stage). */
export function quoteIsAdminPhoneBooking(q) {
  const src = String(q?.source ?? '').trim()
  return src === ADMIN_PHONE_BOOKING_SOURCE || src === LEGACY_ADMIN_PHONE_BOOKING_SOURCE
}

/** Still on New phone booking — not yet sent to Available Jobs. */
export function quoteIsAdminPhoneBookingPending(q) {
  if (!quoteIsAdminPhoneBooking(q)) return false
  const op = String(q?.operational_status ?? '')
    .trim()
    .toLowerCase()
  return op === PHONE_BOOKING_PENDING_OPERATIONAL_STATUS
}

/** Released to Available Jobs (legacy rows without pending flag count as released). */
export function quoteIsAdminPhoneBookingReleased(q) {
  return quoteIsAdminPhoneBooking(q) && !quoteIsAdminPhoneBookingPending(q)
}

/**
 * Shown on Admin → New phone booking (staging inbox).
 * Includes explicit pending flag and legacy phone bookings not yet in Available Jobs.
 * @param {Record<string, unknown>} q
 */
export function quoteShowsOnNewPhoneBookingInbox(q) {
  if (!quoteIsAdminPhoneBooking(q)) return false
  if (quoteIsAdminPhoneBookingPending(q)) return true
  if (quotePassesAvailableJobsStrict(q)) return false
  const op = String(q?.operational_status ?? '').trim().toLowerCase()
  if (op && op !== '') return false
  return true
}

/** @param {Record<string, unknown>} q */
export function quoteIsAvailableJobsPayment(q) {
  return quoteIsCardPaid(q) || quoteIsAdminPhoneBookingReleased(q)
}

/**
 * Legacy helper — includes CRM `status = Booked` without card payment.
 * Do not use for Available Jobs inbox rules.
 * @param {Record<string, unknown>} q
 */
export function quoteIsBookedOrPaid(q) {
  if (quoteIsCardPaid(q)) return true
  const st = String(q.status ?? '').trim()
  return st === 'Booked'
}

/** @param {Record<string, unknown>} q */
export function quoteOperationalStatusLower(q) {
  return (mergedAdminWorkflowForQuote(q).operationalStatus || '').trim().toLowerCase()
}

const IN_PROGRESS_WORKFLOW_STATUSES = new Set([
  'on_way',
  'on way',
  'arrived',
  'in_transit',
  'in transit',
  'in_progress',
  'in progress',
  'pickup_completed',
  'loaded',
  'assigned',
  'accepted',
  'active',
])

/**
 * Driver/mobile workflow still running (ignore stale completed_at from an earlier mistaken complete).
 * @param {Record<string, unknown>} q
 */
export function quoteHasInProgressWorkflowStatus(q) {
  const st = String(q?.status ?? '')
    .trim()
    .toLowerCase()
  if (IN_PROGRESS_WORKFLOW_STATUSES.has(st)) return true
  const op = quoteOperationalStatusLower(q)
  if (IN_PROGRESS_WORKFLOW_STATUSES.has(op)) return true
  return false
}

/**
 * Available Jobs inbox: card-paid only, unassigned, not on marketplace, not terminal.
 * @param {Record<string, unknown>} q
 */
export function quotePassesAvailableJobsStrict(q) {
  if (!quoteVisibleInAdminLists(q)) return false
  if (q?.bundled_journey_id != null && String(q.bundled_journey_id).trim() !== '') return false
  if (!quoteIsAvailableJobsPayment(q)) return false
  const st = String(q.status ?? '').trim()
  if (st === 'Completed' || st === 'Cancelled') return false
  if (q.completed_at) return false
  if (q.cancelled_at) return false
  const op = quoteOperationalStatusLower(q)
  if (op === 'completed' || op === 'cancelled') return false
  if (quoteHasAssignedDriver(q) || quoteHasAssignedPartner(q)) return false
  const mv = mergedAdminWorkflowForQuote(q).marketplaceVisibility
  if (mv === 'visible_in_marketplace' || mv === 'assigned') return false
  if (mv === 'completed' || mv === 'cancelled') return false
  return true
}

/**
 * Marketplace inbox: visible to partners, still unclaimed, not terminal.
 * @param {Record<string, unknown>} q
 */
export function quotePassesMarketplaceStrict(q) {
  if (!quoteVisibleInAdminLists(q)) return false
  if (q?.bundled_journey_id != null && String(q.bundled_journey_id).trim() !== '') return false
  const mv = mergedAdminWorkflowForQuote(q).marketplaceVisibility
  if (mv !== 'visible_in_marketplace') return false
  const st = String(q.status ?? '').trim()
  if (st === 'Completed' || st === 'Cancelled') return false
  if (q.completed_at) return false
  if (q.cancelled_at) return false
  const op = quoteOperationalStatusLower(q)
  if (op === 'completed' || op === 'cancelled') return false
  if (quoteHasAssignedDriver(q) || quoteHasAssignedPartner(q)) return false
  return true
}

/**
 * Marketplace job accepted by partner (visibility assigned) — counts as Active even before driver name is set.
 * @param {Record<string, unknown>} q
 */
export function quoteMarketplaceJobAccepted(q) {
  return mergedAdminWorkflowForQuote(q).marketplaceVisibility === 'assigned'
}

/**
 * Marketplace inbox for bundled multi-job journeys (journey row, not quotes).
 * @param {Record<string, unknown>} j
 */
export function journeyPassesMarketplaceStrict(j) {
  if (!j || typeof j !== 'object') return false
  if (String(j.marketplace_visibility) !== 'visible_in_marketplace') return false
  const st = String(j.status ?? '').trim()
  if (st === 'completed' || st === 'cancelled') return false
  if (j.assigned_partner_id != null && String(j.assigned_partner_id).trim() !== '') return false
  if (j.assigned_driver_id != null && String(j.assigned_driver_id).trim() !== '') return false
  return true
}

/**
 * Active inbox: driver/partner assigned OR marketplace accepted, not terminal.
 * @param {Record<string, unknown>} q
 */
export function quotePassesActiveStrict(q) {
  if (!quoteVisibleInAdminLists(q)) return false
  const assigned =
    quoteHasAssignedDriver(q) || quoteHasAssignedPartner(q) || quoteMarketplaceJobAccepted(q)
  if (!assigned) return false
  const stLower = String(q.status ?? '')
    .trim()
    .toLowerCase()
  if (stLower === 'completed' || stLower === 'cancelled') return false
  const st = String(q.status ?? '').trim()
  if (st === 'Completed' || st === 'Cancelled') return false
  if (q.completed_at && !quoteHasInProgressWorkflowStatus(q)) return false
  if (q.cancelled_at) return false
  const op = quoteOperationalStatusLower(q)
  if (op === 'completed' || op === 'cancelled') return false
  return true
}
