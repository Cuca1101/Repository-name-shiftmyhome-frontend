const STORAGE_KEY = 'smh_admin_available_job_v1'

/**
 * @typedef {{ id: string, description: string, amountGbp: number, createdAt: string, status?: 'pending'|'paid' }} AvailableJobAdjustment
 */

/**
 * @typedef {{
 *   marketplaceVisibility: 'hidden_from_partners'|'visible_in_marketplace'|'assigned'|'completed'|'cancelled',
 *   marketplacePayoutGbp: number | null,
 *   revealCustomerTotalToPartners: boolean,
 *   internalNotes: string,
 *   assignedDriver: string,
 *   assignedPartnerCompany: string,
 *   adjustments: AvailableJobAdjustment[],
 *   partnerAcceptanceStatus: string,
 *   operationalStatus: string,
 *   podUploaded: boolean,
 *   cancellationReason: string,
 *   cancelledBy: string,
 *   refundStatus: string,
 *   adminNotesLog: string,
 *   adminCompletionNote: string,
 *   adminCancellationReason: string,
 *   workflowCompletedAt: string,
 *   workflowCancelledAt: string,
 *   marketplacePayoutManualOverride?: boolean,
 *   marketplaceDeductionSnapshot?: { type: 'percentage' | 'fixed', value: number } | null,
 *   partnerDashboardHidden?: boolean,
 * }} AvailableJobAdminOverrides
 */

function defaultOverrides() {
  return {
    marketplaceVisibility: 'hidden_from_partners',
    marketplacePayoutGbp: null,
    revealCustomerTotalToPartners: false,
    internalNotes: '',
    assignedDriver: '',
    assignedPartnerCompany: '',
    adjustments: [],
    /** @type {string} partner pipeline — UI only until API exists */
    partnerAcceptanceStatus: '',
    /** @type {string} e.g. On the way — UI only */
    operationalStatus: '',
    /** @type {boolean} */
    podUploaded: false,
    cancellationReason: '',
    cancelledBy: '',
    refundStatus: '',
    adminNotesLog: '',
    adminCompletionNote: '',
    adminCancellationReason: '',
    workflowCompletedAt: '',
    workflowCancelledAt: '',
    marketplacePayoutManualOverride: false,
    marketplaceDeductionSnapshot: null,
    /** When true, job stays in admin Marketplace but is hidden from the future Partner Dashboard. */
    partnerDashboardHidden: false,
  }
}

function readAll() {
  if (typeof sessionStorage === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(all) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* ignore quota */
  }
}

/** @param {string} quoteId */
export function loadAvailableJobAdminOverrides(quoteId) {
  const id = String(quoteId || '').trim()
  if (!id) return defaultOverrides()
  const all = readAll()
  const cur = all[id]
  if (!cur || typeof cur !== 'object') return defaultOverrides()
  return { ...defaultOverrides(), ...cur, adjustments: Array.isArray(cur.adjustments) ? cur.adjustments : [] }
}

/**
 * @param {string} quoteId
 * @param {Partial<AvailableJobAdminOverrides>} patch
 */
export function saveAvailableJobAdminOverrides(quoteId, patch) {
  const id = String(quoteId || '').trim()
  if (!id) return
  const all = readAll()
  const next = { ...loadAvailableJobAdminOverrides(id), ...patch }
  all[id] = next
  writeAll(all)
}
