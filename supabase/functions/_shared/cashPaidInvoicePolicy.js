/**
 * Cash invoice decisions. The PDF and email stay on the saved booking price.
 * A failed email can send the stored PDF again. A sent invoice is not rebuilt.
 */

export const CASH_INVOICE_EVENT = 'cash_paid_invoice'
export const CASH_INVOICE_FILE_KEY = 'cash-paid'
export const CASH_PAID_MARK = 'PAID - Cash'

const PHONE_BOOKING_SNAPSHOT_START = '---SMH_PHONE_BOOKING_WIZARD_JSON---'
const PHONE_BOOKING_SNAPSHOT_END = '---END_SMH_PHONE_BOOKING_WIZARD_JSON---'

function roundGbp(n) {
  return Math.round(Number(n) * 100) / 100
}

function positiveGbp(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return roundGbp(n)
}

function adminCustomPriceFromDetails(details) {
  const text = String(details || '')
  const start = text.indexOf(PHONE_BOOKING_SNAPSHOT_START)
  const end = text.indexOf(PHONE_BOOKING_SNAPSHOT_END, start)
  if (start < 0 || end < 0) return null
  try {
    const parsed = JSON.parse(text.slice(start + PHONE_BOOKING_SNAPSHOT_START.length, end).trim())
    if (!parsed || parsed.useCalculatedPrice !== false) return null
    return positiveGbp(parsed.finalPriceOverride)
  } catch {
    return null
  }
}

/** Same priority as phoneQuoteFinalTotal: the saved final price, including discounts. */
export function savedFinalPrice(quote) {
  const agreed = Number(quote?.agreed_price)
  const remaining = Number(quote?.remaining_balance)
  const migratedBalance =
    /^Migrated from remaining_balance/i.test(String(quote?.price_override_reason || '')) &&
    Number.isFinite(agreed) &&
    Number.isFinite(remaining) &&
    Math.abs(agreed - remaining) < 0.01
  if (!migratedBalance) {
    const agreedPrice = positiveGbp(quote?.agreed_price)
    if (agreedPrice != null) return agreedPrice
  }
  const custom = adminCustomPriceFromDetails(quote?.details)
  if (custom != null) return custom
  const estimated = positiveGbp(quote?.estimated_total)
  const paid = Number(quote?.amount_paid)
  const unpaid = !(Number.isFinite(paid) && paid > 0)
  const remainingPrice = positiveGbp(quote?.remaining_balance)
  if (unpaid && remainingPrice != null && (estimated == null || Math.abs(remainingPrice - estimated) > 0.009)) {
    return remainingPrice
  }
  if (estimated != null) return estimated
  return positiveGbp(quote?.calculated_total)
}

export function balanceIsSettled(remaining) {
  const n = Number(remaining)
  return Number.isFinite(n) && n <= 0.009
}

export function customerInvoiceEmail(quote) {
  const email = String(quote?.email || '').trim()
  if (!email || email.toLowerCase() === 'phone-booking@shiftmyhome.local') return ''
  return email
}

export function cashInvoiceEligibility(quote, collections) {
  if (!balanceIsSettled(quote?.remaining_balance)) return { ok: false, reason: 'balance_remaining' }
  const cashRows = (collections || []).filter((row) => String(row?.method || '').toLowerCase() === 'cash')
  const type = String(quote?.payment_type || '').toLowerCase()
  if (cashRows.length === 0 && type !== 'cash') return { ok: false, reason: 'not_cash' }
  return { ok: true, cashRows }
}

export function discountNotes(pricing) {
  return String(pricing || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /discount|promo code|best price/i.test(line))
    .slice(0, 4)
}

export function cashInvoiceFigures(quote, collections) {
  const rows = (collections || []).filter((row) => String(row?.method || '').toLowerCase() === 'cash')
  const paid = roundGbp(Math.max(0, Number(quote?.amount_paid) || 0))
  const cashFromRows = roundGbp(rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0))
  const type = String(quote?.payment_type || '').toLowerCase()
  const cash = cashFromRows > 0 ? cashFromRows : type === 'cash' ? paid : 0
  const advance = roundGbp(Math.max(0, paid - cash))
  const saved = savedFinalPrice(quote)
  const latest = rows
    .map((row) => String(row.collected_at || ''))
    .filter(Boolean)
    .sort()
    .at(-1)
  return {
    total: saved ?? paid,
    paid,
    cash,
    advance,
    remaining: 0,
    discounts: discountNotes(quote?.pricing),
    paidAt: quote?.paid_at || latest || null,
  }
}

export function cashInvoiceStoragePath(quoteId) {
  return `${String(quoteId || '').trim()}/${CASH_INVOICE_FILE_KEY}.pdf`
}

/**
 * @param {{
 *   loadQuote: () => Promise<Record<string, unknown> | null>,
 *   loadCollections: () => Promise<Array<Record<string, unknown>>>,
 *   loadNotification: () => Promise<{ delivery_status?: string } | null>,
 *   repairArchive: () => Promise<void>,
 *   readStoredPdf: () => Promise<Uint8Array | null>,
 *   buildPdf: (input: { quote: Record<string, unknown>, figures: Record<string, unknown> }) => Promise<Uint8Array | null>,
 *   storePdf: (bytes: Uint8Array) => Promise<boolean>,
 *   claim: () => Promise<{ claimed: boolean, reason?: string }>,
 *   sendEmail: (input: { pdf: Uint8Array, email: string, figures: Record<string, unknown>, quote: Record<string, unknown> }) => Promise<{ ok: boolean, error?: string }>,
 *   markFailed: (error: string) => Promise<void>,
 *   markSent: (sent: Record<string, unknown>) => Promise<void>,
 *   archive: (sent: Record<string, unknown>) => Promise<void>,
 * }} ctx
 */
export async function deliverCashPaidInvoice(ctx) {
  const quote = await ctx.loadQuote()
  if (!quote) return { ok: false, skipped: true, error: 'quote_not_found' }

  const collections = await ctx.loadCollections()
  const eligibility = cashInvoiceEligibility(quote, collections)
  if (!eligibility.ok) return { ok: false, skipped: true, error: eligibility.reason }

  const email = customerInvoiceEmail(quote)
  if (!email) return { ok: false, skipped: true, error: 'missing_email' }

  const existing = await ctx.loadNotification()
  if (String(existing?.delivery_status || '') === 'sent') {
    await ctx.repairArchive()
    return { ok: true, skipped: true, error: 'already_sent' }
  }

  const figures = cashInvoiceFigures(quote, collections)
  let pdf = await ctx.readStoredPdf()
  if (!pdf?.length) {
    pdf = await ctx.buildPdf({ quote, figures })
    if (!pdf?.length) return { ok: false, error: 'pdf_failed' }
    const stored = await ctx.storePdf(pdf)
    if (!stored) return { ok: false, error: 'pdf_store_failed' }
  }

  const claim = await ctx.claim()
  if (!claim?.claimed) {
    if (claim?.reason === 'already_sent') {
      await ctx.repairArchive()
      return { ok: true, skipped: true, error: 'already_sent' }
    }
    return { ok: false, error: claim?.reason || 'claim_failed' }
  }

  const sent = await ctx.sendEmail({ pdf, email, figures, quote })
  if (!sent?.ok) {
    await ctx.markFailed(sent?.error || 'email_failed')
    return { ok: false, error: sent?.error || 'email_failed' }
  }

  await ctx.markSent(sent)
  await ctx.archive(sent)
  return { ok: true, resendId: sent.resendId || null }
}
