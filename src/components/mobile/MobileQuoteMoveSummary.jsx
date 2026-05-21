import { useState } from 'react'
import {
  Calendar,
  ChevronDown,
  ClipboardList,
  Clock,
  MapPin,
  MessageSquare,
  Package,
  Route,
  Truck,
  Users,
  Wrench,
} from 'lucide-react'
import QuoteRouteMap from '../quote-wizard/QuoteRouteMap'
import InlineInventoryQtyControl from '../quote-wizard/InlineInventoryQtyControl'
import { CatalogItemLucideIcon } from '../quote-wizard/inventoryLucideIcons'
import { applyInventoryLineQuantityDelta } from '../../lib/inventoryLineQuantity'
import {
  buildMoveSummaryExtras,
  formatDateUK,
  formatMoveSummaryArrival,
  formatMoveSummaryCrewSize,
  formatMoveSummaryDistance,
  formatMoveSummaryFloorLabel,
  formatMoveSummaryInventoryCount,
  formatMoveSummaryLiftLabel,
  hasMoveSummaryRouteData,
} from '../../lib/moveSummaryDisplay'

const card = 'min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm'

function truncate(s, max = 72) {
  if (!s) return ''
  const t = String(s).trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

function SummaryRow({ icon: Icon, iconClass = 'text-slate-400', label, value }) {
  const text = value != null ? String(value).trim() : ''
  if (!text) return null
  return (
    <div className="flex gap-2.5 border-b border-slate-100 py-2 last:border-b-0">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-0.5 text-sm font-semibold leading-snug text-slate-900">{text}</p>
      </div>
    </div>
  )
}

function SelectedInventoryRow({ row, editable, inventoryLines, onInventoryLinesChange }) {
  const qty = Math.max(0, Number(row.quantity) || 0)

  function bump(delta) {
    if (!onInventoryLinesChange) return
    onInventoryLinesChange(applyInventoryLineQuantityDelta(inventoryLines, row.lineId, delta))
  }

  return (
    <li className="flex items-center gap-2 border-b border-slate-100 py-2 last:border-b-0">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100"
        aria-hidden
      >
        {row.isCustom ? (
          <Package className="h-3.5 w-3.5" />
        ) : (
          <CatalogItemLucideIcon itemId={row.catalogId} className="h-3.5 w-3.5" />
        )}
      </div>
      <p className="min-w-0 flex-1 text-sm leading-snug text-slate-800">{row.name}</p>
      {editable ? (
        <InlineInventoryQtyControl
          quantity={qty}
          onAdd={() => bump(1)}
          onDecrement={() => bump(-1)}
          onIncrement={() => bump(1)}
          addLabel="+"
        />
      ) : (
        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">× {qty}</span>
      )}
    </li>
  )
}

/** Unified mobile move summary card for all quote wizard steps. */
export default function MobileQuoteMoveSummary({
  quoteRef,
  wizard,
  serviceType,
  onDistanceFromRoute,
  pickupLng,
  pickupLat,
  deliveryLng,
  deliveryLat,
  pickupAddress,
  deliveryAddress,
  pickupPropertyType,
  deliveryPropertyType,
  pickupFloor,
  deliveryFloor,
  pickupLift,
  deliveryLift,
  distanceMiles,
  moveDate,
  inventoryLines,
  onInventoryLinesChange,
  step,
  totalM3,
  showPricing,
  breakdown,
  crewSettings,
  showOnDesktop = false,
}) {
  const itemsEditable = step === 3 && typeof onInventoryLinesChange === 'function'
  const [itemsOpen, setItemsOpen] = useState(false)

  const selectedLines = (inventoryLines || []).filter((l) => l.quantity > 0)
  const totalItemUnits = selectedLines.reduce((s, l) => s + Math.max(0, Number(l.quantity) || 0), 0)
  const itemCountLabel = formatMoveSummaryInventoryCount(inventoryLines)
  const crewLabel = formatMoveSummaryCrewSize(wizard?.crewSize, crewSettings)
  const arrival = formatMoveSummaryArrival(wizard)
  const distanceLabel = formatMoveSummaryDistance(distanceMiles)
  const pickupFloorLabel = formatMoveSummaryFloorLabel(pickupFloor)
  const deliveryFloorLabel = formatMoveSummaryFloorLabel(deliveryFloor)
  const extras = buildMoveSummaryExtras(wizard)
  const specialInstructions = (wizard?.specialInstructions || '').trim()
  const anythingElse = (wizard?.heavyNotes || '').trim()
  const showRoute = hasMoveSummaryRouteData({
    pickupLng,
    pickupLat,
    deliveryLng,
    deliveryLat,
    pickupAddress,
    deliveryAddress,
  })

  const pickupAddr = truncate(pickupAddress, 80)
  const deliveryAddr = truncate(deliveryAddress, 80)
  const propertyTypePickup = (pickupPropertyType || '').trim()
  const propertyTypeDelivery = (deliveryPropertyType || '').trim()
  const showPickupAccess = pickupAddr || propertyTypePickup || pickupFloorLabel
  const showDeliveryAccess = deliveryAddr || propertyTypeDelivery || deliveryFloorLabel

  return (
    <div className={`${card} overflow-hidden ${showOnDesktop ? '' : 'md:hidden'}`}>
      <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50/90 to-white px-3 py-2.5">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Quote reference</p>
            <p className="truncate font-mono text-sm font-bold text-brand-800">{quoteRef}</p>
          </div>
        </div>
      </div>

      {showRoute ? (
        <div className="px-3 pt-3">
          <div className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/80 [&_.quote-route-map]:rounded-xl [&_.quote-route-map]:border-0 [&_.quote-route-map]:shadow-none [&_.quote-route-map]:ring-0 [&_.quote-route-map_.relative]:!h-[120px] [&_.quote-route-map_.relative]:!min-h-[120px] [&_.quote-route-map_.relative]:!max-h-[120px]">
            <QuoteRouteMap
              pickupLng={pickupLng}
              pickupLat={pickupLat}
              deliveryLng={deliveryLng}
              deliveryLat={deliveryLat}
              distanceMiles={distanceMiles}
              onDistanceFromRoute={onDistanceFromRoute}
            />
          </div>
        </div>
      ) : null}

      <div className="px-3 pb-1 pt-2">
        <p className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Move details</p>
        <SummaryRow icon={Truck} iconClass="text-brand-600" label="Service" value={serviceType} />
        <SummaryRow icon={MapPin} iconClass="text-brand-600" label="Pickup address" value={pickupAddr} />
        {propertyTypePickup ? (
          <SummaryRow
            icon={MapPin}
            iconClass="text-slate-400"
            label="Pickup property type"
            value={propertyTypePickup}
          />
        ) : null}
        {pickupFloorLabel ? (
          <SummaryRow icon={MapPin} iconClass="text-slate-400" label="Pickup floor" value={pickupFloorLabel} />
        ) : null}
        {showPickupAccess ? (
          <SummaryRow
            icon={MapPin}
            iconClass="text-slate-400"
            label="Pickup lift"
            value={formatMoveSummaryLiftLabel(pickupLift)}
          />
        ) : null}
        <SummaryRow icon={MapPin} iconClass="text-emerald-600" label="Delivery address" value={deliveryAddr} />
        {propertyTypeDelivery ? (
          <SummaryRow
            icon={MapPin}
            iconClass="text-slate-400"
            label="Delivery property type"
            value={propertyTypeDelivery}
          />
        ) : null}
        {deliveryFloorLabel ? (
          <SummaryRow icon={MapPin} iconClass="text-slate-400" label="Delivery floor" value={deliveryFloorLabel} />
        ) : null}
        {showDeliveryAccess ? (
          <SummaryRow
            icon={MapPin}
            iconClass="text-slate-400"
            label="Delivery lift"
            value={formatMoveSummaryLiftLabel(deliveryLift)}
          />
        ) : null}
        <SummaryRow icon={Calendar} label="Move date" value={moveDate ? formatDateUK(moveDate) : ''} />
        <SummaryRow icon={Clock} label="Arrival window" value={arrival} />
        <SummaryRow icon={Route} label="Distance" value={distanceLabel} />
        <SummaryRow icon={Users} label="Crew size" value={crewLabel} />
        {itemCountLabel ? (
          <SummaryRow icon={Package} label="Inventory item count" value={itemCountLabel} />
        ) : null}
        {totalM3 > 0 ? (
          <SummaryRow icon={Package} label="Total volume" value={`${totalM3.toFixed(2)} m³`} />
        ) : null}
      </div>

      {totalItemUnits > 0 ? (
        <div className="border-t border-slate-100 px-3">
          <button
            type="button"
            onClick={() => setItemsOpen((v) => !v)}
            className="flex w-full min-h-[44px] items-center gap-2 py-2 text-left"
            aria-expanded={itemsOpen}
          >
            <span className="flex-1 text-sm font-semibold text-slate-900">Selected items</span>
            <span className="shrink-0 text-xs font-medium text-slate-500">{itemCountLabel}</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                itemsOpen ? 'rotate-180' : ''
              }`}
              aria-hidden
            />
          </button>
          <div
            className={`grid transition-[grid-template-rows] duration-200 ease-out ${
              itemsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <ul className="pb-2 pt-0.5">
                {selectedLines.map((row) => (
                  <SelectedInventoryRow
                    key={row.lineId}
                    row={row}
                    editable={itemsEditable}
                    inventoryLines={inventoryLines}
                    onInventoryLinesChange={onInventoryLinesChange}
                  />
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {specialInstructions ? (
        <div className="border-t border-slate-100 px-3 py-2.5">
          <SummaryRow icon={MessageSquare} label="Special instructions" value={specialInstructions} />
        </div>
      ) : null}

      {extras.length > 0 ? (
        <div className="border-t border-slate-100 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Extras</p>
          <div className="mt-1.5 space-y-2">
            {extras.map((block) => (
              <div key={block.key} className="rounded-lg bg-slate-50/90 px-2.5 py-2">
                <div className="flex items-start gap-2">
                  <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800">{block.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{block.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {anythingElse ? (
        <div className="border-t border-slate-100 px-3 py-2.5">
          <SummaryRow icon={MessageSquare} label="Anything else" value={anythingElse} />
        </div>
      ) : null}

      {showPricing && breakdown?.estimatedTotal != null && Number.isFinite(breakdown.estimatedTotal) ? (
        <div className="border-t border-emerald-100 bg-gradient-to-br from-emerald-50/90 to-white px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">Estimated total</p>
          <p className="mt-0.5 text-lg font-bold text-emerald-700">£{breakdown.estimatedTotal.toFixed(2)}</p>
          <p className="mt-1.5 text-[10px] leading-snug text-slate-600">Final price confirmed by ShiftMyHome.</p>
        </div>
      ) : null}

      <div className="h-2" aria-hidden />
    </div>
  )
}
