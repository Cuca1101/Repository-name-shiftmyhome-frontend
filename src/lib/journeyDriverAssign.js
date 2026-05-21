import { appendAdminNotesLog } from './adminNotesLog'
import { quoteHasAssignedPartner, quoteOperationalStatusLower } from './adminJobListRules'
import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import {
  fetchAssignedByActor,
  updateQuoteWorkflowAssignmentSilent,
} from './data/quotesAdminRepository'
import { syncJobAssignmentFromQuoteAssign } from './data/driverAssignmentSync'
import { updateJourneyRow } from './data/journeysRepository'

/**
 * Unique quote ids from stops + loaded quote rows.
 * @param {import('./journeyPlannerModel.js').JourneyStop[]} stops
 * @param {Record<string, unknown>[]} quotes
 */
export function journeyQuoteIdsFromStops(stops, quotes) {
  const ids = new Set()
  for (const s of stops || []) {
    const qid = String(s?.quoteId || '').trim()
    if (qid) ids.add(qid)
  }
  for (const q of quotes || []) {
    if (q?.id != null) ids.add(String(q.id))
  }
  return [...ids]
}

/**
 * @param {Record<string, unknown>} quote
 * @param {string} [targetDriverId]
 */
export function assessQuoteDriverAssignmentEligibility(quote, targetDriverId = '') {
  const id = quote?.id != null ? String(quote.id) : ''
  const ref = quote?.quote_ref != null ? String(quote.quote_ref) : id.slice(0, 8) || 'Job'

  if (!id) {
    return { eligible: false, reason: 'No linked job record', quoteId: '', quoteRef: ref }
  }

  const st = String(quote?.status ?? '').trim()
  if (st === 'Completed' || st === 'Cancelled' || quote?.completed_at || quote?.cancelled_at) {
    return { eligible: false, reason: 'Job is completed or cancelled', quoteId: id, quoteRef: ref }
  }

  const op = quoteOperationalStatusLower(quote)
  if (op === 'completed' || op === 'cancelled') {
    return { eligible: false, reason: 'Job is completed or cancelled', quoteId: id, quoteRef: ref }
  }

  if (quoteHasAssignedPartner(quote)) {
    const co = String(quote?.assigned_partner_company || '').trim() || 'partner'
    return { eligible: false, reason: `Partner assigned (${co})`, quoteId: id, quoteRef: ref }
  }

  const existingDriverId = quote?.assigned_driver_id != null ? String(quote.assigned_driver_id).trim() : ''
  const existingDriverName = String(quote?.assigned_driver_name || '').trim()
  const targetId = String(targetDriverId || '').trim()

  if (existingDriverId && targetId && existingDriverId === targetId) {
    return { eligible: false, reason: 'Already assigned to this driver', quoteId: id, quoteRef: ref }
  }

  if (existingDriverId || existingDriverName) {
    return {
      eligible: false,
      reason: `Already assigned to ${existingDriverName || 'another driver'}`,
      quoteId: id,
      quoteRef: ref,
    }
  }

  return { eligible: true, reason: '', quoteId: id, quoteRef: ref }
}

/**
 * @param {{
 *   journey: Record<string, unknown> | null,
 *   journeyId: string,
 *   quotes: Record<string, unknown>[],
 *   stops: import('./journeyPlannerModel.js').JourneyStop[],
 *   activeDrivers: { id: string, name: string }[],
 * }} p
 */
export function assessJourneyDriverAssignReadiness(p) {
  const journeyId = String(p.journeyId || '').trim()
  const journey = p.journey
  const quotes = Array.isArray(p.quotes) ? p.quotes : []
  const stops = Array.isArray(p.stops) ? p.stops : []
  const activeDrivers = Array.isArray(p.activeDrivers) ? p.activeDrivers : []

  if (!journeyId) {
    return {
      canOpenModal: false,
      blockReason: 'Journey must be saved before assigning a driver.',
      eligible: [],
      ineligible: [],
      listedOnMarketplace: false,
    }
  }

  const st = String(journey?.status || '').toLowerCase()
  const vis = String(journey?.marketplace_visibility || '')
  if (st === 'completed' || st === 'cancelled' || vis === 'completed' || vis === 'cancelled') {
    return {
      canOpenModal: false,
      blockReason: 'This journey is already completed or cancelled.',
      eligible: [],
      ineligible: [],
      listedOnMarketplace: false,
    }
  }

  const quoteIds = journeyQuoteIdsFromStops(stops, quotes)
  if (quoteIds.length === 0) {
    return {
      canOpenModal: false,
      blockReason: 'This journey has no jobs linked to stops yet.',
      eligible: [],
      ineligible: [],
      listedOnMarketplace: vis === 'visible_in_marketplace',
    }
  }

  if (activeDrivers.length === 0) {
    return {
      canOpenModal: false,
      blockReason: 'No active drivers available. Add drivers under Admin → Drivers.',
      eligible: [],
      ineligible: [],
      listedOnMarketplace: vis === 'visible_in_marketplace',
    }
  }

  const quotesById = new Map(quotes.map((q) => [String(q.id), q]))
  /** @type {{ quoteId: string, quoteRef: string, reason: string }[]} */
  const ineligible = []
  /** @type {Record<string, unknown>[]} */
  const eligible = []

  for (const qid of quoteIds) {
    const q = quotesById.get(qid)
    if (!q) {
      ineligible.push({ quoteId: qid, quoteRef: qid.slice(0, 8), reason: 'Job data not loaded' })
      continue
    }
    const a = assessQuoteDriverAssignmentEligibility(q)
    if (a.eligible) eligible.push(q)
    else ineligible.push({ quoteId: a.quoteId, quoteRef: a.quoteRef, reason: a.reason })
  }

  if (eligible.length === 0) {
    const sample = ineligible[0]?.reason || 'No assignable jobs'
    return {
      canOpenModal: false,
      blockReason:
        ineligible.length === 1
          ? `Cannot assign: ${sample}.`
          : 'All jobs in this journey are already assigned or cannot be reassigned here.',
      eligible: [],
      ineligible,
      listedOnMarketplace: vis === 'visible_in_marketplace',
    }
  }

  return {
    canOpenModal: true,
    blockReason: null,
    eligible,
    ineligible,
    listedOnMarketplace: vis === 'visible_in_marketplace',
  }
}

/**
 * Assign internal driver to eligible journey jobs (same workflow as per-job admin assign).
 *
 * @param {{
 *   journeyId: string,
 *   quotes: Record<string, unknown>[],
 *   driverId: string,
 *   driverName: string,
 *   confirmMarketplaceRemoval?: boolean,
 * }} opts
 */
export async function assignJourneyInternalDriver(opts) {
  const journeyId = String(opts.journeyId || '').trim()
  const driverId = String(opts.driverId || '').trim()
  const driverName = String(opts.driverName || '').trim()
  const quotes = Array.isArray(opts.quotes) ? opts.quotes : []

  if (!journeyId || !driverId || !driverName) {
    throw new Error('Missing journey, driver, or driver name.')
  }

  const actor = await fetchAssignedByActor()
  const ts = new Date().toISOString()

  /** @type {string[]} */
  const assigned = []
  /** @type {{ quoteRef: string, reason: string }[]} */
  const skipped = []
  /** @type {{ quoteRef: string, error: string }[]} */
  const failed = []

  for (const q of quotes) {
    const a = assessQuoteDriverAssignmentEligibility(q, driverId)
    const ref = a.quoteRef
    if (!a.eligible) {
      skipped.push({ quoteRef: ref, reason: a.reason })
      continue
    }
    try {
      const m = mergedAdminWorkflowForQuote(q)
      const log = appendAdminNotesLog(
        m.adminNotesLog,
        actor,
        `Internal driver assigned from journey planner: "${driverName}"`,
      )
      const ok = await updateQuoteWorkflowAssignmentSilent(a.quoteId, {
        assigned_driver_id: driverId,
        assigned_driver_name: driverName,
        assigned_partner_id: null,
        assigned_partner_company: null,
        marketplace_visibility: 'assigned',
        operational_status: 'Assigned',
        admin_notes_log: log,
        assigned_at: ts,
        assigned_by: actor,
      })
      if (!ok.savedRemote) {
        failed.push({ quoteRef: ref, error: 'Quote update failed' })
        continue
      }
      await syncJobAssignmentFromQuoteAssign(a.quoteId, driverId, q, { assignmentStatus: 'Assigned' })
      assigned.push(ref)
    } catch (e) {
      failed.push({ quoteRef: ref, error: e?.message || 'Assignment failed' })
    }
  }

  await updateJourneyRow(journeyId, {
    assigned_driver_id: driverId,
    marketplace_visibility: 'assigned',
  })

  return { assigned, skipped, failed }
}
