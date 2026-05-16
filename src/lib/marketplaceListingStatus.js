import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'

const PIPELINE_LABELS = {
  hidden_from_partners: 'Not listed on marketplace',
  assigned: 'Assigned (marketplace)',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

/**
 * Read-only summary for admin Job Details (partner dashboard + acceptance when listed).
 * @param {Record<string, unknown>} q
 */
export function formatMarketplaceStatusSummary(q) {
  const m = mergedAdminWorkflowForQuote(q)
  const mv = m.marketplaceVisibility
  if (mv !== 'visible_in_marketplace') {
    return PIPELINE_LABELS[mv] || mv || '—'
  }
  const listing = m.partnerDashboardHidden ? 'Hidden from partners' : 'Visible to partners'
  const assigned = (m.assignedDriver || '').trim() || (m.assignedPartnerCompany || '').trim()
  const accept = assigned ? 'Accepted' : 'Not accepted yet'
  return `${listing} · ${accept}`
}

/**
 * @param {Record<string, unknown>} q
 */
export function partnerAcceptanceLabelForMarketplaceCard(q) {
  const m = mergedAdminWorkflowForQuote(q)
  if (m.marketplaceVisibility !== 'visible_in_marketplace') return null
  const assigned = (m.assignedDriver || '').trim() || (m.assignedPartnerCompany || '').trim()
  return assigned ? 'Accepted' : 'Not accepted yet'
}

/**
 * @param {Record<string, unknown>} q
 */
export function partnerListingLabelForMarketplaceCard(q) {
  const m = mergedAdminWorkflowForQuote(q)
  if (m.marketplaceVisibility !== 'visible_in_marketplace') return null
  return m.partnerDashboardHidden ? 'Hidden from partners' : 'Visible to partners'
}
