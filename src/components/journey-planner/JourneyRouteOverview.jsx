import { formatJourneyDurationHhMm } from '../../lib/journeyPlannerModel'
import { locationChipFromAddress } from '../../lib/journeyPlannerDisplay'

/**
 * @param {{
 *   stops: import('../../lib/journeyPlannerModel.js').JourneyStop[],
 *   totalMiles: number | null,
 *   totalDurationSeconds: number | null,
 *   routeGeometry?: GeoJSON.LineString | GeoJSON.MultiLineString | null,
 * }} props
 */
export default function JourneyRouteOverview({
  stops,
  totalMiles,
  totalDurationSeconds,
  routeGeometry = null,
}) {
  const pickups = stops.filter((s) => s.kind === 'pickup')
  const deliveries = stops.filter((s) => s.kind === 'delivery')

  const pickupChips = pickups
    .map((s) => locationChipFromAddress(s.address))
    .filter((c) => c.label)
  const deliveryChips = deliveries
    .map((s) => locationChipFromAddress(s.address))
    .filter((c) => c.label)

  const uniqPickup = [...new Map(pickupChips.map((c) => [c.label, c])).values()].slice(0, 6)
  const uniqDelivery = [...new Map(deliveryChips.map((c) => [c.label, c])).values()].slice(0, 6)

  const milesLabel =
    totalMiles != null && Number.isFinite(totalMiles) ? `${Number(totalMiles).toFixed(1)} mi` : '—'
  const durLabel =
    totalDurationSeconds != null && totalDurationSeconds > 0
      ? formatJourneyDurationHhMm(totalDurationSeconds)
      : '—'

  const hasMapPreview = routeGeometry?.type === 'LineString' && Array.isArray(routeGeometry.coordinates)

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-5">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Route overview</h3>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-4 min-w-0">
          <div>
            <p className="text-xs font-semibold text-emerald-800">Pickup regions</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {uniqPickup.length > 0 ? (
                uniqPickup.map((c) => (
                  <span
                    key={`p-${c.label}`}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-950"
                  >
                    {c.label}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">—</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-sky-800">Delivery regions</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {uniqDelivery.length > 0 ? (
                uniqDelivery.map((c) => (
                  <span
                    key={`d-${c.label}`}
                    className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-950"
                  >
                    {c.label}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">—</span>
              )}
            </div>
          </div>
          <dl className="flex flex-wrap gap-4 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Stops</dt>
              <dd className="font-semibold text-slate-900">{stops.length}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Miles</dt>
              <dd className="font-semibold text-slate-900">{milesLabel}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Duration</dt>
              <dd className="font-semibold text-slate-900">{durLabel}</dd>
            </div>
          </dl>
        </div>

        <div className="w-full lg:w-48 shrink-0">
          <p className="text-xs font-semibold uppercase text-slate-500">Timeline preview</p>
          <div
            className="mt-2 flex h-28 flex-col justify-between rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white p-2"
            aria-hidden
          >
            {stops.length === 0 ? (
              <span className="text-xs text-slate-400">No stops</span>
            ) : (
              stops.slice(0, 8).map((s, i) => (
                <div key={s.id || i} className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${s.kind === 'pickup' ? 'bg-emerald-500' : 'bg-sky-500'}`}
                  />
                  <span className="truncate text-[10px] font-medium text-slate-600">
                    {i + 1}. {s.kind === 'pickup' ? 'PU' : 'DL'}
                  </span>
                </div>
              ))
            )}
            {stops.length > 8 ? (
              <span className="text-[10px] text-slate-400">+{stops.length - 8} more</span>
            ) : null}
          </div>
          {hasMapPreview ? (
            <p className="mt-2 text-[10px] text-slate-500">Road route saved on journey record.</p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
