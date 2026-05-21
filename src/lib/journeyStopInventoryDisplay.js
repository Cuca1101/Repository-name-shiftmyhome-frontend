/**
 * Read-only journey stop inventory & warning display.
 * Reuses existing quote inventory parsers — does not mutate quote data.
 */

import {
  buildAvailableJobInventoryDisplayRows,
  summarizeAvailableJobInventory,
} from './availableJobInventoryDisplay'
import { buildAdminJobQuoteDetailsViewModel, liftReadable } from './adminJobQuoteDetailsViewModel'
import {
  buildPricingBreakdownSections,
  parseDetailsKeyValues,
  parseInventoryTableRows,
} from './quoteJobAdminModel'

/**
 * @param {unknown} details
 * @param {string} sectionTitle
 */
function extractDetailsSectionBody(details, sectionTitle) {
  const text = String(details ?? '')
  const esc = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`—\\s*${esc}\\s*—\\s*\\n([\\s\\S]*?)(?=\\n—\\s*.+?\\s*—|$)`, 'i')
  const m = text.match(re)
  return m ? m[1].trim() : ''
}

/**
 * @param {Record<string, unknown> | null | undefined} quote
 */
export function buildJourneyStopInventoryView(quote) {
  const rows = buildAvailableJobInventoryDisplayRows(quote || {})
  const summary = summarizeAvailableJobInventory(rows)
  const count = summary.qtyTotal > 0 ? summary.qtyTotal : summary.itemCount

  const previewParts = rows.slice(0, 2).map((r) => `${r.qty}x ${r.name}`)
  const moreCount = rows.length > 2 ? rows.length - 2 : 0

  const summaryLine =
    count > 0
      ? `${count} item${count !== 1 ? 's' : ''}${summary.volumeLabel !== '—' ? ` • ${summary.volumeLabel}` : ''}`
      : null

  const itemsLine =
    previewParts.length > 0
      ? `${previewParts.join(' • ')}${moreCount > 0 ? ` • +${moreCount} more` : ''}`
      : null

  return {
    rows,
    summary,
    summaryLine,
    itemsLine,
    itemCount: summary.itemCount,
    qtyTotal: summary.qtyTotal,
    volumeLabel: summary.volumeLabel,
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} quote
 * @param {'pickup' | 'delivery'} [stopKind]
 * @returns {string[]}
 */
export function buildJourneyStopWarningChips(quote, stopKind) {
  if (!quote || typeof quote !== 'object') return []

  /** @type {Set<string>} */
  const chips = new Set()
  const details = String(quote.details || '')
  const text = `${details}\n${String(quote.message || '')}`.toLowerCase()
  const vm = buildAdminJobQuoteDetailsViewModel(quote)
  const extrasBody = extractDetailsSectionBody(details, 'Extra services')

  const { heavy } = buildPricingBreakdownSections(quote)
  if (heavy.length > 0) chips.add('Heavy items')

  const rows = buildAvailableJobInventoryDisplayRows(quote)
  for (const r of rows) {
    const name = String(r.name || '').toLowerCase()
    const st = String(r.sizeType || '').toLowerCase()
    if (/\bpiano\b/.test(name)) chips.add('Piano')
    if (/\bwardrobe\b/.test(name) && /large|heavy|big|oversize/.test(`${name} ${st}`)) {
      chips.add('Large wardrobe')
    }
    if (/heavy|large|oversize/.test(st) || /\b(heavy|large)\b/.test(name)) chips.add('Heavy items')
    if (/fragile/.test(`${name} ${st}`)) chips.add('Fragile')
  }

  const invRows = parseInventoryTableRows(quote.inventory, quote.details)
  for (const r of invRows) {
    const name = String(r.name || '').toLowerCase()
    if (/\bpiano\b/.test(name)) chips.add('Piano')
  }

  if (/fragile:\s*yes/i.test(details)) chips.add('Fragile')
  if (/packing requested/i.test(extrasBody)) chips.add('Packing required')
  if (/dismantling requested/i.test(extrasBody)) chips.add('Dismantling')
  if (/reassembly requested/i.test(extrasBody)) chips.add('Reassembly')

  const crew = Number(quote.crew_size)
  if (Number.isFinite(crew) && crew >= 3) chips.add('3+ crew recommended')

  if (/\blong carry\b|\blong walk\b/i.test(text)) chips.add('Long carry')
  if (vm.walking !== '—' && /\blong\b/i.test(vm.walking)) chips.add('Long carry')

  const liftNo =
    liftReadable(vm.pickupLiftRaw) === 'No' ||
    liftReadable(vm.deliveryLiftRaw) === 'No' ||
    /\bno lift\b/i.test(text)
  if (liftNo) chips.add('No lift')

  const floor =
    stopKind === 'delivery'
      ? String(vm.deliveryFloor || '')
      : stopKind === 'pickup'
        ? String(vm.pickupFloor || '')
        : `${vm.pickupFloor} ${vm.deliveryFloor}`
  if (
    /\b(2nd|3rd|4th|5th|second|third|fourth|fifth|upper|top floor|above ground)\b/i.test(floor) ||
    /\bfloor\s*[3-9]\b/i.test(floor)
  ) {
    chips.add('Upper floor')
  }

  return [...chips]
}

/**
 * @param {Record<string, unknown> | null | undefined} quote
 * @param {'pickup' | 'delivery'} stopKind
 */
export function buildJourneyStopExpandedDetails(quote, stopKind) {
  if (!quote || typeof quote !== 'object') {
    return { vm: null, extras: [], inventory: buildJourneyStopInventoryView(null) }
  }

  const vm = buildAdminJobQuoteDetailsViewModel(quote)
  const kv = parseDetailsKeyValues(quote.details)
  const details = String(quote.details || '')
  const extrasBody = extractDetailsSectionBody(details, 'Extra services')

  /** @type {{ label: string, value: string }[]} */
  const extras = []
  if (/packing requested/i.test(extrasBody)) {
    const bits = ['Packing requested']
    if (kv['What to pack']) bits.push(kv['What to pack'])
    if (kv['Approx boxes/items']) bits.push(`${kv['Approx boxes/items']} boxes/items`)
    extras.push({ label: 'Packing', value: bits.join(' · ') })
  }
  if (/fragile:\s*yes/i.test(details)) extras.push({ label: 'Fragile', value: 'Yes' })
  if (/dismantling requested/i.test(extrasBody)) {
    extras.push({
      label: 'Dismantling',
      value: [kv['Items'], kv['How many items'] ? `${kv['How many items']} items` : '']
        .filter(Boolean)
        .join(' · ') || 'Requested',
    })
  }
  if (/reassembly requested/i.test(extrasBody)) {
    extras.push({ label: 'Reassembly', value: 'Requested' })
  }

  const { heavy } = buildPricingBreakdownSections(quote)
  if (heavy.length > 0) {
    extras.push({
      label: 'Heavy items (pricing)',
      value: heavy.map((h) => h.label).join(', '),
    })
  }

  return {
    vm,
    extras,
    inventory: buildJourneyStopInventoryView(quote),
    phone: String(quote.phone || '').trim() || null,
    email: String(quote.email || '').trim() || null,
    customerName: String(quote.full_name || quote.customer_name || '').trim() || null,
  }
}
