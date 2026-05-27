import {
  buildJourneyMoveDateAndRange,
  buildJourneyMarketplaceTitle,
  buildJourneyRequirementsBadges,
  estimatedWeightKgFromQuotes,
  firstLastPostcodesFromStops,
  maxVolumeM3FromQuotes,
  sumVolumeM3FromQuotes,
} from './journeySummary'
import {
  computeJourneyTotals,
  validatePickupBeforeDeliveryForStops,
} from './journeyPlannerModel'
import { sumQuoteCustomerTotalsGbp } from './journeyFinance'
import { recalculateJourneyRouteMetrics } from './journeyRouteRecalculate'
import {
  saveJourney,
  withdrawJourneyFromMarketplace,
} from './data/journeysRepository'
import { updateQuoteWorkflowAssignmentSilent, updateQuoteWorkflowStatus } from './data/quotesAdminRepository'
import { applyJourneyPayoutToQuotes } from './applyJourneyPayoutToQuotes'
import {
  allJobsAsManualOverrides,
  readPerJobPayoutsFromQuotes,
  removeJobWithChargePayout,
  removeJobWithoutChargePayout,
  round2,
} from './journeyPayoutSplit'
import { isSupabaseConfigured } from './supabase'

/**
 * @typedef {'remove_with_charge' | 'remove_without_charge' | 'cancel_job' | 'keep_in_journey'} JourneyRemoveMode
 */

/**
 * @param {import('./journeyPlannerModel.js').JourneyStop[]} stops
 * @param {string} quoteId
 */
export function stopsWithoutQuote(stops, quoteId) {
  const qid = String(quoteId || '').trim()
  return stops.filter((s) => String(s.quoteId || '').trim() !== qid)
}

/**
 * @param {Record<string, unknown>[]} quotes
 * @param {string} quoteId
 */
export function quotesWithoutQuote(quotes, quoteId) {
  const qid = String(quoteId || '').trim()
  return quotes.filter((q) => String(q.id || '') !== qid)
}

/**
 * @param {Record<string, unknown>} journey
 */
function journeyTotalPayout(journey) {
  const raw = journey?.marketplace_payout_price
  if (raw != null && Number.isFinite(Number(raw))) return round2(raw)
  return null
}

/**
 * @param {{
 *   journeyId: string,
 *   journey: Record<string, unknown>,
 *   quoteId: string,
 *   stops: import('./journeyPlannerModel.js').JourneyStop[],
 *   quotes: Record<string, unknown>[],
 *   mapboxToken?: string,
 *   withdrawFromMarketplaceIfListed?: boolean,
 *   mode?: JourneyRemoveMode,
 *   removalReason?: string,
 * }} opts
 */
export async function executeRemoveJobFromJourney(opts) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.')
  }

  const mode = opts.mode || 'remove_without_charge'
  if (mode === 'keep_in_journey') {
    return { kept: true, empty: false, routingErr: '', marketplaceWithdrawn: false }
  }

  const journeyId = String(opts.journeyId || '').trim()
  const quoteId = String(opts.quoteId || '').trim()
  if (!journeyId) throw new Error('Save the journey before removing jobs.')
  if (!quoteId) throw new Error('Missing job id.')

  const journey = opts.journey
  const listed = String(journey?.marketplace_visibility || '') === 'visible_in_marketplace'

  if (listed && opts.withdrawFromMarketplaceIfListed) {
    await withdrawJourneyFromMarketplace(journeyId)
  }

  const currentByQuoteId = readPerJobPayoutsFromQuotes(opts.quotes)
  const removedPayout = currentByQuoteId[quoteId] ?? 0
  const journeyTotal = journeyTotalPayout(journey)
  const previousTotal = journeyTotal

  if (mode === 'cancel_job') {
    await updateQuoteWorkflowStatus(quoteId, 'Cancelled')
    await updateQuoteWorkflowAssignmentSilent(quoteId, {
      bundled_journey_id: null,
      admin_cancellation_reason:
        (opts.removalReason && String(opts.removalReason).trim()) ||
        'Removed from journey — customer cancelled / not home / access issue',
    })
  } else {
    await updateQuoteWorkflowAssignmentSilent(quoteId, { bundled_journey_id: null })
  }

  const newStops = stopsWithoutQuote(opts.stops, quoteId)
  const newQuotes = quotesWithoutQuote(opts.quotes, quoteId)

  const summaryTitle =
    (journey?.summary_title != null && String(journey.summary_title).trim()) ||
    (journey?.title != null && String(journey.title).trim()) ||
    buildJourneyMarketplaceTitle(newQuotes, { totalDurationSeconds: 0 })

  if (newStops.length === 0) {
    await saveJourney({
      journeyId,
      title: summaryTitle,
      summaryTitle,
      stops: [],
      totalDriveSeconds: 0,
      totalServiceSeconds: 0,
      totalDurationSeconds: 0,
      totalMiles: 0,
      jobsCount: 0,
      quotes: [],
      fromPostcode: null,
      toPostcode: null,
      moveDate: null,
      timeRangeSummary: null,
      maxVolumeM3: null,
      estimatedWeightKg: null,
      journeyPayoutPrice: null,
      journeyPayoutManuallySet: Boolean(journey?.journey_payout_manually_set),
      adminCustomerTotalGbp: null,
      requirementsTags: null,
      totalVolumeM3: 0,
    })
    return { empty: true, routingErr: '', marketplaceWithdrawn: listed && opts.withdrawFromMarketplaceIfListed }
  }

  const orderCheck = validatePickupBeforeDeliveryForStops(newStops)
  if (!orderCheck.ok) {
    throw new Error(orderCheck.message || 'Invalid stop order after removal.')
  }

  const route = await recalculateJourneyRouteMetrics(newStops, opts.mapboxToken || '')
  const { moveDate, timeRangeSummary } = buildJourneyMoveDateAndRange(newQuotes)
  const { fromPostcode, toPostcode } = firstLastPostcodesFromStops(route.stops)
  const maxVolM3 = maxVolumeM3FromQuotes(newQuotes)
  const sumVolM3 = sumVolumeM3FromQuotes(newQuotes)
  const estWeightKg = estimatedWeightKgFromQuotes(newQuotes)
  const requirementBadges = buildJourneyRequirementsBadges({ quotes: newQuotes, jobsCount: route.jobsCount })

  const remainingIds = [...new Set(newQuotes.map((q) => String(q.id || '').trim()).filter(Boolean))]

  let payoutResult = {
    newTotal: journeyTotal,
    byQuoteId: currentByQuoteId,
    manualOverrides: allJobsAsManualOverrides(currentByQuoteId),
  }

  if (journeyTotal != null && journeyTotal > 0) {
    if (mode === 'remove_with_charge') {
      payoutResult = removeJobWithChargePayout(
        journeyTotal,
        removedPayout,
        currentByQuoteId,
        quoteId,
        remainingIds,
      )
    } else {
      const manualFromQuotes = {}
      for (const q of newQuotes) {
        const id = String(q.id || '').trim()
        if (id && q.driver_payout_manual_override && currentByQuoteId[id] != null) {
          manualFromQuotes[id] = currentByQuoteId[id]
        }
      }
      payoutResult = removeJobWithoutChargePayout(journeyTotal, remainingIds, manualFromQuotes)
    }

    await applyJourneyPayoutToQuotes({
      journeyId,
      totalPayout: payoutResult.newTotal ?? journeyTotal,
      byQuoteId: payoutResult.byQuoteId,
      manualQuoteIds: new Set(Object.keys(payoutResult.manualOverrides || {})),
      reason: opts.removalReason || `Job removed (${mode})`,
      auditAction: mode,
      previousTotal,
      previousByQuoteId: currentByQuoteId,
      jobAddedOrRemoved: `removed:${quoteId}`,
    })
  }

  const payout =
    payoutResult.newTotal != null && Number.isFinite(payoutResult.newTotal)
      ? payoutResult.newTotal
      : journeyTotal

  await saveJourney({
    journeyId,
    title: summaryTitle,
    summaryTitle,
    stops: route.stops,
    totalDriveSeconds: route.totalDriveSeconds,
    totalServiceSeconds: route.totalServiceSeconds,
    totalDurationSeconds: route.totalDurationSeconds,
    totalMiles: route.totalMiles,
    jobsCount: route.jobsCount,
    quotes: newQuotes,
    fromPostcode: fromPostcode || null,
    toPostcode: toPostcode || null,
    moveDate: moveDate || null,
    timeRangeSummary: timeRangeSummary || null,
    maxVolumeM3: maxVolM3 > 0 ? maxVolM3 : null,
    estimatedWeightKg: estWeightKg,
    journeyPayoutPrice: payout,
    journeyPayoutManuallySet: Boolean(journey?.journey_payout_manually_set) || payout != null,
    adminCustomerTotalGbp: sumQuoteCustomerTotalsGbp(newQuotes),
    requirementsTags: requirementBadges,
    totalVolumeM3: sumVolM3,
  })

  return {
    empty: false,
    routingErr: route.routingErr,
    marketplaceWithdrawn: listed && opts.withdrawFromMarketplaceIfListed,
    totals: computeJourneyTotals(route.stops, route.totalDriveSeconds),
    payoutByQuoteId: payoutResult.byQuoteId,
    journeyPayoutTotal: payout,
    removedWithCharge: mode === 'remove_with_charge',
    removedPayout,
  }
}
