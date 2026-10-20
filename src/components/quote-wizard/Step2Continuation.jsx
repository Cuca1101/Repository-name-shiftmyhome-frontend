import { useState } from 'react'
import { Box, Calendar, ChevronDown, Clock, FileText, Info, MapPin, Package, Route, User, Users } from 'lucide-react'
import { applyInventoryLineQuantityDelta } from '../../lib/inventoryLineQuantity'
import { formatCrewSizeLabel } from '../../lib/crewPricingRules'
import {
  formatMoveSummaryArrival,
  formatMoveSummaryDistance,
  formatMoveSummaryFloorLabel,
  formatMoveSummaryLiftLabel,
} from '../../lib/moveSummaryDisplay'
import DesktopFurnitureServicesSection from './DesktopFurnitureServicesSection'
import InlineInventoryQtyControl from './InlineInventoryQtyControl'
import JobDetailsContactSection from './JobDetailsContactSection'
import PackingMaterialsSection from './PackingMaterialsSection'
import QuoteRouteMap from './QuoteRouteMap'
import QuoteSpecialInstructionsField from './QuoteSpecialInstructionsField'
import { placeSummary } from './ReviewMoveSummaries'
import { useQuoteWizard } from './QuoteWizardContext'

const card = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'
const extrasInput =
  'w-full max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'
const extrasLabel = 'mb-1.5 block text-sm font-medium text-slate-700'

function formatMoveDate(iso) {
  const match = String(iso || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return ''
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function accessLine(data, side) {
  const type = String(data?.[`${side}PropertyType`] || '').trim()
  const floor = formatMoveSummaryFloorLabel(data?.[`${side}Floor`])
  const lift = formatMoveSummaryLiftLabel(data?.[`${side}Lift`], data?.[`${side}Floor`])
  return [type, floor, lift].filter(Boolean).join(' · ')
}

export function Step2ContactCard({ lockMobile = false }) {
  const { mode, wizard, setWizard, settings, breakdown, priceWithoutPromo, feedback } = useQuoteWizard()
  const isAdmin = mode === 'admin'
  const contactValidation =
    feedback?.type === 'error' &&
    feedback?.text &&
    /full name|phone|email|contact detail/i.test(feedback.text)
      ? feedback.text
      : ''

  return (
    <section className={`${card} max-md:order-last`}>
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
        <User className="h-5 w-5 text-blue-600" aria-hidden />
        Your contact details
      </h2>
      <JobDetailsContactSection
        data={wizard}
        onChange={setWizard}
        pricingSettings={settings}
        breakdown={breakdown}
        priceWithoutPromo={priceWithoutPromo}
        validationMessage={contactValidation}
        flexibleContact={isAdmin}
        lockSignedInEmail={!isAdmin}
        showCustomerIdentity={isAdmin}
        embedded
        lockMobile={lockMobile}
      />
    </section>
  )
}

function Step2RouteMap() {
  const { wizard, handleDistanceFromRoute } = useQuoteWizard()
  return (
    <QuoteRouteMap
      variant="review"
      shellClass="relative h-[220px] min-h-[220px] w-full min-w-0 overflow-hidden md:h-[260px] md:min-h-[260px]"
      pickupLng={wizard?.pickupLng}
      pickupLat={wizard?.pickupLat}
      deliveryLng={wizard?.deliveryLng}
      deliveryLat={wizard?.deliveryLat}
      distanceMiles={wizard?.distanceMiles}
      onDistanceFromRoute={handleDistanceFromRoute}
    />
  )
}

/** Step 2 extras stay open. The Edit control is only on Step 3. */
export function Step2Extras() {
  const { wizard, setWizard, settings } = useQuoteWizard()

  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
        <Package className="h-5 w-5 text-blue-600" aria-hidden />
        Extras
      </h2>
      <div className="mt-3 space-y-3">
        <DesktopFurnitureServicesSection
          data={wizard}
          onChange={setWizard}
          input={extrasInput}
          label={extrasLabel}
        />
        <PackingMaterialsSection
          data={wizard}
          onChange={setWizard}
          pricingSettings={settings}
          variant="mobile"
          defaultExpanded
        />
      </div>
    </section>
  )
}

/**
 * Step 2 continuation: selected items, contact, and the move summary.
 * From tablet upward the review map stays open above Selected items.
 * Extras move into the left column from tablet upward.
 */
export default function Step2Continuation({ columnsLayout = false, hideExtras = false }) {
  const { wizard, setWizard, serviceType, totalM3, settings } = useQuoteWizard()
  const [itemsOpen, setItemsOpen] = useState(false)
  const [routeOpen, setRouteOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(true)
  const [notesOpen, setNotesOpen] = useState(false)
  const lines = (Array.isArray(wizard?.inventoryLines) ? wizard.inventoryLines : []).filter(
    (line) => Math.max(0, Number(line?.quantity) || 0) > 0,
  )
  const units = lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0), 0)
  const volume = Number(totalM3)
  const volumeLabel = Number.isFinite(volume) ? volume.toFixed(2) : '0.00'

  function bumpLine(lineId, delta) {
    setWizard((current) => ({
      ...current,
      inventoryLines: applyInventoryLineQuantityDelta(current.inventoryLines, lineId, delta),
    }))
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {columnsLayout ? <Step2RouteMap /> : null}
      <section className={card}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Box className="h-5 w-5 text-blue-600" aria-hidden />
            Selected items
          </h2>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700"
            aria-expanded={itemsOpen}
            onClick={() => setItemsOpen((open) => !open)}
          >
            {itemsOpen ? 'Hide' : 'View / edit'}
            <ChevronDown className={`h-4 w-4 transition ${itemsOpen ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-900">
          {units} {units === 1 ? 'item' : 'items'} · {volumeLabel} m³
        </p>
        <p className="mt-0.5 text-xs text-slate-500">Updates as you add items.</p>
        {itemsOpen ? (
          lines.length ? (
            <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
              {lines.map((line) => {
                const qty = Math.max(0, Number(line.quantity) || 0)
                const name = line.isCustom
                  ? `Custom item: ${String(line.name || 'Item').trim()}`
                  : String(line.name || 'Item').trim()
                return (
                  <li key={line.lineId || name} className="flex items-center justify-between gap-2 py-1">
                    <span className="min-w-0 flex-1 text-sm text-slate-800">{name}</span>
                    <InlineInventoryQtyControl
                      quantity={qty}
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
            <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-500">No items added yet.</p>
          )
        ) : null}
      </section>

      {columnsLayout ? null : <Step2ContactCard />}

      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <FileText className="h-5 w-5 text-blue-600" aria-hidden />
            Your move
          </h2>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700"
            aria-expanded={moveOpen}
            onClick={() => setMoveOpen((open) => !open)}
          >
            Edit
            <ChevronDown className={`h-4 w-4 transition ${moveOpen ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        </div>
        {moveOpen ? (
          <div className="mt-3 space-y-3 text-sm">
            <p className="font-semibold text-slate-900">{serviceType || 'House Removals'}</p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden />
                <div className="min-w-0">
                  <p className="text-slate-500">Pickup</p>
                  <p className="font-semibold text-slate-900">{placeSummary(wizard, 'pickup')}</p>
                  {accessLine(wizard, 'pickup') ? (
                    <p className="text-xs text-slate-500">{accessLine(wizard, 'pickup')}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden />
                <div className="min-w-0">
                  <p className="text-slate-500">Delivery</p>
                  <p className="font-semibold text-slate-900">{placeSummary(wizard, 'delivery')}</p>
                  {accessLine(wizard, 'delivery') ? (
                    <p className="text-xs text-slate-500">{accessLine(wizard, 'delivery')}</p>
                  ) : null}
                </div>
              </div>
            </div>
            {columnsLayout ? null : (
              <button
                type="button"
                className="text-sm font-semibold text-blue-700"
                aria-expanded={routeOpen}
                onClick={() => setRouteOpen((open) => !open)}
              >
                {routeOpen ? 'Hide route' : 'View route'} <span aria-hidden>›</span>
              </button>
            )}
            {!columnsLayout && routeOpen ? <Step2RouteMap /> : null}
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <Fact icon={<Calendar className="h-4 w-4" />} label="Date" value={formatMoveDate(wizard?.moveDate)} />
              <Fact icon={<Clock className="h-4 w-4" />} label="Arrival window" value={formatMoveSummaryArrival(wizard)} />
              <Fact icon={<Route className="h-4 w-4" />} label="Distance" value={formatMoveSummaryDistance(wizard?.distanceMiles)} />
              <Fact icon={<Users className="h-4 w-4" />} label="Crew" value={formatCrewSizeLabel(wizard?.crewSize, settings)} />
              <Fact icon={<Package className="h-4 w-4" />} label="Inventory" value={units > 0 ? `${units} ${units === 1 ? 'item' : 'items'} · ${volumeLabel} m³` : ''} />
            </div>
          </div>
        ) : null}
      </section>

      {hideExtras ? null : <Step2Extras />}

      <section className={card}>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={notesOpen}
          onClick={() => setNotesOpen((open) => !open)}
        >
          <span className="flex items-center gap-2 text-base font-bold text-slate-900">
            <FileText className="h-5 w-5 text-blue-600" aria-hidden />
            Additional notes
          </span>
          <ChevronDown className={`h-4 w-4 text-slate-500 transition ${notesOpen ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {notesOpen ? (
          <div className="mt-3">
            <QuoteSpecialInstructionsField data={wizard} onChange={setWizard} embedded />
          </div>
        ) : null}
      </section>

      <p className="flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs leading-snug text-slate-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden />
        Your price is shown at the review step.
      </p>
    </div>
  )
}

function Fact({ icon, label, value }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400" aria-hidden>{icon}</span>
      <span className="w-28 shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 flex-1 text-right font-semibold text-slate-900">{value || '—'}</span>
    </div>
  )
}
