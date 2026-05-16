import {
  quoteHasAssignedDriver,
  quoteHasAssignedPartner,
  quoteIsBookedOrPaid,
  quotePassesAvailableJobsStrict,
  quotePassesMarketplaceStrict,
} from './adminJobListRules'
import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'

/**
 * @typedef {{ label: string, tone: string }} AdminWarningBadge
 */

/** @param {string | null | undefined} moveDate */
export function extractMoveYmd(moveDate) {
  if (moveDate == null || moveDate === '') return null
  const day = String(moveDate).split('T')[0].trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return day
}

/** @param {Date} d */
function localYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** @param {string} ymd @param {number} deltaDays */
function addDaysYmd(ymd, deltaDays) {
  const [y, mo, da] = ymd.split('-').map(Number)
  const dt = new Date(y, mo - 1, da + deltaDays)
  return localYmd(dt)
}

/** @param {string} t */
function parseExactHm(t) {
  const s = String(t || '').trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null
  return { h, min }
}

/** @param {string} windowStr */
function parseWindowEndHm(windowStr) {
  const s = String(windowStr || '')
  const times = [...s.matchAll(/(\d{1,2}):(\d{2})/g)]
  if (times.length >= 2) {
    const last = times[times.length - 1]
    return { h: Number(last[1]), min: Number(last[2]) }
  }
  return null
}

/**
 * Latest instant on the move calendar day (for overdue / same-day checks).
 * @param {Record<string, unknown>} q
 * @returns {number | null} epoch ms
 */
export function quoteMoveDeadlineMs(q) {
  const ymd = extractMoveYmd(q.move_date)
  if (!ymd) return null
  const [y, m, d] = ymd.split('-').map(Number)
  if (q.arrival_type === 'exact' && q.arrival_time) {
    const hm = parseExactHm(q.arrival_time)
    if (hm) return new Date(y, m - 1, d, hm.h, hm.min, 59).getTime()
  }
  if (q.arrival_window) {
    const hm = parseWindowEndHm(String(q.arrival_window))
    if (hm) return new Date(y, m - 1, d, hm.h, hm.min, 59).getTime()
  }
  return new Date(y, m - 1, d, 23, 59, 59).getTime()
}

/** @param {Record<string, unknown>} q */
function notInMarketplaceForWarnings(q) {
  const mv = mergedAdminWorkflowForQuote(q).marketplaceVisibility
  return mv !== 'visible_in_marketplace' && mv !== 'assigned'
}

/** @param {Record<string, unknown>} q */
function unassignedNoDriverPartner(q) {
  return !quoteHasAssignedDriver(q) && !quoteHasAssignedPartner(q)
}

/**
 * @param {Record<string, unknown>} q
 * @returns {AdminWarningBadge[]}
 */
export function getAvailableJobWarningBadges(q) {
  if (!quotePassesAvailableJobsStrict(q)) return []
  const now = Date.now()
  const todayYmd = localYmd(new Date())
  const moveYmd = extractMoveYmd(q.move_date)
  const tomorrowYmd = addDaysYmd(todayYmd, 1)
  const deadlineMs = quoteMoveDeadlineMs(q)
  const mv = mergedAdminWorkflowForQuote(q).marketplaceVisibility
  const bookedPaid = quoteIsBookedOrPaid(q)
  const unassigned = unassignedNoDriverPartner(q)
  const notMkt = notInMarketplaceForWarnings(q)

  /** @type {AdminWarningBadge[]} */
  const out = []

  const overdue =
    unassigned &&
    notMkt &&
    deadlineMs != null &&
    Number.isFinite(deadlineMs) &&
    deadlineMs < now &&
    bookedPaid
  const unassignedToday =
    moveYmd != null &&
    moveYmd === todayYmd &&
    unassigned &&
    notMkt &&
    bookedPaid
  if (overdue) out.push({ label: 'Overdue unassigned', tone: 'red' })
  else if (unassignedToday) out.push({ label: 'Unassigned today', tone: 'red' })

  const tomorrowNoDriver =
    moveYmd != null &&
    moveYmd === tomorrowYmd &&
    unassigned &&
    notMkt &&
    bookedPaid
  if (tomorrowNoDriver) out.push({ label: 'Tomorrow — no driver', tone: 'amber' })

  const noDriverPath =
    bookedPaid &&
    unassigned &&
    mv !== 'visible_in_marketplace' &&
    mv !== 'assigned' &&
    !overdue &&
    !unassignedToday &&
    !tomorrowNoDriver
  if (noDriverPath) out.push({ label: 'No driver assigned', tone: 'amber' })

  const ps = String(q.payment_status ?? '').trim().toLowerCase()
  const st = String(q.status ?? '').trim()
  const ready = (ps === 'paid' || st === 'Booked') && unassigned && notMkt
  if (ready) out.push({ label: 'Ready for dispatch', tone: 'sky' })

  return out
}

/**
 * Sort tier: lower = higher priority in list (red / urgent first).
 * @param {Record<string, unknown>} q
 */
export function availableJobWarningSortTier(q) {
  if (!quotePassesAvailableJobsStrict(q)) return 99
  const now = Date.now()
  const todayYmd = localYmd(new Date())
  const moveYmd = extractMoveYmd(q.move_date)
  const tomorrowYmd = addDaysYmd(todayYmd, 1)
  const deadlineMs = quoteMoveDeadlineMs(q)
  const bookedPaid = quoteIsBookedOrPaid(q)
  const unassigned = unassignedNoDriverPartner(q)
  const notMkt = notInMarketplaceForWarnings(q)

  const overdue =
    unassigned &&
    notMkt &&
    deadlineMs != null &&
    Number.isFinite(deadlineMs) &&
    deadlineMs < now &&
    bookedPaid
  if (overdue) return 0

  const unassignedToday =
    moveYmd != null && moveYmd === todayYmd && unassigned && notMkt && bookedPaid
  if (unassignedToday) return 1

  if (moveYmd != null && moveYmd === tomorrowYmd && unassigned && notMkt && bookedPaid) return 2

  const badges = getAvailableJobWarningBadges(q)
  if (badges.some((b) => b.tone === 'amber' || b.tone === 'sky')) return 3
  return 4
}

/** @param {Record<string, unknown>} q */
function quoteCreatedMs(q) {
  const t = q.created_at ? new Date(String(q.created_at)).getTime() : 0
  return Number.isFinite(t) ? t : 0
}

/** @param {Record<string, unknown>} a @param {Record<string, unknown>} b */
export function compareAvailableJobsAdmin(a, b) {
  const ta = availableJobWarningSortTier(a)
  const tb = availableJobWarningSortTier(b)
  if (ta !== tb) return ta - tb
  return quoteCreatedMs(b) - quoteCreatedMs(a)
}

/**
 * @param {Record<string, unknown>} q
 * @returns {AdminWarningBadge[]}
 */
export function getMarketplaceJobWarningBadges(q) {
  if (!quotePassesMarketplaceStrict(q)) return []
  const now = Date.now()
  const todayYmd = localYmd(new Date())
  const moveYmd = extractMoveYmd(q.move_date)
  const tomorrowYmd = addDaysYmd(todayYmd, 1)
  const deadlineMs = quoteMoveDeadlineMs(q)
  const unassigned = unassignedNoDriverPartner(q)

  /** @type {AdminWarningBadge[]} */
  const out = []

  const overdueMkt =
    unassigned &&
    deadlineMs != null &&
    Number.isFinite(deadlineMs) &&
    deadlineMs < now
  if (overdueMkt) out.push({ label: 'Marketplace overdue', tone: 'red' })
  else if (unassigned) out.push({ label: 'Not accepted yet', tone: 'red' })

  if (moveYmd != null && moveYmd === tomorrowYmd && unassigned && !overdueMkt) {
    out.push({ label: 'Tomorrow — still open', tone: 'amber' })
  }

  out.push({ label: 'Visible to marketplace', tone: 'sky' })
  return out
}

/** @param {Record<string, unknown>} q */
export function marketplaceJobWarningSortTier(q) {
  if (!quotePassesMarketplaceStrict(q)) return 99
  const now = Date.now()
  const todayYmd = localYmd(new Date())
  const moveYmd = extractMoveYmd(q.move_date)
  const tomorrowYmd = addDaysYmd(todayYmd, 1)
  const deadlineMs = quoteMoveDeadlineMs(q)
  const unassigned = unassignedNoDriverPartner(q)

  if (unassigned && deadlineMs != null && Number.isFinite(deadlineMs) && deadlineMs < now) return 0
  if (unassigned && moveYmd === tomorrowYmd) return 1
  if (unassigned) return 2
  return 3
}

/** @param {Record<string, unknown>} a @param {Record<string, unknown>} b */
export function compareMarketplaceJobsAdmin(a, b) {
  const ta = marketplaceJobWarningSortTier(a)
  const tb = marketplaceJobWarningSortTier(b)
  if (ta !== tb) return ta - tb
  return quoteCreatedMs(b) - quoteCreatedMs(a)
}
