import { isPublicQuoteRequestRow } from './data/quotesAdminRepository'
import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { quoteVisibleInAdminLists } from './adminProductionFilters'
import {
  quoteHasAssignedDriver,
  quoteHasAssignedPartner,
  quoteHasInProgressWorkflowStatus,
  quoteIsAdminPhoneBookingReleased,
  quoteIsCardPaid,
  quoteMarketplaceJobAccepted,
  quotePassesActiveStrict,
  quotePassesAvailableJobsStrict,
  quotePassesMarketplaceStrict,
} from './adminJobListRules'

/** @typedef {'available'|'marketplace'|'active'|'journey'|'completed'|'cancelled'|'other_paid'|'unpaid'|'hidden'} AdminJobInboxPlacement */

/**
 * @param {Record<string, unknown>} q
 * @returns {boolean}
 */
export function quoteIsTerminalForAdmin(q) {
  const st = String(q?.status ?? '').trim()
  if (st === 'Completed' || st === 'Cancelled') return true
  if (q?.cancelled_at) return true
  const op = String(mergedAdminWorkflowForQuote(q).operationalStatus || '')
    .trim()
    .toLowerCase()
  if (op === 'cancelled') return true
  if (q?.completed_at && !quoteHasInProgressWorkflowStatus(q)) return true
  if (op === 'completed' && !quoteHasInProgressWorkflowStatus(q)) return true
  return false
}

/**
 * Paid booking still open in admin (not completed/cancelled).
 * @param {Record<string, unknown>} q
 */
export function quotePaidNotTerminal(q) {
  if (!quoteVisibleInAdminLists(q)) return false
  if (!quoteIsCardPaid(q)) return false
  return !quoteIsTerminalForAdmin(q)
}

/**
 * Where this paid job lives in admin — so nothing “vanishes” without a label.
 * @param {Record<string, unknown>} q
 * @returns {AdminJobInboxPlacement}
 */
export function getAdminJobInboxPlacement(q) {
  if (!quoteVisibleInAdminLists(q)) return 'hidden'
  if (!quoteIsCardPaid(q) && !quoteIsAdminPhoneBookingReleased(q)) return 'unpaid'
  if (quoteIsTerminalForAdmin(q)) {
    const st = String(q?.status ?? '').trim()
    if (st === 'Cancelled' || q?.cancelled_at) return 'cancelled'
    return 'completed'
  }
  if (q?.bundled_journey_id != null && String(q.bundled_journey_id).trim() !== '') {
    return 'journey'
  }
  if (quotePassesAvailableJobsStrict(q)) return 'available'
  if (quotePassesMarketplaceStrict(q)) return 'marketplace'
  if (quotePassesActiveStrict(q)) return 'active'
  const mv = mergedAdminWorkflowForQuote(q).marketplaceVisibility
  if (mv === 'visible_in_marketplace') return 'marketplace'
  if (mv === 'assigned' || quoteMarketplaceJobAccepted(q)) return 'active'
  if (quoteHasAssignedDriver(q) || quoteHasAssignedPartner(q)) return 'active'
  return 'other_paid'
}

/** @type {Record<AdminJobInboxPlacement, { label: string, tone: string, listVariant?: string }>} */
export const ADMIN_JOB_PLACEMENT_META = {
  available: { label: 'Needs assignment', tone: 'sky', listVariant: 'available' },
  marketplace: { label: 'On marketplace', tone: 'violet', listVariant: 'marketplace' },
  active: { label: 'Job accepted', tone: 'emerald', listVariant: 'active' },
  journey: { label: 'In journey', tone: 'indigo', listVariant: 'default' },
  completed: { label: 'Completed', tone: 'blue', listVariant: 'completed' },
  cancelled: { label: 'Cancelled', tone: 'red', listVariant: 'cancelled' },
  other_paid: { label: 'Needs review', tone: 'amber', listVariant: 'default' },
  unpaid: { label: 'Unpaid', tone: 'slate', listVariant: 'default' },
  hidden: { label: 'Hidden', tone: 'slate', listVariant: 'default' },
}

/**
 * @param {string} quoteId
 * @param {AdminJobInboxPlacement} placement
 */
export function adminJobDetailPath(quoteId, placement) {
  const id = encodeURIComponent(String(quoteId || '').trim())
  if (!id) return '/admin/available-jobs'
  if (placement === 'active' || placement === 'completed' || placement === 'cancelled') {
    return `/admin/active-jobs/${id}`
  }
  return `/admin/available-jobs/${id}`
}

/**
 * Best admin detail URL for any quote row (paid, unpaid, wizard, phone booking).
 * @param {Record<string, unknown>} q
 */
export function adminQuoteDetailHref(q) {
  const rawId = String(q?.id || '').trim()
  if (!rawId) return '/admin/all-quotes'
  const id = encodeURIComponent(rawId)
  const placement = getAdminJobInboxPlacement(q)
  if (placement === 'hidden') return '/admin/all-quotes'
  if (placement === 'unpaid' && isPublicQuoteRequestRow(q)) {
    return `/admin/quote-requests/${id}`
  }
  return adminJobDetailPath(rawId, placement === 'unpaid' ? 'available' : placement)
}

/**
 * @param {Record<string, unknown>[]} quotes
 * @param {string} inboxMode
 */
export function filterQuotesByAdminInboxMode(quotes, inboxMode) {
  const list = Array.isArray(quotes) ? quotes : []
  switch (inboxMode) {
    case 'needs_action':
      return list.filter(quotePassesAvailableJobsStrict)
    case 'marketplace':
      return list.filter(quotePassesMarketplaceStrict)
    case 'active':
      return list.filter(quotePassesActiveStrict)
    case 'journey':
      return list.filter(
        (q) =>
          q?.bundled_journey_id != null &&
          String(q.bundled_journey_id).trim() !== '' &&
          quotePaidNotTerminal(q),
      )
    case 'all_paid':
      return list.filter(quotePaidNotTerminal)
    default:
      return list.filter(quotePassesAvailableJobsStrict)
  }
}

/**
 * @param {Record<string, unknown>[]} quotes
 */
export function countAdminInboxPlacements(quotes) {
  /** @type {Record<string, number>} */
  const counts = {
    needs_action: 0,
    all_paid: 0,
    marketplace: 0,
    active: 0,
    journey: 0,
    other_paid: 0,
  }
  for (const q of quotes) {
    if (!quoteVisibleInAdminLists(q) || !quoteIsCardPaid(q)) continue
    if (quotePaidNotTerminal(q)) counts.all_paid += 1
    if (quotePassesAvailableJobsStrict(q)) counts.needs_action += 1
    if (quotePassesMarketplaceStrict(q)) counts.marketplace += 1
    if (quotePassesActiveStrict(q)) counts.active += 1
    if (q?.bundled_journey_id && quotePaidNotTerminal(q)) counts.journey += 1
    const place = getAdminJobInboxPlacement(q)
    if (place === 'other_paid') counts.other_paid += 1
  }
  return counts
}

/**
 * @param {Record<string, unknown>} q
 * @param {AdminJobInboxPlacement} placement
 */
export function formatJobDepartedMessage(q, placement) {
  const ref = String(q?.quote_ref || q?.id || 'Job').trim()
  const meta = ADMIN_JOB_PLACEMENT_META[placement] || { label: placement }
  return `${ref} moved to “${meta.label}”.`
}
