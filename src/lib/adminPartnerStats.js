import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { findLinkedJobForQuote, quoteIsActive, quoteIsCancelled, quoteIsCompleted } from './adminWorkflowFilters'

/**
 * @param {string} companyName
 * @param {Record<string, unknown>[]} quotes
 */
export function countPartnerAssignedJobs(companyName, quotes) {
  const c = companyName.trim().toLowerCase()
  if (!c) return 0
  let n = 0
  for (const q of quotes) {
    const o = mergedAdminWorkflowForQuote(q)
    if ((o.assignedPartnerCompany || '').trim().toLowerCase() === c) n += 1
  }
  return n
}

/**
 * @param {string} companyName
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, unknown>[]} jobs
 */
export function countPartnerActiveJobs(companyName, quotes, jobs) {
  const c = companyName.trim().toLowerCase()
  if (!c) return 0
  let n = 0
  for (const q of quotes) {
    const o = mergedAdminWorkflowForQuote(q)
    if ((o.assignedPartnerCompany || '').trim().toLowerCase() !== c) continue
    const job = findLinkedJobForQuote(q, jobs)
    if (quoteIsCancelled(q, job) || quoteIsCompleted(q, job)) continue
    if (quoteIsActive(q, job)) n += 1
  }
  return n
}

/**
 * @param {string} companyName
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, unknown>[]} jobs
 */
export function countPartnerCompletedJobs(companyName, quotes, jobs) {
  const c = companyName.trim().toLowerCase()
  if (!c) return 0
  let n = 0
  for (const q of quotes) {
    const o = mergedAdminWorkflowForQuote(q)
    if ((o.assignedPartnerCompany || '').trim().toLowerCase() !== c) continue
    const job = findLinkedJobForQuote(q, jobs)
    if (quoteIsCompleted(q, job)) n += 1
  }
  return n
}

/**
 * @param {string} partnerId
 * @param {{ partnerId?: string }[]} drivers
 */
export function countDriversForPartner(partnerId, drivers) {
  const id = String(partnerId || '').trim()
  if (!id) return 0
  return drivers.filter((d) => String(d.partnerId || '').trim() === id).length
}
