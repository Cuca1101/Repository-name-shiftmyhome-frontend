import { quoteMoveYmd } from './operationsMapDateFilter'
import { haversineMiles, quoteJobRef } from './operationsMapHelpers'
import { getMarketplaceFinancePresentation } from './marketplaceQuoteFinance'

const MAX_SUGGESTIONS = 8
const NEARBY_MI = 18
const MAX_BUNDLE = 4

/**
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 */
function sameMoveDate(a, b) {
  const ya = quoteMoveYmd(a)
  const yb = quoteMoveYmd(b)
  if (!ya || !yb) return false
  return ya === yb
}

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, { pickup?: { lng: number, lat: number }, delivery?: { lng: number, lat: number } }>} coords
 */
function quoteVolumeM3(q, coords) {
  void coords
  if (q.total_cubic_metres != null && Number.isFinite(Number(q.total_cubic_metres))) {
    return Number(q.total_cubic_metres)
  }
  return 8
}

/**
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, { pickup?: { lng: number, lat: number } | null, delivery?: { lng: number, lat: number } | null }>} coordsByQuoteId
 */
export function buildJourneyBundleSuggestions(quotes, coordsByQuoteId) {
  const list = (quotes || []).filter((q) => {
    const id = String(q?.id ?? '')
    const c = coordsByQuoteId[id]
    return c?.pickup && c?.delivery
  })

  /** @type {Map<string, Record<string, unknown>[]>} */
  const byDate = new Map()
  for (const q of list) {
    const ymd = quoteMoveYmd(q) || 'unknown'
    if (!byDate.has(ymd)) byDate.set(ymd, [])
    byDate.get(ymd).push(q)
  }

  /** @type {{
   *   id: string,
   *   quoteIds: string[],
   *   refs: string[],
   *   moveYmd: string,
   *   estimatedMiles: number,
   *   estimatedPayoutGbp: number,
   *   estimatedMarginGbp: number,
   *   durationSavedMin: number,
   *   reason: string,
   * }[]} */
  const suggestions = []

  for (const [ymd, group] of byDate) {
    if (group.length < 2) continue
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i]
        const b = group[j]
        const idA = String(a.id)
        const idB = String(b.id)
        const ca = coordsByQuoteId[idA]
        const cb = coordsByQuoteId[idB]
        if (!ca?.pickup || !ca?.delivery || !cb?.pickup || !cb?.delivery) continue

        const puDist = haversineMiles(ca.pickup.lng, ca.pickup.lat, cb.pickup.lng, cb.pickup.lat)
        const dlDist = haversineMiles(ca.delivery.lng, ca.delivery.lat, cb.delivery.lng, cb.delivery.lat)
        const corridor =
          haversineMiles(ca.pickup.lng, ca.pickup.lat, cb.delivery.lng, cb.delivery.lat) < NEARBY_MI * 1.4

        if (puDist > NEARBY_MI && dlDist > NEARBY_MI && !corridor) continue

        const volA = quoteVolumeM3(a, coordsByQuoteId)
        const volB = quoteVolumeM3(b, coordsByQuoteId)
        if (volA + volB > 22) continue

        const finA = getMarketplaceFinancePresentation(a)
        const finB = getMarketplaceFinancePresentation(b)
        const payout =
          (Number(finA?.marketplacePayout) || 0) + (Number(finB?.marketplacePayout) || 0)
        const customer =
          (Number(a.estimated_total) || 0) + (Number(b.estimated_total) || 0)
        const margin = customer > 0 && payout > 0 ? Math.max(0, customer - payout) : payout * 0.15

        const legMi =
          haversineMiles(ca.pickup.lng, ca.pickup.lat, ca.delivery.lng, ca.delivery.lat) +
          haversineMiles(cb.pickup.lng, cb.pickup.lat, cb.delivery.lng, cb.delivery.lat)
        const combinedMi = Math.round((legMi * 0.88 + puDist * 0.3) * 10) / 10
        const savedMin = Math.round(Math.max(15, puDist * 4 + dlDist * 2))

        const reasons = []
        if (puDist <= NEARBY_MI) reasons.push('nearby pickups')
        if (dlDist <= NEARBY_MI) reasons.push('nearby deliveries')
        if (corridor) reasons.push('overlapping corridor')
        if (sameMoveDate(a, b)) reasons.push('same move date')

        suggestions.push({
          id: `${idA}:${idB}`,
          quoteIds: [idA, idB],
          refs: [quoteJobRef(a), quoteJobRef(b)],
          moveYmd: ymd,
          estimatedMiles: combinedMi,
          estimatedPayoutGbp: Math.round(payout * 100) / 100,
          estimatedMarginGbp: Math.round(margin * 100) / 100,
          durationSavedMin: savedMin,
          reason: reasons.join(' · ') || 'compatible bundle',
        })
      }
    }
  }

  suggestions.sort((x, y) => y.estimatedMarginGbp - x.estimatedMarginGbp || y.durationSavedMin - x.durationSavedMin)
  return suggestions.slice(0, MAX_SUGGESTIONS)
}

/**
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, { pickup?: { lng: number, lat: number } | null }>} coordsByQuoteId
 */
export function buildHeatmapPointsFromJobs(quotes, coordsByQuoteId) {
  /** @type {GeoJSON.Feature<GeoJSON.Point>[]} */
  const features = []
  for (const q of quotes || []) {
    const id = String(q?.id ?? '')
    const c = coordsByQuoteId[id]
    if (!c?.pickup) continue
    features.push({
      type: 'Feature',
      properties: { weight: 1 },
      geometry: { type: 'Point', coordinates: [c.pickup.lng, c.pickup.lat] },
    })
    if (c.delivery) {
      features.push({
        type: 'Feature',
        properties: { weight: 0.7 },
        geometry: { type: 'Point', coordinates: [c.delivery.lng, c.delivery.lat] },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}
