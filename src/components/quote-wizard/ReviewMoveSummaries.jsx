import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { applyInventoryLineQuantityDelta } from '../../lib/inventoryLineQuantity'
import { cityFromAddress } from '../../lib/journeyPlannerDisplay'
import { extractUkPostcode } from '../../lib/journeySummary'
import InlineInventoryQtyControl from './InlineInventoryQtyControl'
import QuoteRouteMap from './QuoteRouteMap'
import { useQuoteWizard } from './QuoteWizardContext'

function addressPartIncluded(address, part) {
  const line = String(address || '').trim().toLowerCase()
  const piece = String(part || '').trim().toLowerCase()
  return Boolean(line && piece && line.includes(piece))
}

function withoutPostcodeAndRegion(address) {
  return String(address || '')
    .replace(/\b(united kingdom|uk|scotland|england|wales|northern ireland)\b/gi, ' ')
    .replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, ' ')
    .replace(/[^a-z]+/gi, ' ')
    .trim()
}

function postcodeAnywhere(text) {
  const match = String(text || '').match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i)
  return match ? match[1].toUpperCase().replace(/\s+/g, ' ') : ''
}

/** Town after the street, never the postcode itself. */
function townFromAddress(address, postcode) {
  const skip = /^(uk|united kingdom|scotland|england|wales|northern ireland|great britain)$/i
  const parts = String(address || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i].replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, ' ').replace(/\s+/g, ' ').trim()
    if (!part || skip.test(part) || (postcode && part.toLowerCase() === postcode.toLowerCase())) continue
    if (/^[A-Z]{1,2}\d/i.test(part)) continue
    return part
  }
  return ''
}

/** How much of the line is a street, not only a postcode and city. */
function streetDetailScore(line) {
  return withoutPostcodeAndRegion(line).replace(/\s+/g, ' ').trim().length
}

/** Full street line for steps 2 and 3. A saved postcode is only the fallback. */
export function placeSummary(data, side) {
  const address = String(data?.[`${side}Address`] || '').trim()
  const house = String(data?.[`${side}HouseNumber`] || '').trim()
  const street = String(data?.[`${side}Street`] || '').trim()
  const postcode = String(data?.[`${side}Postcode`] || '').trim() || postcodeAnywhere(address) || extractUkPostcode(address)
  const town = String(data?.[`${side}Town`] || '').trim() || townFromAddress(address, postcode) || cityFromAddress(address)
  const flat = String(data?.[`${side}Apartment`] || data?.[`${side}FlatDetails`] || '').trim()
  const door = [house, street].filter(Boolean).join(' ')
  const composed = [door, town, postcode].filter(Boolean).join(', ')

  function withFlat(line) {
    const text = String(line || '').trim()
    if (!flat || !text) return text
    if (text.toLowerCase().includes(flat.toLowerCase())) return text
    return `${flat}, ${text}`
  }

  const saved = withFlat(address)
  const built = withFlat(composed)
  const savedHasDoor = Boolean(door) && addressPartIncluded(saved, street || house)
  if (door && built && !savedHasDoor) return built
  if (saved && streetDetailScore(saved) >= streetDetailScore(built)) return saved
  return built || saved || 'Add address'
}

export function extrasSummary(data) {
  const bits = []
  if (data?.packing) bits.push('Packing')
  if (data?.packingMaterials) bits.push('Materials')
  if (data?.dismantling) bits.push('Dismantling')
  if (data?.reassembly) bits.push('Assembly')
  const notes = String(data?.specialInstructions || data?.heavyNotes || '').trim()
  if (!bits.length && notes) return 'Notes added'
  return bits.length ? bits.join(' · ') : 'None selected'
}

export function AddressRouteSummary({ data }) {
  const { wizard, setWizard, totalM3 } = useQuoteWizard()
  const [open, setOpen] = useState(false)
  const [itemsOpen, setItemsOpen] = useState(false)
  const lines = (Array.isArray(wizard?.inventoryLines) ? wizard.inventoryLines : []).filter(
    (line) => Math.max(0, Number(line?.quantity) || 0) > 0,
  )
  const units = lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0), 0)
  const volume = Number(totalM3)

  function bumpLine(lineId, delta) {
    setWizard((current) => ({
      ...current,
      inventoryLines: applyInventoryLineQuantityDelta(current.inventoryLines, lineId, delta),
    }))
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="w-16 text-slate-500">Pickup</span>
        <span className="min-w-0 flex-1 break-words text-right font-semibold text-slate-900">{placeSummary(data, 'pickup')}</span>
      </p>
      <p className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="w-16 text-slate-500">Delivery</span>
        <span className="min-w-0 flex-1 break-words text-right font-semibold text-slate-900">{placeSummary(data, 'delivery')}</span>
      </p>
      <div className="border-t border-slate-100" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <button type="button" className="text-sm font-semibold text-blue-700" onClick={() => setOpen((value) => !value)}>
          {open ? 'Hide route' : 'View route'} <span aria-hidden>›</span>
        </button>
        <button
          type="button"
          className="text-sm font-semibold text-blue-700 md:hidden"
          onClick={() => setItemsOpen((value) => !value)}
        >
          {itemsOpen ? 'Hide items' : 'View items'} <span aria-hidden>›</span>
        </button>
      </div>
      {itemsOpen ? (
        <div className="md:hidden">
          <p className="text-xs text-slate-600">
            {units} {units === 1 ? 'item' : 'items'}
            {' · '}
            <span className="font-semibold text-slate-900">
              {Number.isFinite(volume) ? volume.toFixed(2) : '0.00'} m³
            </span>
          </p>
          {lines.length ? (
            <ul className="mt-2 space-y-1.5">
              {lines.map((line) => {
                const qty = Math.max(0, Number(line.quantity) || 0)
                const name = line.isCustom
                  ? `Custom item: ${String(line.name || 'Item').trim()}`
                  : String(line.name || 'Item').trim()
                const lineVolume = qty * Math.max(0, Number(line.m3) || 0)
                return (
                  <li key={line.lineId || name} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5 last:border-b-0">
                    <span className="min-w-0 flex-1 text-xs">
                      <span className="block text-slate-800">{name}</span>
                      <span className="tabular-nums text-slate-500">{lineVolume.toFixed(2)} m³</span>
                    </span>
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
            <p className="mt-2 text-xs text-slate-500">No items added yet.</p>
          )}
        </div>
      ) : null}
      {open ? (
        <QuoteRouteMap
          variant="review"
          pickupLng={data?.pickupLng}
          pickupLat={data?.pickupLat}
          deliveryLng={data?.deliveryLng}
          deliveryLat={data?.deliveryLat}
          distanceMiles={data?.distanceMiles}
        />
      ) : null}
    </div>
  )
}
