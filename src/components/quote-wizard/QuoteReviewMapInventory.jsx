import { applyInventoryLineQuantityDelta } from '../../lib/inventoryLineQuantity'
import InlineInventoryQtyControl from './InlineInventoryQtyControl'
import QuoteRouteMap from './QuoteRouteMap'

function formatLine(line) {
  const qty = Math.max(0, Number(line?.quantity) || 0)
  const rawName = String(line?.name || 'Item').trim() || 'Item'
  const name = line?.isCustom ? `Custom item: ${rawName}` : rawName
  const volume = qty * Math.max(0, Number(line?.m3) || 0)
  return {
    name,
    qty,
    volumeLabel: `${volume.toFixed(2)} m³`,
  }
}

/** Route map and inventory list for the tablet and desktop review sidebar. */
export default function QuoteReviewMapInventory({
  wizard,
  inventoryLines = [],
  totalM3 = 0,
  onDistanceFromRoute,
  onInventoryLinesChange,
  afterMap = null,
}) {
  const lines = (Array.isArray(inventoryLines) ? inventoryLines : []).filter(
    (line) => Math.max(0, Number(line?.quantity) || 0) > 0,
  )
  const units = lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0), 0)
  const volume = Number(totalM3)

  function bumpLine(lineId, delta) {
    if (typeof onInventoryLinesChange !== 'function') return
    onInventoryLinesChange(applyInventoryLineQuantityDelta(inventoryLines, lineId, delta))
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="min-w-0">
        <QuoteRouteMap
          variant="review"
          pickupLng={wizard?.pickupLng}
          pickupLat={wizard?.pickupLat}
          deliveryLng={wizard?.deliveryLng}
          deliveryLat={wizard?.deliveryLat}
          distanceMiles={wizard?.distanceMiles}
          onDistanceFromRoute={onDistanceFromRoute}
        />
      </div>
      {afterMap}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">Inventory</h3>
        <p className="mt-1 text-xs text-slate-600">
          {units} {units === 1 ? 'item' : 'items'}
          {' · '}
          <span className="font-semibold text-slate-900">
            {Number.isFinite(volume) ? volume.toFixed(2) : '0.00'} m³
          </span>
        </p>
        {lines.length ? (
          <ul className="mt-3 space-y-1.5 text-xs leading-snug text-slate-700">
            {lines.map((line) => {
              const formatted = formatLine(line)
              return (
                <li
                  key={line.lineId || `${formatted.name}-${formatted.qty}`}
                  className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5 last:border-b-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug">{formatted.name}</span>
                    <span className="tabular-nums text-slate-500">{formatted.volumeLabel}</span>
                  </span>
                  <InlineInventoryQtyControl
                    quantity={formatted.qty}
                    catalog
                    onAdd={() => bumpLine(line.lineId, 1)}
                    onDecrement={() => bumpLine(line.lineId, -1)}
                    onIncrement={() => bumpLine(line.lineId, 1)}
                  />
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-500">No items added yet.</p>
        )}
      </div>
    </div>
  )
}
