/**
 * Cash invoice decisions. The PDF and email stay on the saved booking price.
 * A failed email can send the stored PDF again. A sent invoice is not rebuilt.
 */

export const CASH_INVOICE_EVENT = 'cash_paid_invoice'
export const CASH_INVOICE_FILE_KEY = 'cash-paid'
export const PAID_INVOICE_EVENT = 'paid_invoice'
export const PAID_INVOICE_FILE_KEY = 'paid'
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

function collectedMethod(row) {
  return String(row?.method || '').toLowerCase()
}

export function invoiceKind(quote, collections) {
  const rows = collections || []
  const type = String(quote?.payment_type || '').toLowerCase()
  if (rows.some((row) => collectedMethod(row) === 'cash') || type === 'cash') return 'cash'
  if (rows.some((row) => collectedMethod(row) === 'card') || type === 'card') return 'card'
  if (rows.some((row) => collectedMethod(row) === 'bank_transfer') || type === 'bank_transfer') return 'bank_transfer'
  return 'paid'
}

export function invoiceEventKey(kind) {
  return kind === 'cash' ? CASH_INVOICE_EVENT : PAID_INVOICE_EVENT
}

export function invoiceFileKey(kind) {
  return kind === 'cash' ? CASH_INVOICE_FILE_KEY : PAID_INVOICE_FILE_KEY
}

export function invoiceStoragePath(quoteId, kind) {
  return `${String(quoteId || '').trim()}/${invoiceFileKey(kind || 'cash')}.pdf`
}

export function invoicePaidMark(kind) {
  if (kind === 'cash') return CASH_PAID_MARK
  if (kind === 'card') return 'PAID - Card'
  if (kind === 'bank_transfer') return 'PAID - Bank transfer'
  return 'PAID'
}

export function invoicePaymentTypeLabel(kind) {
  if (kind === 'cash') return 'Cash'
  if (kind === 'card') return 'Card'
  if (kind === 'bank_transfer') return 'Bank transfer'
  return 'Paid'
}

export function amountRecorded(quote, collections) {
  const paid = Number(quote?.amount_paid)
  const fromQuote = Number.isFinite(paid) && paid > 0 ? roundGbp(paid) : 0
  const fromRows = roundGbp((collections || []).reduce((sum, row) => sum + (Number(row?.amount) || 0), 0))
  return roundGbp(Math.max(fromQuote, fromRows))
}

export function cashInvoiceEligibility(quote, collections) {
  if (!balanceIsSettled(quote?.remaining_balance)) return { ok: false, reason: 'balance_remaining' }
  const cashRows = (collections || []).filter((row) => collectedMethod(row) === 'cash')
  const type = String(quote?.payment_type || '').toLowerCase()
  if (cashRows.length === 0 && type !== 'cash') return { ok: false, reason: 'not_cash' }
  return { ok: true, cashRows, kind: 'cash' }
}

/** Cash invoice when the driver has marked the job completed and the cash balance is cleared. */
export function completionInvoiceEligibility(quote, collections) {
  const completed =
    Boolean(quote?.completed_at) ||
    String(quote?.status || '').toLowerCase() === 'completed' ||
    String(quote?.operational_status || '').toLowerCase() === 'completed'
  if (!completed) return { ok: false, reason: 'not_completed' }
  if (!balanceIsSettled(quote?.remaining_balance)) return { ok: false, reason: 'balance_remaining' }
  if (invoiceKind(quote, collections) !== 'cash') return { ok: false, reason: 'not_cash' }
  return { ok: true, kind: 'cash' }
}

/**
 * Second invoice after a reservation fee. The first email is the partial invoice.
 * This one goes out only when that same booking is later paid in full.
 */
export function balanceSettledInvoiceEligibility(quote, collections) {
  if (!balanceIsSettled(quote?.remaining_balance)) return { ok: false, reason: 'balance_remaining' }
  if (String(quote?.payment_type || '').toLowerCase() !== 'deposit') return { ok: false, reason: 'not_deposit' }
  if (amountRecorded(quote, collections) <= 0) return { ok: false, reason: 'not_paid' }
  return { ok: true, kind: 'card' }
}

/** Card invoice once the balance is zero. A Stripe receipt already sent is not sent again. */
export function cardSettledInvoiceEligibility(quote, collections) {
  if (!balanceIsSettled(quote?.remaining_balance)) return { ok: false, reason: 'balance_remaining' }
  if (quote?.payment_confirmation_email_sent_at) return { ok: false, reason: 'already_sent' }
  const kind = invoiceKind(quote, collections)
  if (kind === 'cash' || kind === 'bank_transfer') return { ok: false, reason: 'not_card' }
  const card =
    kind === 'card' ||
    String(quote?.payment_type || '').toLowerCase() === 'full' ||
    Boolean(String(quote?.stripe_payment_intent_id || '').trim())
  if (!card) return { ok: false, reason: 'not_card' }
  if (amountRecorded(quote, collections) <= 0) return { ok: false, reason: 'not_paid' }
  return { ok: true, kind: 'card' }
}

/** Admin button. A settled cash, card, or bank payment can be invoiced. */
export function manualInvoiceEligibility(quote, collections) {
  if (!balanceIsSettled(quote?.remaining_balance)) return { ok: false, reason: 'balance_remaining' }
  const kind = invoiceKind(quote, collections)
  if (kind !== 'cash' && amountRecorded(quote, collections) <= 0) return { ok: false, reason: 'not_paid' }
  return { ok: true, kind }
}

export function discountNotes(pricing) {
  return String(pricing || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /discount|promo code/i.test(line) && !/best price/i.test(line))
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
  return invoiceStoragePath(quoteId, 'cash')
}

export function settledInvoiceFigures(quote, collections) {
  const kind = invoiceKind(quote, collections)
  const base = cashInvoiceFigures(quote, collections)
  if (kind === 'cash') return { ...base, kind }
  const paid = amountRecorded(quote, collections)
  const saved = savedFinalPrice(quote)
  return {
    kind,
    total: saved ?? paid,
    paid,
    cash: 0,
    advance: 0,
    remaining: 0,
    discounts: discountNotes(quote?.pricing),
    paidAt:
      quote?.paid_at ||
      (collections || [])
        .map((row) => String(row?.collected_at || ''))
        .filter(Boolean)
        .sort()
        .at(-1) ||
      null,
  }
}

export function invoiceSummaryLines(figures) {
  if (figures?.kind === 'cash') {
    return [
      ...(figures.advance > 0 ? [`Advance paid: GBP ${Number(figures.advance).toFixed(2)}`] : []),
      `Cash received: GBP ${Number(figures.cash).toFixed(2)}`,
    ]
  }
  return [`Amount paid: GBP ${Number(figures?.paid || 0).toFixed(2)}`]
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
  const eligibility = ctx.onCompleted
    ? completionInvoiceEligibility(quote, collections)
    : ctx.onBalanceSettled
      ? balanceSettledInvoiceEligibility(quote, collections)
      : ctx.onCardSettled
        ? cardSettledInvoiceEligibility(quote, collections)
        : ctx.manual
          ? manualInvoiceEligibility(quote, collections)
          : cashInvoiceEligibility(quote, collections)
  if (!eligibility.ok) return { ok: false, skipped: true, error: eligibility.reason }

  const email = customerInvoiceEmail(quote)
  if (!email) return { ok: false, skipped: true, error: 'missing_email' }

  const figures = settledInvoiceFigures(quote, collections)
  if (eligibility.kind) figures.kind = eligibility.kind
  const existing = await ctx.loadNotification(figures)
  if (String(existing?.delivery_status || '') === 'sent') {
    await ctx.repairArchive(figures)
    return { ok: true, skipped: true, error: 'already_sent' }
  }

  let pdf = await ctx.readStoredPdf(figures)
  if (!pdf?.length) {
    pdf = await ctx.buildPdf({ quote, figures })
    if (!pdf?.length) return { ok: false, error: 'pdf_failed' }
    const stored = await ctx.storePdf(pdf, figures)
    if (!stored) return { ok: false, error: 'pdf_store_failed' }
  }

  const claim = await ctx.claim(figures)
  if (!claim?.claimed) {
    if (claim?.reason === 'already_sent') {
      await ctx.repairArchive(figures)
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
