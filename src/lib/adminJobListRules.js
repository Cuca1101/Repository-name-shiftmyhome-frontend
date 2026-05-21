import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { isProductionAdmin } from './adminProductionMode'
import { shouldHideQuoteFromAdminInbox } from './demoTestRecordDetection'

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

/**
 * Available Jobs inbox: card-paid only, unassigned, not on marketplace, not terminal.
 * @param {Record<string, unknown>} q
 */
export function quotePassesAvailableJobsStrict(q) {
  if (isProductionAdmin() && shouldHideQuoteFromAdminInbox(q)) return false
  if (q?.bundled_journey_id != null && String(q.bundled_journey_id).trim() !== '') return false
  if (!quoteIsCardPaid(q)) return false
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
  const assigned =
    quoteHasAssignedDriver(q) || quoteHasAssignedPartner(q) || quoteMarketplaceJobAccepted(q)
  if (!assigned) return false
  const st = String(q.status ?? '').trim()
  if (st === 'Completed' || st === 'Cancelled') return false
  if (q.completed_at) return false
  if (q.cancelled_at) return false
  const op = quoteOperationalStatusLower(q)
  if (op === 'completed' || op === 'cancelled') return false
  return true
}
