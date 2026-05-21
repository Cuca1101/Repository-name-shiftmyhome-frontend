/**
 * Shared production admin list filters (dev + prod unless VITE_SHOW_DEMO_ADMIN_UI=true).
 */

import {
  filterJourneysForProductionInbox,
  filterQuotesForProductionInbox,
  shouldHideJourneyFromAdminInbox,
  shouldHideQuoteFromAdminInbox,
} from './demoTestRecordDetection'
import { shouldApplyProductionAdminFilters } from './adminProductionMode'

export { shouldApplyProductionAdminFilters }

/**
 * @param {Record<string, unknown>[]} quotes
 */
export function filterProductionAdminQuotes(quotes) {
  if (!shouldApplyProductionAdminFilters()) return Array.isArray(quotes) ? quotes : []
  return filterQuotesForProductionInbox(quotes)
}

/**
 * @param {Record<string, unknown>[]} journeys
 */
export function filterProductionAdminJourneys(journeys) {
  if (!shouldApplyProductionAdminFilters()) return Array.isArray(journeys) ? journeys : []
  return filterJourneysForProductionInbox(journeys)
}

/**
 * @param {{
 *   quotes?: Record<string, unknown>[],
 *   journeys?: Record<string, unknown>[],
 *   jobs?: Record<string, unknown>[],
 * }} datasets
 */
export function filterProductionAdminRows(datasets) {
  return {
    quotes: filterProductionAdminQuotes(datasets.quotes),
    journeys: filterProductionAdminJourneys(datasets.journeys),
    jobs: Array.isArray(datasets.jobs) ? datasets.jobs : [],
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} q
 */
export function quoteVisibleInAdminLists(q) {
  if (!shouldApplyProductionAdminFilters()) return true
  return !shouldHideQuoteFromAdminInbox(q)
}

/**
 * @param {Record<string, unknown> | null | undefined} j
 */
export function journeyVisibleInAdminLists(j) {
  if (!shouldApplyProductionAdminFilters()) return true
  return !shouldHideJourneyFromAdminInbox(j)
}
