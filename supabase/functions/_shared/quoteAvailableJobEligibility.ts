/**
 * Server-side rules: quote eligible for admin "new Available Job" email.
 * Mirrors client adminJobListRules + demo/archive filters (DB columns only).
 */

export type QuoteRow = Record<string, unknown>

function str(v: unknown): string {
  return String(v ?? '').trim()
}

function lower(v: unknown): string {
  return str(v).toLowerCase()
}

export function extractUkPostcode(address: unknown): string {
  const s = str(address).replace(/\s+/g, ' ')
  const m = s.match(/([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i)
  return m ? m[1].toUpperCase().replace(/\s+/g, ' ') : ''
}

export function extractCityFromAddress(address: unknown): string {
  const s = str(address)
  if (!s) return ''
  const withoutPc = s.replace(/,?\s*[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\s*$/i, '').trim()
  const parts = withoutPc.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) return parts[parts.length - 1]
  if (parts.length === 1) {
    const words = parts[0].split(/\s+/)
    if (words.length >= 2) return words[words.length - 1]
  }
  return ''
}

export function quoteMatchesDemoOrTest(q: QuoteRow): boolean {
  if (q.is_test === true) return true
  if (q.archived_for_go_live === true) return true

  const ref = str(q.quote_ref)
  if (/(DEMO|TEST)/i.test(ref)) return true

  const name = str(q.full_name || q.customer_name)
  if (/\bdemo\b/i.test(name) || /\btest\b/i.test(name)) return true

  const email = str(q.email)
  if (/\bdemo\b/i.test(email) || /@test\./i.test(email)) return true

  const reason = str(q.admin_cancellation_reason)
  if (/PRE-LAUNCH TEST DATA ARCHIVED/i.test(reason)) return true

  return false
}

export function quoteIsCardPaid(q: QuoteRow): boolean {
  const ps = lower(q.payment_status)
  return ps === 'paid' || ps === 'deposit_paid'
}

export function quoteIsTerminal(q: QuoteRow): boolean {
  if (q.cancelled_at) return true
  if (q.completed_at) return true
  const st = str(q.status)
  if (st === 'Cancelled' || st === 'Completed') return true
  const op = lower(q.operational_status)
  if (op === 'cancelled' || op === 'completed') return true
  const mv = lower(q.marketplace_visibility)
  if (mv === 'cancelled' || mv === 'completed') return true
  return false
}

export function quoteHasAssignee(q: QuoteRow): boolean {
  if (str(q.assigned_driver_id) || str(q.assigned_driver_name)) return true
  if (str(q.assigned_partner_id) || str(q.assigned_partner_company)) return true
  const mv = lower(q.marketplace_visibility)
  if (mv === 'assigned' || mv === 'visible_in_marketplace') return true
  return false
}

/** Same criteria as Available Jobs admin inbox (strict). */
export function quoteEligibleForAdminAvailableJobEmail(q: QuoteRow): boolean {
  if (!q || typeof q !== 'object') return false
  if (quoteMatchesDemoOrTest(q)) return false
  if (!quoteIsCardPaid(q)) return false
  if (quoteIsTerminal(q)) return false
  if (quoteHasAssignee(q)) return false
  if (str(q.bundled_journey_id)) return false
  return true
}

export function parsePricingVolumeM3(pricing: unknown): number | null {
  const raw = str(pricing)
  if (!raw) return null
  for (const line of raw.split('\n')) {
    const vol = line.match(/total\s*([\d.]+)\s*m³/i)
    if (vol) {
      const n = parseFloat(vol[1])
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

export function formatVolumeAndCrewLine(q: QuoteRow): string {
  const volM3 =
    parsePricingVolumeM3(q.pricing) ??
    (q.total_cubic_metres != null && Number.isFinite(Number(q.total_cubic_metres))
      ? Number(q.total_cubic_metres)
      : null)
  const vol = volM3 != null && volM3 > 0 ? `${volM3.toFixed(2)} m³` : null
  const crewN = Number(q.crew_size)
  const crew = Number.isFinite(crewN) && crewN > 0 ? `${crewN} ${crewN === 1 ? 'person' : 'people'}` : null
  if (vol && crew) return `${vol} · ${crew}`
  if (vol) return vol
  if (crew) return crew
  return '—'
}

export function paymentStatusLabel(q: QuoteRow): string {
  const ps = lower(q.payment_status)
  if (ps === 'paid') return 'Fully paid'
  if (ps === 'deposit_paid') return 'Deposit paid'
  return str(q.payment_status) || 'Paid'
}

export function formatMoneyGbp(amount: unknown): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  return `£${n.toFixed(2)}`
}

export function estimatedTotalFromQuote(q: QuoteRow): string {
  if (q.estimated_total != null && Number.isFinite(Number(q.estimated_total))) {
    return formatMoneyGbp(q.estimated_total)
  }
  const raw = str(q.pricing)
  const m = raw.match(/estimated total:\s*£([\d,]+(?:\.\d{1,2})?)/i)
  if (m) {
    const n = parseFloat(m[1].replace(/,/g, ''))
    if (Number.isFinite(n)) return formatMoneyGbp(n)
  }
  return '—'
}

export function locationLabel(address: unknown): string {
  const pc = extractUkPostcode(address)
  const city = extractCityFromAddress(address)
  if (city && pc) return `${city} · ${pc}`
  if (pc) return pc
  if (city) return city
  const line = str(address)
  return line.length > 48 ? `${line.slice(0, 45)}…` : line || '—'
}
