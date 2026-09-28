/**
 * Shared eligibility for admin booking / abandoned notification emails.
 * Incomplete, test, or placeholder records must be skipped entirely.
 */

import { formatDateUK } from './formatDateUK.ts'
import {
  formatMoneyGbp,
  parsePricingVolumeM3,
  quoteMatchesDemoOrTest,
  type QuoteRow,
} from './quoteAvailableJobEligibility.ts'

export type AdminNotifyFields = {
  customerName: string
  telephone: string
  email: string
  collectionAddress: string
  deliveryAddress: string
  movingDate: string
  inventoryVolume: string
  inventorySummary: string
  movers: string
  quotedPrice: string
  reference: string
  volumeM3: number
  moversCount: number
  priceGbp: number
}

export type ValidationResult =
  | { ok: true; fields: AdminNotifyFields }
  | { ok: false; reason: string }

function str(v: unknown): string {
  return String(v ?? '').trim()
}

function lower(v: unknown): string {
  return str(v).toLowerCase()
}

const PLACEHOLDER_NAME =
  /^(test|demo|customer|user|name|n\/?a|none|unknown|asdf|qwerty|xxx+|sample|placeholder)(\s|$)/i

const PLACEHOLDER_EMAIL =
  /@(test\.|example\.|email\.|mailinator\.|fake\.|localhost)|^(test|demo|noreply|no-reply|placeholder)@/i

function looksPlaceholderName(name: string): boolean {
  const n = str(name)
  if (n.length < 2) return true
  if (PLACEHOLDER_NAME.test(n)) return true
  if (/^(test|demo)\b/i.test(n)) return true
  return false
}

/** UK / intl phone: at least 10 digits after stripping non-digits. */
export function isValidTelephone(raw: unknown): boolean {
  const s = str(raw)
  if (!s || s === '—' || /^n\/?a$/i.test(s)) return false
  const digits = s.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return false
  if (/^0+$/.test(digits) || /^1+$/.test(digits) || /^1234567890$/.test(digits)) return false
  if (/^0{5,}/.test(digits) || /^(\d)\1{9,}$/.test(digits)) return false
  return true
}

export function isValidEmail(raw: unknown): boolean {
  const s = str(raw)
  if (!s || s.length > 254) return false
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return false
  if (PLACEHOLDER_EMAIL.test(s)) return false
  return true
}

function isRealAddress(raw: unknown): boolean {
  const s = str(raw)
  if (s.length < 8) return false
  if (/^(test|demo|n\/?a|none|address|tbc|tba)(\s|$)/i.test(s)) return false
  // Prefer something that looks like a place (street / postcode / comma).
  if (!/[a-zA-Z]/.test(s)) return false
  return true
}

function isRealMoveDate(raw: unknown): boolean {
  const s = str(raw)
  if (!s) return false
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return true
  const d = new Date(s)
  return Number.isFinite(d.getTime())
}

function isPlaceholderItemName(name: string): boolean {
  const n = str(name)
  if (n.length < 2) return true
  if (/^(item|test|demo|sample|n\/?a|xxx+|asdf|placeholder)(\s*\d*)?$/i.test(n)) return true
  return false
}

type InventoryItem = { name: string; quantity: number }

export function extractGenuineInventoryItems(raw: unknown, inventoryText?: unknown): InventoryItem[] {
  const out: InventoryItem[] = []

  const push = (name: unknown, qty: unknown) => {
    const n = str(name)
    if (!n || isPlaceholderItemName(n)) return
    const q = Number(qty)
    const quantity = Number.isFinite(q) && q > 0 ? Math.round(q) : 1
    out.push({ name: n, quantity })
  }

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      push(row.item_name ?? row.name ?? row.label ?? row.summary, row.quantity ?? row.qty ?? 1)
    }
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.items)) {
      for (const item of obj.items as unknown[]) {
        if (!item || typeof item !== 'object') continue
        const row = item as Record<string, unknown>
        push(row.item_name ?? row.name ?? row.label, row.quantity ?? row.qty ?? 1)
      }
    }
  } else if (typeof raw === 'string' && str(raw)) {
    try {
      const parsed = JSON.parse(str(raw))
      out.push(...extractGenuineInventoryItems(parsed))
    } catch {
      /* free text below */
    }
  }

  const text = str(inventoryText)
  if (text) {
    for (const line of text.split(/[\r\n]+|•/g)) {
      const segment = line.trim().replace(/^[-*·•]\s*/, '')
      if (!segment || /^inventory[:\s]*$/i.test(segment)) continue
      const qtyMatch = segment.match(/(?:×|x)\s*(\d+)/i) || segment.match(/^(\d+)\s*(?:×|x)\s*/i)
      const qty = qtyMatch?.[1] ? Number(qtyMatch[1]) : 1
      const name = segment
        .replace(/(?:×|x)\s*\d+/gi, '')
        .replace(/^\d+\s*(?:×|x)\s*/i, '')
        .replace(/\([^)]*\)/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
      push(name, qty)
    }
  }

  const dedup = new Map<string, InventoryItem>()
  for (const item of out) {
    const key = lower(item.name)
    const prev = dedup.get(key)
    if (!prev) dedup.set(key, item)
    else dedup.set(key, { name: prev.name, quantity: prev.quantity + item.quantity })
  }
  return [...dedup.values()]
}

function inventorySummary(items: InventoryItem[]): string {
  if (!items.length) return ''
  return items
    .slice(0, 12)
    .map((i) => (i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name))
    .join(', ')
}

function volumeFromQuote(q: QuoteRow): number {
  const fromPricing = parsePricingVolumeM3(q.pricing)
  if (fromPricing != null && fromPricing > 0) return fromPricing
  const n = Number(q.total_cubic_metres)
  if (Number.isFinite(n) && n > 0) return n
  return 0
}

function priceFromQuote(q: QuoteRow): number {
  const paid = Number(q.amount_paid)
  if (Number.isFinite(paid) && paid > 0) return paid
  const est = Number(q.estimated_total)
  if (Number.isFinite(est) && est > 0) return est
  const raw = str(q.pricing)
  const m = raw.match(/estimated total:\s*£([\d,]+(?:\.\d{1,2})?)/i)
  if (m) {
    const n = parseFloat(m[1].replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0) return n
  }
  return 0
}

function moversFromQuote(q: QuoteRow): number {
  const n = Number(q.crew_size)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

/**
 * Validate a paid/confirmed quote before admin "New Booking Confirmed" email.
 */
export function validateQuoteForAdminBookingNotify(
  q: QuoteRow,
  extraInventoryRows?: unknown,
): ValidationResult {
  if (!q || typeof q !== 'object') return { ok: false, reason: 'invalid_quote' }
  if (quoteMatchesDemoOrTest(q)) return { ok: false, reason: 'test_or_demo' }

  const customerName = str(q.full_name || q.customer_name)
  if (!customerName || looksPlaceholderName(customerName)) {
    return { ok: false, reason: 'missing_or_invalid_name' }
  }

  const telephone = str(q.phone || q.telephone || q.mobile)
  if (!isValidTelephone(telephone)) return { ok: false, reason: 'missing_or_invalid_telephone' }

  const email = str(q.email)
  if (!isValidEmail(email)) return { ok: false, reason: 'missing_or_invalid_email' }

  const collectionAddress = str(q.pickup_address)
  const deliveryAddress = str(q.delivery_address)
  if (!isRealAddress(collectionAddress) || !isRealAddress(deliveryAddress)) {
    return { ok: false, reason: 'missing_addresses' }
  }

  if (!isRealMoveDate(q.move_date)) return { ok: false, reason: 'missing_move_date' }

  const items = [
    ...extractGenuineInventoryItems(extraInventoryRows),
    ...extractGenuineInventoryItems(q.inventory, q.inventory_text),
  ]
  // Dedup again after merge
  const merged = extractGenuineInventoryItems(items.map((i) => ({ name: i.name, quantity: i.quantity })))
  if (!merged.length) return { ok: false, reason: 'missing_inventory' }

  const volumeM3 = volumeFromQuote(q)
  if (!(volumeM3 > 0)) return { ok: false, reason: 'missing_volume' }

  const moversCount = moversFromQuote(q)
  if (!(moversCount > 0)) return { ok: false, reason: 'missing_movers' }

  const priceGbp = priceFromQuote(q)
  if (!(priceGbp > 0)) return { ok: false, reason: 'missing_price' }

  const reference = str(q.quote_ref)
  if (!reference || /^(test|demo)/i.test(reference)) {
    return { ok: false, reason: 'missing_reference' }
  }

  return {
    ok: true,
    fields: {
      customerName,
      telephone,
      email,
      collectionAddress,
      deliveryAddress,
      movingDate: formatDateUK(q.move_date),
      inventoryVolume: `${volumeM3.toFixed(2)} m³`,
      inventorySummary: inventorySummary(merged),
      movers: `${moversCount} ${moversCount === 1 ? 'mover' : 'movers'}`,
      quotedPrice: formatMoneyGbp(priceGbp),
      reference,
      volumeM3,
      moversCount,
      priceGbp,
    },
  }
}

type LeadRow = Record<string, unknown>

function wizardStep(lead: LeadRow, step: number): Record<string, unknown> {
  const wd = lead.wizard_data && typeof lead.wizard_data === 'object'
    ? (lead.wizard_data as Record<string, unknown>)
    : {}
  const key = `step${step}`
  const s = wd[key]
  return s && typeof s === 'object' ? (s as Record<string, unknown>) : {}
}

function leadLooksTest(lead: LeadRow): boolean {
  const ref = str(lead.lead_ref || lead.quote_ref)
  if (/(DEMO|TEST)/i.test(ref)) return true
  const name = str(lead.customer_name)
  if (/\bdemo\b/i.test(name) || /\btest\b/i.test(name)) return true
  const email = str(lead.customer_email)
  if (/\bdemo\b/i.test(email) || /@test\./i.test(email)) return true
  return false
}

/**
 * Validate a customer lead before admin "Abandoned Quote" email.
 */
export function validateLeadForAdminAbandonedNotify(lead: LeadRow): ValidationResult {
  if (!lead || typeof lead !== 'object') return { ok: false, reason: 'invalid_lead' }
  if (leadLooksTest(lead)) return { ok: false, reason: 'test_or_demo' }

  const customerName = str(lead.customer_name)
  if (!customerName || looksPlaceholderName(customerName)) {
    return { ok: false, reason: 'missing_or_invalid_name' }
  }

  const telephone = str(lead.customer_phone)
  if (!isValidTelephone(telephone)) return { ok: false, reason: 'missing_or_invalid_telephone' }

  const email = str(lead.customer_email)
  if (!isValidEmail(email)) return { ok: false, reason: 'missing_or_invalid_email' }

  const s1 = wizardStep(lead, 1)
  const collectionAddress = str(lead.pickup_address || s1.pickupAddress || s1.collectionAddress)
  const deliveryAddress = str(lead.delivery_address || s1.deliveryAddress)
  if (!isRealAddress(collectionAddress) || !isRealAddress(deliveryAddress)) {
    return { ok: false, reason: 'missing_addresses' }
  }

  const s3 = wizardStep(lead, 3)
  const moveRaw = lead.move_date || s3.selectedMoveDate || s1.moveDate
  if (!isRealMoveDate(moveRaw)) return { ok: false, reason: 'missing_move_date' }

  const s2 = wizardStep(lead, 2)
  const items = extractGenuineInventoryItems(s2.inventoryLines)
  if (!items.length) return { ok: false, reason: 'missing_inventory' }

  let volumeM3 = Number(lead.total_volume_m3)
  if (!(Number.isFinite(volumeM3) && volumeM3 > 0)) {
    volumeM3 = Number(s2.totalVolumeM3 ?? s2.total_volume_m3)
  }
  if (!(Number.isFinite(volumeM3) && volumeM3 > 0)) {
    return { ok: false, reason: 'missing_volume' }
  }

  const crewRaw = s3.crewSize ?? s2.crewSize ?? lead.crew_size
  const moversCount = Number(crewRaw)
  if (!(Number.isFinite(moversCount) && moversCount > 0)) {
    return { ok: false, reason: 'missing_movers' }
  }

  const agreed = Number(lead.agreed_price)
  const calculated = Number(lead.calculated_total)
  const estimated = Number(lead.estimated_total)
  const priceGbp = [agreed, calculated, estimated].find((n) => Number.isFinite(n) && n > 0) ?? 0
  if (!(priceGbp > 0)) return { ok: false, reason: 'missing_price' }

  const reference = str(lead.lead_ref) || str(lead.quote_ref)
  if (!reference) return { ok: false, reason: 'missing_reference' }

  return {
    ok: true,
    fields: {
      customerName,
      telephone,
      email,
      collectionAddress,
      deliveryAddress,
      movingDate: formatDateUK(moveRaw),
      inventoryVolume: `${volumeM3.toFixed(2)} m³`,
      inventorySummary: inventorySummary(items),
      movers: `${Math.round(moversCount)} ${Math.round(moversCount) === 1 ? 'mover' : 'movers'}`,
      quotedPrice: formatMoneyGbp(priceGbp),
      reference,
      volumeM3,
      moversCount: Math.round(moversCount),
      priceGbp,
    },
  }
}

/** Used by abandoned notify: quote already paid / booked. */
export function quoteIndicatesCompletedBooking(q: QuoteRow | null | undefined): boolean {
  if (!q) return false
  const ps = lower(q.payment_status)
  if (ps === 'paid' || ps === 'deposit_paid') return true
  if (q.paid_at) return true
  const st = str(q.status)
  if (st === 'Booked' || st === 'deposit_paid' || st === 'Completed') return true
  if (q.booking_notification_sent_at) return true
  return false
}
