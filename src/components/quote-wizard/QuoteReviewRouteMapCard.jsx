import QuoteRouteMap from './QuoteRouteMap'

const card = 'rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4'

/**
 * Compact Mapbox route card for Step 3 review.
 */
export default function QuoteReviewRouteMapCard({
  pickupLng,
  pickupLat,
  deliveryLng,
  deliveryLat,
  distanceMiles,
  onDistanceFromRoute,
}) {
  const miles =
    Number(distanceMiles) > 0 ? `${Number(distanceMiles).toFixed(1)} miles` : 'Distance pending'

  return (
    <section className={card} aria-labelledby="quote-review-route-heading">
      <div className="flex items-center justify-between gap-2">
        <h3 id="quote-review-route-heading" className="text-xs font-bold text-slate-900 md:text-sm">
          Route
        </h3>
        <span className="text-[10px] font-medium tabular-nums text-slate-500 md:text-xs">{miles}</span>
      </div>
      <div className="quote-route-map-compact mt-2 overflow-hidden rounded-lg border border-slate-100 [&_.quote-route-map]:rounded-lg [&_.quote-route-map]:border-0 [&_.quote-route-map]:shadow-none [&_.quote-route-map]:ring-0">
        <QuoteRouteMap
          variant="review"
          pickupLng={pickupLng}
          pickupLat={pickupLat}
          deliveryLng={deliveryLng}
          deliveryLat={deliveryLat}
          distanceMiles={distanceMiles}
          onDistanceFromRoute={onDistanceFromRoute}
        />
      </div>
    </section>
  )
}
