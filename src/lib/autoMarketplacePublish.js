import { quotePassesAvailableJobsStrict, quoteHasAssignedDriver, quoteIsCardPaid } from './adminJobListRules'
import { isQuoteDemoOrTest } from './demoTestRecordDetection'
import {
  loadAvailableJobAdminOverrides,
  saveAvailableJobAdminOverrides,
} from './availableJobLocalStore'
import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { loadMarketplacePricingDefaults } from './marketplacePricingDefaultsStore'
import { quoteCustomerTotalGbp } from './marketplaceQuoteFinance'
import { publishQuoteToMarketplace } from './marketplacePublishQuote'
import { estimatePayoutFromDefaultMargin } from './platformPayoutDefaults'
import { updateQuoteWorkflowAssignmentSilent } from './data/quotesAdminRepository'

const DELAY_OPTIONS = [5, 10, 15, 30]

/** @param {Record<string, unknown>} q */
export function isQuoteHeldFromAutoMarketplace(q) {
  if (!q || typeof q !== 'object') return false
  if (q.auto_marketplace_hold === true) return true
  const id = String(q.id || '').trim()
  if (id) {
    const local = loadAvailableJobAdminOverrides(id)
    if (local.autoMarketplaceHold === true) return true
  }
  return false
}

/** @param {Record<string, unknown>} q */
function hasValidAddresses(q) {
  const pickup = String(q.pickup_address || '').trim()
  const delivery = String(q.delivery_address || '').trim()
  return pickup.length >= 8 && delivery.length >= 8
}

/** @param {Record<string, unknown>} q */
function isQuoteBlockedOrHeld(q) {
  if (isQuoteHeldFromAutoMarketplace(q)) return true
  const ps = String(q.payout_status || '').toLowerCase()
  if (ps === 'held') return true
  const op = String(q.operational_status || mergedAdminWorkflowForQuote(q).operationalStatus || '')
    .trim()
    .toLowerCase()
  if (op.includes('hold') || op.includes('blocked')) return true
  return false
}

/** @param {Record<string, unknown>} q */
function isSameDayUrgent(q) {
  const move = q.move_date ? String(q.move_date).slice(0, 10) : ''
  if (!move) return false
  const today = new Date().toISOString().slice(0, 10)
  if (move !== today) return false
  const blob = `${String(q.details || '')}\n${String(q.message || '')}`.toLowerCase()
  return /\burgent\b|\basap\b|same\s*-?\s*day|today\b|immediate/i.test(blob)
}

/**
 * @param {Record<string, unknown>} q
 * @param {import('./marketplacePricingDefaultsStore.js').MarketplacePricingDefaults['autoMarketplace']} settings
 */
export function isQuoteEligibleForAutoMarketplace(q, settings) {
  if (!settings?.enabled) return false
  if (!quotePassesAvailableJobsStrict(q)) return false
  if (isQuoteDemoOrTest(q)) return false
  if (!quoteIsCardPaid(q)) return false
  if (quoteHasAssignedDriver(q)) return false
  if (isQuoteBlockedOrHeld(q)) return false
  if (!hasValidAddresses(q)) return false

  const ps = String(q.payment_status || '').toLowerCase()
  if (ps !== 'paid' && ps !== 'deposit_paid') return false
  if (ps === 'failed' || ps === 'unpaid') return false

  const customerTotal = quoteCustomerTotalGbp(q)
  if (settings.minJobValueGbp != null && customerTotal != null) {
    if (customerTotal < settings.minJobValueGbp) return false
  }

  if (settings.maxDistanceMiles != null) {
    const miles = Number(q.distance_miles)
    if (Number.isFinite(miles) && miles > settings.maxDistanceMiles) return false
  }

  if (settings.serviceFilters?.length > 0) {
    const svc = `${String(q.service || '')} ${String(q.service_type || '')}`.toLowerCase()
    const hit = settings.serviceFilters.some((f) => svc.includes(String(f).toLowerCase()))
    if (!hit) return false
  }

  if (settings.excludeSameDayUrgent && isSameDayUrgent(q)) return false

  return true
}

/**
 * @param {Record<string, unknown>} q
 * @param {import('./marketplacePricingDefaultsStore.js').MarketplacePricingDefaults} defs
 * @returns {{ label: string, tone: string } | null}
 */
export function getAutoMarketplaceCardBadge(q, defs = loadMarketplacePricingDefaults()) {
  const settings = defs.autoMarketplace
  if (!settings.enabled) return null

  if (q.auto_marketplace_sent_at) {
    return { label: 'Auto-sent to Marketplace', tone: 'violet' }
  }

  const mv = mergedAdminWorkflowForQuote(q).marketplaceVisibility
  if (mv === 'visible_in_marketplace' && q.auto_marketplace_sent_at) {
    return { label: 'Auto-sent to Marketplace', tone: 'violet' }
  }

  if (isQuoteHeldFromAutoMarketplace(q)) {
    return { label: 'Auto-marketplace held', tone: 'slate' }
  }

  if (!isQuoteEligibleForAutoMarketplace(q, settings)) return null

  const eligibleAt = q.auto_marketplace_eligible_at
  if (!eligibleAt) {
    return { label: 'Auto-marketplace pending', tone: 'amber' }
  }

  const publishAt =
    new Date(String(eligibleAt)).getTime() + settings.delayMinutes * 60 * 1000
  const remaining = publishAt - Date.now()
  if (remaining > 0) {
    const mins = Math.max(1, Math.ceil(remaining / 60000))
    return { label: `Auto-marketplace in ${mins} min`, tone: 'amber' }
  }

  return { label: 'Auto-marketplace pending', tone: 'amber' }
}

/**
 * Stamp eligible timestamp when job first becomes eligible.
 * @param {Record<string, unknown>} q
 */
export async function ensureAutoMarketplaceEligibleTimestamp(q) {
  const id = String(q?.id || '').trim()
  if (!id || q.auto_marketplace_eligible_at) return

  const defs = loadMarketplacePricingDefaults()
  if (!isQuoteEligibleForAutoMarketplace(q, defs.autoMarketplace)) return

  const ts = new Date().toISOString()
  await updateQuoteWorkflowAssignmentSilent(id, { auto_marketplace_eligible_at: ts })
}

/**
 * @param {string} quoteId
 * @param {boolean} hold
 */
export async function setAutoMarketplaceHold(quoteId, hold) {
  const id = String(quoteId || '').trim()
  if (!id) return

  saveAvailableJobAdminOverrides(id, { autoMarketplaceHold: Boolean(hold) })

  await updateQuoteWorkflowAssignmentSilent(id, { auto_marketplace_hold: Boolean(hold) })
}

/**
 * @param {Record<string, unknown>[]} quotes
 * @returns {Promise<{ published: number, stamped: number }>}
 */
export async function runAutoMarketplaceTick(quotes) {
  const defs = loadMarketplacePricingDefaults()
  const settings = defs.autoMarketplace
  if (!settings.enabled) return { published: 0, stamped: 0 }

  let published = 0
  let stamped = 0
  const now = Date.now()
  const delayMs = settings.delayMinutes * 60 * 1000

  for (const q of quotes) {
    if (!isQuoteEligibleForAutoMarketplace(q, settings)) continue

    if (!q.auto_marketplace_eligible_at) {
      await ensureAutoMarketplaceEligibleTimestamp(q)
      stamped += 1
      continue
    }

    const publishAt = new Date(String(q.auto_marketplace_eligible_at)).getTime() + delayMs
    if (now < publishAt) continue

    const id = String(q.id || '').trim()
    if (!id) continue

    const est = estimatePayoutFromDefaultMargin(q)
    const payoutNote =
      est?.driverPayout != null
        ? `Payout estimate £${est.driverPayout.toFixed(2)} (margin ${est.platformMarginPercent}%).`
        : ''

    const result = await publishQuoteToMarketplace(id, q, {
      autoSent: true,
      logMessage: `Auto-sent to Marketplace by system. ${payoutNote}`.trim(),
    })
    if (result.ok) published += 1
  }

  return { published, stamped }
}

export { DELAY_OPTIONS }
