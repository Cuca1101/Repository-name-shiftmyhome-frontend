import type Stripe from 'npm:stripe@14.21.0'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { renderTransactionalEmailTemplate } from './transactionalEmailTemplates.ts'
import { sendResendEmailMinimal } from './postResendEmail.ts'
import { asciiEmailSubject, encodePdfBytesToResendBase64 } from './resendPayloadLog.ts'
import { formatDateUK } from './formatDateUK.ts'
import { saveCustomerEmailArchive, storeSentInvoicePdf } from './customerEmailArchive.ts'
import { buildPortalMagicUrl } from './customerPortalMagicLink.ts'
import { renderInvoicePdf } from './invoicePdfDraw.ts'

type UpdateResult = {
  ok: boolean
  quote_id?: string | null
}

type QuoteRow = {
  id: string
  quote_ref: string | null
  full_name: string | null
  email: string | null
  phone: string | null
  pickup_address: string | null
  delivery_address: string | null
  move_date: string | null
  service: string | null
  crew_size: number | null
  vehicle_size: string | null
  arrival_window: string | null
  details: string | null
  inventory_text: string | null
  pricing: string | null
  amount_paid: number | null
  payment_type: string | null
  paid_at: string | null
  completed_at?: string | null
  inventory?: unknown
  payment_confirmation_email_sent_at: string | null
  payment_confirmation_email_intent_id?: string | null
  service_type: string | null
  estimated_total: number | null
  remaining_balance: number | null
  agreed_price?: number | string | null
  price_override_reason?: string | null
  service_package_snapshot?: Record<string, unknown> | null
}

type QuoteStopRow = {
  stop_type: 'pickup' | 'delivery'
  contact_name: string | null
  contact_phone: string | null
  address_line_1: string | null
  floor: string | null
  lift_available: boolean | null
  parking_type: string | null
  walking_distance: string | null
  date_time_window: string | null
  access_notes: string | null
}

type QuoteInventoryItemRow = {
  item_name: string
  quantity: number | null
  volume_m3: number | null
  size_category: string | null
  weight_category: string | null
  notes: string | null
}

type QuoteRequirementRow = {
  requirement_type: string
  description: string
}

type QuotePricingRow = {
  crew_count: number | null
  crew_label: string | null
  vehicle_size: string | null
  total_price: number | null
  remaining_balance: number | null
}

function asText(v: unknown) {
  return typeof v === 'string' ? v.trim() : ''
}

function envOrDefault(key: string, fallback: string) {
  const v = (Deno.env.get(key) || '').trim()
  return v || fallback
}

async function loadInvoiceLogo(explicit?: Uint8Array) {
  if (explicit?.byteLength) return explicit
  const url = envOrDefault('INVOICE_LOGO_URL', 'https://www.shiftmyhome.co.uk/email-logo.png')
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return undefined
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return undefined
    return bytes
  } catch {
    return undefined
  }
}

function pickCustomerEmail(pi: Stripe.PaymentIntent, fallback?: string | null) {
  const receipt = asText(pi.receipt_email)
  if (receipt) return receipt
  const meta = asText(pi.metadata?.customer_email)
  if (meta) return meta
  return asText(fallback)
}

function pickQuoteRef(pi: Stripe.PaymentIntent, quoteRef?: string | null) {
  const fromQuote = asText(quoteRef)
  if (fromQuote) return fromQuote
  const fromMeta = asText(pi.metadata?.quote_ref)
  if (fromMeta) return fromMeta
  return 'SMH-BOOKING'
}

function parsePounds(text: string, patterns: RegExp[]) {
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) {
      const n = Number(m[1].replace(/,/g, ''))
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function formatDateISO(isoDate: string) {
  // Display-only UK calendar date; storage remains YYYY-MM-DD.
  return formatDateUK(isoDate)
}

function todayDateUK() {
  return new Date().toLocaleDateString('en-GB')
}

function pounds(n: number | null) {
  if (!Number.isFinite(Number(n))) return '-'
  return `\u00A3${Number(n).toFixed(2)}`
}

const UK_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatLongUkDate(value: unknown) {
  const text = String(value || '').trim()
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return ''
  const month = UK_MONTHS[Number(match[2]) - 1]
  if (!month) return ''
  return `${Number(match[3])} ${month} ${match[1]}`
}

function formatLongUkDateTime(value: unknown) {
  const text = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(text)) return formatLongUkDate(text)
  const date = new Date(text.includes('T') ? text : text.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return formatLongUkDate(text)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return `${Number(pick('day'))} ${pick('month')} ${pick('year')}, ${pick('hour')}:${pick('minute')}`
}

function invoicePaymentStatus(paid: number, remaining: number | null) {
  const paidN = Number(paid) || 0
  const rem = Number(remaining)
  if (paidN > 0.009 && Number.isFinite(rem) && rem <= 0.009) return 'PAID'
  if (paidN > 0.009) return 'PARTIALLY PAID'
  return 'UNPAID'
}

/** StandardFonts Helvetica uses WinAnsi. Dashes and minus signs are mapped so they are not drawn as "?". */
function pdfSafeText(text: string): string {
  const mapped = String(text ?? '')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/\u00D7/g, 'x')
  let out = ''
  for (const ch of mapped) {
    const cp = ch.codePointAt(0) ?? 63
    out += cp <= 255 ? ch : '-'
  }
  return out
}

const MIN_VALID_PDF_BYTES = 256

async function sha256Hex(bytes: Uint8Array) {
  const buf = bytes.slice()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function errorDetails(e: unknown) {
  if (e instanceof Error) {
    return {
      message: e.message,
      stack: e.stack || '',
      name: e.name || 'Error',
    }
  }
  return {
    message: String(e),
    stack: '',
    name: 'UnknownError',
  }
}

async function resolveEmailLogoUrl(candidateUrl: string) {
  const url = asText(candidateUrl)
  if (!url) return ''
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(3500) })
    if (!res.ok) return ''
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    if (ct.includes('image/')) return url
    return ''
  } catch {
    return ''
  }
}

export async function buildBookingConfirmationPdf(params: {
  quote: QuoteRow
  stops?: QuoteStopRow[]
  inventoryItems?: QuoteInventoryItemRow[]
  requirements?: QuoteRequirementRow[]
  pricing?: QuotePricingRow | null
  invoiceNumber: string
  quoteRef: string
  paymentStatusLabel: string
  amountPaidGbp: number
  estimatedTotalGbp: number | null
  remainingBalanceGbp: number | null
  paymentType: string
  statusBadge?: string
  paymentTypeLabel?: string
  totalCaption?: string
  extraSummaryLines?: string[]
  logoPng?: Uint8Array
}) {
  const {
    quote,
    stops = [],
    inventoryItems = [],
    requirements = [],
    pricing = null,
    invoiceNumber,
    quoteRef,
    paymentStatusLabel,
    amountPaidGbp,
    estimatedTotalGbp,
    remainingBalanceGbp,
    paymentType,
    statusBadge = '',
    paymentTypeLabel = '',
    totalCaption = '',
    extraSummaryLines = [],
    logoPng,
  } =
    params
  const moveDate = formatDateISO(asText(quote.move_date))
  const paidDate = quote.paid_at ? new Date(quote.paid_at).toLocaleString('en-GB') : todayDateUK()
  const companyName = envOrDefault('COMPANY_NAME', 'ShiftMyHome')
  const companyWebsite = envOrDefault('COMPANY_WEBSITE', 'https://shiftmyhome.co.uk')
  const companyEmail = envOrDefault('COMPANY_SUPPORT_EMAIL', envOrDefault('COMPANY_EMAIL', 'admin@shiftmyhome.co.uk'))
  const site = companyWebsite.replace(/\/$/, '')
  const termsUrl = envOrDefault('TERMS_URL', envOrDefault('COMPANY_TERMS_URL', `${site}/terms`))
  void statusBadge
  void totalCaption
  void extraSummaryLines
  void requirements
  void paidDate
  void companyName
  void paymentStatusLabel
  void pricing

  console.log('[payment-email] pdf-lib render started', { mode: 'invoice-template' })
  try {
    const companyNumber = envOrDefault('COMPANY_NUMBER', '')
    const vatNumber = envOrDefault('COMPANY_VAT_NUMBER', '')
    const bytes = await renderInvoicePdf({
      quote: {
        ...quote,
        issued_on_label: formatLongUkDate(new Date().toISOString()),
        move_date_label: formatLongUkDate(quote.move_date) || moveDate,
        paid_on_label: formatLongUkDateTime(quote.completed_at || quote.paid_at),
      },
      stops,
      inventoryItems,
      quoteRef,
      invoiceNumber,
      amountPaidGbp,
      invoiceTotalGbp:
        Number.isFinite(Number(quote.agreed_price)) && Number(quote.agreed_price) > 0
          ? Number(quote.agreed_price)
          : estimatedTotalGbp,
      remainingBalanceGbp,
      paymentTypeLabel:
        paymentTypeLabel ||
        (paymentType === 'cash'
          ? 'Cash'
          : paymentType === 'bank_transfer'
            ? 'Bank transfer'
            : paymentType === 'card'
              ? 'Card'
              : paymentType === 'deposit'
                ? 'Deposit'
                : ''),
      logoPng: await loadInvoiceLogo(logoPng),
      company: {
        legalName: 'ShiftMyHome Ltd',
        address: '128 City Road, London, EC1V 2NX',
        companyNumber: companyNumber && companyNumber.toUpperCase() !== 'N/A' ? companyNumber : '16730159',
        vatNumber: vatNumber && vatNumber.toUpperCase() !== 'N/A' ? vatNumber : '',
        email: companyEmail,
        website: companyWebsite,
        termsUrl,
      },
    })
    if (!bytes?.length || bytes.length < MIN_VALID_PDF_BYTES) {
      throw new Error(`pdf save returned invalid buffer (length=${bytes?.length ?? 0})`)
    }
    console.log('[payment-email] pdf-lib render success', { bytes: bytes.length })
    return bytes
  } catch (e) {
    const detail = errorDetails(e)
    console.error('[payment-email] pdf-lib render failed', detail)
    throw e
  }
}

export async function sendPaymentConfirmationWithPdfIfNeeded(params: {
  supabase: SupabaseClient
  paymentIntent: Stripe.PaymentIntent
  updateResult: UpdateResult
  resendApiKey: string
  resendFromEmail: string
}) {
  const { supabase, paymentIntent, updateResult, resendApiKey, resendFromEmail } = params
  if (asText(paymentIntent.metadata?.payment_type) === 'balance') {
    return { sent: false, reason: 'balance_payment' as const }
  }
  const metadataQuoteRef = asText(paymentIntent.metadata?.quote_ref)
  const metadataQuoteId = asText(paymentIntent.metadata?.quote_id)
  console.log('[payment-email] start', {
    payment_intent_id: paymentIntent.id,
    update_result_quote_id: updateResult.quote_id ?? null,
    metadata_quote_id: metadataQuoteId || null,
    metadata_quote_ref: metadataQuoteRef || null,
    update_ok: updateResult.ok,
    resend_configured: Boolean(resendApiKey),
  })
  if (!resendApiKey) {
    console.log('[payment-email] skipped - missing preconditions')
    return { sent: false, reason: 'skipped' as const, debug: { stage: 'preconditions' } }
  }

  const quoteSelect =
    'id, quote_ref, full_name, email, phone, pickup_address, delivery_address, move_date, service, service_type, crew_size, vehicle_size, arrival_window, details, inventory_text, inventory, pricing, amount_paid, payment_type, paid_at, completed_at, payment_confirmation_email_sent_at, payment_confirmation_email_intent_id, estimated_total, remaining_balance, agreed_price, price_override_reason, service_package_snapshot'
  let quote: QuoteRow | null = null
  /** Prefer Stripe metadata.quote_ref so idempotency matches the row you inspect in the dashboard (updateResult.quote_id can point at a different row if metadata.quote_id was wrong/stale). */
  let quoteLookupVia: 'metadata_quote_ref' | 'metadata_quote_id' | 'update_result_quote_id' | null = null

  if (metadataQuoteRef) {
    const { data } = await supabase.from('quotes').select(quoteSelect).eq('quote_ref', metadataQuoteRef).maybeSingle<QuoteRow>()
    if (data?.id) {
      quote = data
      quoteLookupVia = 'metadata_quote_ref'
    }
  }
  if (!quote && metadataQuoteId) {
    const { data } = await supabase.from('quotes').select(quoteSelect).eq('id', metadataQuoteId).maybeSingle<QuoteRow>()
    if (data?.id) {
      quote = data
      quoteLookupVia = 'metadata_quote_id'
    }
  }
  const fallbackQuoteId = asText(updateResult.quote_id)
  if (!quote && fallbackQuoteId) {
    const { data } = await supabase.from('quotes').select(quoteSelect).eq('id', fallbackQuoteId).maybeSingle<QuoteRow>()
    if (data?.id) {
      quote = data
      quoteLookupVia = 'update_result_quote_id'
    }
  }

  if (metadataQuoteRef && quote?.quote_ref && quote.quote_ref !== metadataQuoteRef) {
    console.warn('[payment-email] loaded quote_ref does not match PaymentIntent metadata.quote_ref', {
      loaded_quote_ref: quote.quote_ref,
      metadata_quote_ref: metadataQuoteRef,
      quote_lookup_via: quoteLookupVia,
    })
  }
  if (metadataQuoteId && quote?.id && quote.id !== metadataQuoteId) {
    console.warn('[payment-email] loaded quote id does not match PaymentIntent metadata.quote_id', {
      loaded_quote_id: quote.id,
      metadata_quote_id: metadataQuoteId,
      quote_lookup_via: quoteLookupVia,
    })
  }

  if (!quote?.id) {
    return {
      sent: false,
      reason: 'quote_missing' as const,
      debug: { stage: 'quote_lookup', metadata_quote_ref: metadataQuoteRef || null, metadata_quote_id: metadataQuoteId || null },
    }
  }

  console.log('[payment-email] quote resolved', {
    quote_lookup_via: quoteLookupVia,
    quote_id: quote.id,
    quote_ref: quote.quote_ref ?? null,
    payment_confirmation_email_sent_at: quote.payment_confirmation_email_sent_at ?? null,
    payment_confirmation_email_intent_id: quote.payment_confirmation_email_intent_id ?? null,
  })

  if (quote.payment_confirmation_email_sent_at && quote.payment_confirmation_email_intent_id === paymentIntent.id) {
    console.log('[payment-email] skipped - already sent', {
      quote_id: quote.id,
      quote_ref: quote.quote_ref ?? null,
      quote_lookup_via: quoteLookupVia,
      sent_at: quote.payment_confirmation_email_sent_at,
      sent_intent_id: quote.payment_confirmation_email_intent_id || null,
      payment_intent_id: paymentIntent.id,
    })
    return { sent: false, reason: 'already_sent' as const }
  }
  if (quote.payment_confirmation_email_sent_at && quote.payment_confirmation_email_intent_id !== paymentIntent.id) {
    console.log('[payment-email] prior email sent for different intent; continuing', {
      quote_id: quote.id,
      previous_sent_at: quote.payment_confirmation_email_sent_at,
      previous_intent_id: quote.payment_confirmation_email_intent_id || null,
      payment_intent_id: paymentIntent.id,
    })
  }

  const customerEmail = pickCustomerEmail(paymentIntent, quote.email)
  if (!customerEmail) {
    console.warn('[payment-email] skipped - no customer email')
    return { sent: false, reason: 'email_missing' as const, debug: { stage: 'customer_email' } }
  }

  const [{ data: stopsData }, { data: inventoryItemsData }, { data: requirementsData }, { data: pricingData }] = await Promise.all([
    supabase
      .from('quote_stops')
      .select('stop_type, contact_name, contact_phone, address_line_1, floor, lift_available, parking_type, walking_distance, date_time_window, access_notes')
      .eq('quote_id', quote.id),
    supabase
      .from('quote_inventory_items')
      .select('item_name, quantity, volume_m3, size_category, weight_category, notes')
      .eq('quote_id', quote.id),
    supabase.from('quote_requirements').select('requirement_type, description').eq('quote_id', quote.id),
    supabase
      .from('quote_pricing')
      .select('crew_count, crew_label, vehicle_size, total_price, remaining_balance')
      .eq('quote_id', quote.id)
      .maybeSingle(),
  ])

  const quoteRef = pickQuoteRef(paymentIntent, quote.quote_ref)
  const amountPaidGbp = Math.max(0, (paymentIntent.amount_received ?? paymentIntent.amount ?? 0) / 100)
  const paymentType = asText(quote.payment_type) || asText(paymentIntent.metadata?.payment_type) || 'full'
  const paymentStatusLabel = paymentType === 'deposit' ? 'Reservation paid' : 'Paid'

  const pricingText = asText(quote.pricing)
  // Migration 091 copied remaining_balance into agreed_price; on website deposit bookings that is the balance, not the total.
  const agreedIsMigratedBalance =
    paymentType === 'deposit' &&
    /^Migrated from remaining_balance/i.test(asText(quote.price_override_reason)) &&
    Math.abs(Number(quote.agreed_price) - Number(quote.remaining_balance)) < 0.01
  const agreedPriceGbp = agreedIsMigratedBalance ? NaN : Number(quote.agreed_price)
  const estimatedTotalGbp =
    (Number.isFinite(agreedPriceGbp) && agreedPriceGbp > 0 ? agreedPriceGbp : null) ??
    parsePounds(pricingText, [
      /Estimated total[^0-9]*([0-9][0-9,]*\.?[0-9]{0,2})/i,
      /Total[^0-9]*([0-9][0-9,]*\.?[0-9]{0,2})/i,
    ]) ?? null
  const remainingBalanceGbp =
    paymentType === 'deposit' && estimatedTotalGbp != null ? Math.max(0, estimatedTotalGbp - amountPaidGbp) : 0

  const invoiceNumber = `SMH-INV-${quoteRef.replace(/[^A-Za-z0-9]/g, '').slice(-12)}-${new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '')}`

  let pdfBase64 = ''
  let pdfBytesForStorage: Uint8Array | null = null
  let pdfAttached = false
  const attachmentFilename = `ShiftMyHome-Invoice-${quoteRef}.pdf`
  let pdfByteSize = 0
  let pdfSha256 = ''
  let pdfHeader = ''
  let pdfDebugStoredPath: string | null = null
  let pdfAttachmentUrl: string | null = null
  let invoiceDownloadUrl: string | null = null
  let invoiceBucket = ''
  try {
    console.log('[payment-email] generating pdf', { quote_ref: quoteRef, invoice_number: invoiceNumber })
    const pdfBytes = await buildBookingConfirmationPdf({
      quote,
      stops: (stopsData || []) as QuoteStopRow[],
      inventoryItems: (inventoryItemsData || []) as QuoteInventoryItemRow[],
      requirements: (requirementsData || []) as QuoteRequirementRow[],
      pricing: (pricingData as QuotePricingRow | null) || null,
      invoiceNumber,
      quoteRef,
      paymentStatusLabel,
      amountPaidGbp,
      estimatedTotalGbp,
      remainingBalanceGbp,
      paymentType,
    })
    pdfByteSize = pdfBytes.length
    pdfBytesForStorage = pdfBytes
    pdfHeader = new TextDecoder().decode(pdfBytes.subarray(0, Math.min(5, pdfBytes.length)))
    pdfSha256 = await sha256Hex(pdfBytes)
    pdfBase64 = encodePdfBytesToResendBase64(new Uint8Array(pdfBytes))
    pdfAttached = true
    console.log('[payment-email] pdf generated', {
      bytes: pdfByteSize,
      base64_length: pdfBase64.length,
      filename: attachmentFilename,
      header: pdfHeader,
      sha256: pdfSha256,
      quote_ref: quoteRef,
    })
  } catch (e) {
    const detail = errorDetails(e)
    pdfAttached = false
    console.error('[payment-email] pdf generation failed, sending without attachment', detail)
  }

  if (pdfAttached && (pdfByteSize < MIN_VALID_PDF_BYTES || !pdfBase64.length)) {
    console.error('[payment-email] pdf attachment discarded (invalid size or base64)', {
      pdfByteSize,
      base64Length: pdfBase64.length,
      quote_ref: quoteRef,
    })
    pdfAttached = false
    pdfBytesForStorage = null
  }

  // Optional storage persistence only. Never affects attachment delivery.
  if (pdfAttached) {
    invoiceBucket = asText(Deno.env.get('INVOICE_STORAGE_BUCKET'))
    if (!invoiceBucket) {
      console.log('[payment-email] storage upload skipped (no invoice bucket configured)')
    } else {
      try {
        const debugPath = `payment-invoices/${new Date().toISOString().slice(0, 10)}/${paymentIntent.id}-${Date.now()}.pdf`
        const up = await supabase.storage
          .from(invoiceBucket)
          .upload(debugPath, pdfBytesForStorage || new Uint8Array(), {
          contentType: 'application/pdf',
          upsert: true,
        })
        if (up.error) {
          console.error('[payment-email] invoice pdf upload failed', {
            bucket: invoiceBucket,
            path: debugPath,
            error: up.error.message,
          })
        } else {
          pdfDebugStoredPath = `${invoiceBucket}/${debugPath}`
          console.log('[payment-email] invoice pdf uploaded', { path: pdfDebugStoredPath })
          try {
            const signed = await supabase.storage.from(invoiceBucket).createSignedUrl(debugPath, 60 * 60 * 24 * 30)
            if (!signed.error && signed.data?.signedUrl) {
              invoiceDownloadUrl = signed.data.signedUrl
              console.log('[payment-email] invoice signed url created', { has_url: true })
            }
          } catch (e) {
            console.error('[payment-email] invoice signed url exception', errorDetails(e))
          }
          if (!invoiceDownloadUrl) {
            try {
              const pub = supabase.storage.from(invoiceBucket).getPublicUrl(debugPath)
              const publicUrl = asText(pub.data?.publicUrl)
              if (publicUrl) invoiceDownloadUrl = publicUrl
            } catch (e) {
              console.error('[payment-email] invoice public url exception', errorDetails(e))
            }
          }
        }
      } catch (e) {
        console.error('[payment-email] storage upload exception (ignored for attachment)', errorDetails(e))
      }
    }
  }

  const companyName = envOrDefault('COMPANY_NAME', 'ShiftMyHome')
  const companyEmail = envOrDefault('COMPANY_SUPPORT_EMAIL', envOrDefault('COMPANY_EMAIL', 'admin@shiftmyhome.co.uk'))
  const companyWebsite = envOrDefault('COMPANY_WEBSITE', 'https://shiftmyhome.co.uk')
  const companyAddress = envOrDefault('COMPANY_ADDRESS', 'Glasgow, Scotland')
  const companyNumber = envOrDefault('COMPANY_NUMBER', 'N/A')
  const site = companyWebsite.replace(/\/$/, '')
  const logoResolved = await resolveEmailLogoUrl(envOrDefault('COMPANY_LOGO_URL', ''))
  console.log('[payment-email] branding snapshot', {
    company_name: companyName,
    company_website: companyWebsite,
    logo_url_configured: Boolean(asText(envOrDefault('COMPANY_LOGO_URL', ''))),
    logo_url_resolved: Boolean(logoResolved),
    resend_from_email: resendFromEmail,
  })
  let portalUrl = ''
  if (quote.id && customerEmail) {
    try {
      const portalLink = await buildPortalMagicUrl(
        supabase,
        customerEmail,
        `/portal/bookings/${quote.id}`,
      )
      if (portalLink.ok) portalUrl = portalLink.url
    } catch (e) {
      console.error('[payment-email] portal link skipped', e instanceof Error ? e.message : e)
    }
  }
  const rendered = renderTransactionalEmailTemplate({
    kind: 'payment_received',
    brand: {
      companyName,
      supportEmail: companyEmail,
      websiteUrl: companyWebsite,
      companyAddress,
      companyNumber,
      logoUrl: logoResolved,
      termsUrl: envOrDefault('TERMS_URL', envOrDefault('COMPANY_TERMS_URL', `${site}/terms`)),
      privacyUrl: envOrDefault('PRIVACY_URL', envOrDefault('COMPANY_PRIVACY_URL', `${site}/privacy`)),
      contactUrl: envOrDefault('CONTACT_URL', envOrDefault('COMPANY_CONTACT_URL', `${site}/contact`)),
    },
    paymentPayload: {
      quoteRef,
      paymentStatus: paymentStatusLabel,
      collectionSummary: asText(quote.pickup_address) || '-',
      deliverySummary: asText(quote.delivery_address) || '-',
      packageSummary: (() => {
        const snap = quote.service_package_snapshot
        if (!snap || typeof snap !== 'object') return ''
        const name = String(snap.display_name || snap.service_package || '').trim()
        const fee = Number(snap.service_package_fee)
        if (!name) return ''
        return Number.isFinite(fee) && fee > 0 ? `${name} upgrade £${fee.toFixed(2)}` : name
      })(),
      portalUrl,
    },
  })
  console.log('[payment-email] template rendered', {
    subject: rendered.subject,
    html_len: rendered.html.length,
    text_len: rendered.text.length,
  })

  console.log('[payment-email] sending via resend', {
    quote_ref: quoteRef,
    to: customerEmail,
    payment_intent_id: paymentIntent.id,
  })
  /** Identical `{ filename, content }` attachment rows + POST path as `resend-pdf-attachment-test` (`sendResendEmailMinimal`). */
  const attachments = pdfAttached
    ? [{ filename: attachmentFilename, content: pdfBase64 }]
    : []

  const subjectForResend = asciiEmailSubject(rendered.subject)
  if (subjectForResend !== rendered.subject) {
    console.warn('[payment-email] subject normalized to ASCII for Resend', {
      before_len: rendered.subject.length,
      after: subjectForResend,
    })
  }

  const resendResult = await sendResendEmailMinimal({
    logTag: 'payment-email',
    apiKey: resendApiKey,
    from: resendFromEmail,
    to: [customerEmail],
    subject: subjectForResend,
    html: rendered.html,
    text: rendered.text,
    attachments,
  })

  if (!resendResult.ok) {
    let detail = resendResult.bodyText
    try {
      const j = JSON.parse(resendResult.bodyText) as { message?: string }
      if (typeof j?.message === 'string') detail = j.message
    } catch {
      /* raw text */
    }
    const msg = detail || `Resend failed (${resendResult.status})`
    console.error('[payment-email] resend failed', {
      status: resendResult.status,
      status_text: resendResult.statusText,
      error: msg,
      response_body: resendResult.bodyText,
      request_id: resendResult.requestId || null,
      context: {
        quote_ref: quoteRef,
        quote_id: quote.id,
        payment_intent_id: paymentIntent.id,
        to: customerEmail,
        from: resendFromEmail,
        attachment_included: pdfAttached,
      },
    })
    throw new Error(msg)
  }

  const resendId = resendResult.resendId
  const resendResponseBody = resendResult.bodyText
  console.log('[payment-email] resend accepted', {
    attachment_included: pdfAttached,
    resend_id: resendId || null,
  })

  if (!pdfAttached || attachments.length === 0) {
    console.warn('[payment-email] resend delivered without attachment; not marking quote as sent', {
      quote_id: quote.id,
      quote_ref: quoteRef,
      payment_intent_id: paymentIntent.id,
      attachment_included: pdfAttached,
      attachment_count: attachments.length,
    })
    return {
      sent: false as const,
      reason: 'attachment_missing' as const,
      quoteRef,
      debug: {
        pdf: {
          attached: pdfAttached,
          bytes: pdfByteSize,
          base64Length: pdfBase64.length,
          filename: attachmentFilename,
          mimeType: 'application/pdf',
          header: pdfHeader,
          sha256: pdfSha256,
          storedPath: pdfDebugStoredPath,
          signedUrl: pdfAttachmentUrl,
        },
        resend: {
          id: resendId || null,
          attachmentCount: attachments.length,
          rawResponse: resendResponseBody || null,
        },
      },
    }
  }

  const sentAt = new Date().toISOString()
  await supabase
    .from('quotes')
    .update({
      payment_confirmation_email_sent_at: sentAt,
      payment_confirmation_email_provider: 'resend',
      payment_confirmation_email_intent_id: paymentIntent.id,
    })
    .eq('id', quote.id)
    .is('payment_confirmation_email_sent_at', null)
  console.log('[payment-email] marked sent in db', { quote_id: quote.id, payment_intent_id: paymentIntent.id })

  try {
    let storedInvoice: { bucket: string; path: string; filename: string } | null = null
    if (pdfAttached && pdfBytesForStorage) {
      storedInvoice = await storeSentInvoicePdf(
        supabase,
        quote.id,
        paymentIntent.id,
        pdfBytesForStorage,
        attachmentFilename,
      )
    }
    const eventKey = `payment_confirmation:${paymentIntent.id}`
    const { data: note, error: noteError } = await supabase
      .from('job_customer_notifications')
      .insert({
        quote_id: quote.id,
        event_key: eventKey,
        event_label: 'Payment confirmation',
        recipient_email: customerEmail,
        provider_message_id: resendId || null,
        delivery_status: 'sent',
        provider_status: 'sent',
        sent_at: sentAt,
        payload: { kind: 'payment_confirmation', payment_intent_id: paymentIntent.id },
      })
      .select('id')
      .maybeSingle()
    if (noteError && noteError.code !== '23505') {
      console.error('[payment-email] notification log failed', noteError.message)
    }
    await saveCustomerEmailArchive(supabase, {
      quoteId: quote.id,
      notificationId: note?.id || null,
      eventKey,
      subject: subjectForResend,
      recipientEmail: customerEmail,
      html: rendered.html,
      text: rendered.text,
      providerMessageId: resendId || null,
      providerStatus: 'sent',
      invoiceBucket: storedInvoice?.bucket || null,
      invoicePath: storedInvoice?.path || null,
      invoiceFilename: storedInvoice?.filename || null,
      sentAt,
    })
  } catch (archiveError) {
    console.error('[payment-email] archive save failed', archiveError)
  }

  return {
    sent: true as const,
    quoteRef,
    debug: {
      pdf: {
        attached: pdfAttached,
        bytes: pdfByteSize,
        base64Length: pdfBase64.length,
        filename: attachmentFilename,
        mimeType: 'application/pdf',
        header: pdfHeader,
        sha256: pdfSha256,
        storedPath: pdfDebugStoredPath,
        signedUrl: pdfAttachmentUrl,
      },
      resend: {
        id: resendId || null,
        attachmentCount: attachments.length,
        rawResponse: resendResponseBody || null,
      },
    },
  }
}
