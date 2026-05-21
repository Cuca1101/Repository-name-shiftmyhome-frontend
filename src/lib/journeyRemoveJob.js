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
import { suggestJourneyMarketplacePayoutFromQuotes, sumQuoteCustomerTotalsGbp } from './journeyFinance'
import { recalculateJourneyRouteMetrics } from './journeyRouteRecalculate'
import {
  saveJourney,
  withdrawJourneyFromMarketplace,
} from './data/journeysRepository'
import { updateQuoteWorkflowAssignmentSilent } from './data/quotesAdminRepository'
import { isSupabaseConfigured } from './supabase'

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
 * @param {Record<string, unknown>[]} quotes
 * @param {boolean} payoutManuallySet
 * @param {number | null} existingPayout
 */
function resolvePayoutForQuotes(journey, quotes, payoutManuallySet, existingPayout) {
  if (payoutManuallySet) {
    const raw = journey?.marketplace_payout_price ?? existingPayout
    if (raw != null && Number.isFinite(Number(raw))) return Number(raw)
    return existingPayout != null && Number.isFinite(existingPayout) ? existingPayout : null
  }
  const suggested = suggestJourneyMarketplacePayoutFromQuotes(quotes)
  return suggested?.payout ?? null
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
 * }} opts
 */
export async function executeRemoveJobFromJourney(opts) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.')
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

  await updateQuoteWorkflowAssignmentSilent(quoteId, { bundled_journey_id: null })

  const newStops = stopsWithoutQuote(opts.stops, quoteId)
  const newQuotes = quotesWithoutQuote(opts.quotes, quoteId)

  const payoutManuallySet = Boolean(journey?.journey_payout_manually_set)
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
      journeyPayoutManuallySet: payoutManuallySet,
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
  const payout = resolvePayoutForQuotes(journey, newQuotes, payoutManuallySet, null)

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
    journeyPayoutManuallySet: payoutManuallySet,
    adminCustomerTotalGbp: sumQuoteCustomerTotalsGbp(newQuotes),
    requirementsTags: requirementBadges,
    totalVolumeM3: sumVolM3,
  })

  return {
    empty: false,
    routingErr: route.routingErr,
    marketplaceWithdrawn: listed && opts.withdrawFromMarketplaceIfListed,
    totals: computeJourneyTotals(route.stops, route.totalDriveSeconds),
  }
}
