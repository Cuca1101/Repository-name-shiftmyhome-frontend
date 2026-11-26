import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildBookingConfirmationPdf } from './paymentConfirmationEmail.ts'
import { saveCustomerEmailArchive, storeSentInvoicePdf } from './customerEmailArchive.ts'
import { sendResendEmailMinimal } from './postResendEmail.ts'
import { renderTransactionalEmailTemplate } from './transactionalEmailTemplates.ts'
import { buildPortalMagicUrl } from './customerPortalMagicLink.ts'
import { isUniqueViolation, notificationClaimDecision } from './deliveryRetryPolicy.js'
import {
  deliverCashPaidInvoice,
  amountRecorded,
  invoiceEventKey,
  invoiceFileKey,
  invoiceKind,
  invoicePaidMark,
  invoicePaymentTypeLabel,
  invoiceStoragePath,
  invoiceSummaryLines,
  savedFinalPrice,
} from './cashPaidInvoicePolicy.js'

function envOrDefault(key: string, fallback: string) {
  const value = (Deno.env.get(key) || '').trim()
  return value || fallback
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function quoteRefOf(quote: Record<string, unknown>) {
  return String(quote.quote_ref || '').trim() || 'SMH-BOOKING'
}

function invoiceLabel(kind: string) {
  return kind === 'cash' ? 'Cash invoice' : 'Invoice'
}

async function claimCashInvoice(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quoteId: string,
  eventKey: string,
  label: string,
) {
  const insert = await supabase.from('job_customer_notifications').insert({
    quote_id: quoteId,
    event_key: eventKey,
    event_label: label,
    delivery_status: 'pending',
  })
  if (!insert.error) return { claimed: true as const }
  if (!isUniqueViolation(insert.error)) return { claimed: false as const, reason: insert.error.message }

  const { data: existing } = await supabase
    .from('job_customer_notifications')
    .select('delivery_status, created_at')
    .eq('quote_id', quoteId)
    .eq('event_key', eventKey)
    .maybeSingle()

  const decision = notificationClaimDecision(existing)
  if (decision === 'already_sent') return { claimed: false as const, reason: 'already_sent' }
  if (decision === 'in_flight') return { claimed: false as const, reason: 'in_flight' }

  await supabase
    .from('job_customer_notifications')
    .delete()
    .eq('quote_id', quoteId)
    .eq('event_key', eventKey)
    .in('delivery_status', ['failed', 'pending'])

  const retry = await supabase.from('job_customer_notifications').insert({
    quote_id: quoteId,
    event_key: eventKey,
    event_label: label,
    delivery_status: 'pending',
  })
  if (!retry.error) return { claimed: true as const }
  if (isUniqueViolation(retry.error)) return { claimed: false as const, reason: 'already_sent' }
  return { claimed: false as const, reason: retry.error.message }
}

async function repairCashArchive(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quoteId: string,
  quote: Record<string, unknown>,
  figures: Record<string, unknown> | null,
) {
  const kind = String(figures?.kind || 'cash')
  const eventKey = invoiceEventKey(kind)
  const path = invoiceStoragePath(quoteId, kind)
  const mark = invoicePaidMark(kind)
  const filename = kind === 'cash' ? `Invoice-${quoteRefOf(quote)}-cash.pdf` : `Invoice-${quoteRefOf(quote)}.pdf`
  const { data: archived } = await supabase
    .from('customer_email_archive')
    .select('id')
    .eq('quote_id', quoteId)
    .eq('invoice_path', path)
    .limit(1)
  if (archived?.length) return
  const { data: note } = await supabase
    .from('job_customer_notifications')
    .select('id, recipient_email, provider_message_id, sent_at')
    .eq('quote_id', quoteId)
    .eq('event_key', eventKey)
    .maybeSingle()
  await saveCustomerEmailArchive(supabase, {
    quoteId,
    notificationId: note?.id || null,
    eventKey,
    subject: `[ShiftMyHome] Payment received (${quoteRefOf(quote)})`,
    recipientEmail: String(note?.recipient_email || quote.email || ''),
    html: `<p>Invoice ${mark} for booking ${quoteRefOf(quote)}.</p>`,
    text: `Invoice ${mark} for booking ${quoteRefOf(quote)}.`,
    providerMessageId: note?.provider_message_id || null,
    providerStatus: 'sent',
    invoiceBucket: 'booking-invoices',
    invoicePath: path,
    invoiceFilename: filename,
    sentAt: note?.sent_at || new Date().toISOString(),
  })
}

export async function buildCurrentInvoicePdf(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quoteId: string,
  options: { paymentTypeLabel?: string } = {},
) {
  const { data: quote } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle()
  if (!quote) return null
  const [{ data: stops }, { data: items }, { data: collections }] = await Promise.all([
    supabase
      .from('quote_stops')
      .select('stop_type, address_line_1, floor, lift_available, parking_type, access_notes')
      .eq('quote_id', quoteId),
    supabase.from('quote_inventory_items').select('item_name, quantity, notes').eq('quote_id', quoteId),
    supabase.from('driver_collected_payments').select('method, amount, collected_at').eq('quote_id', quoteId),
  ])
  const kind = invoiceKind(quote, collections || [])
  const stripeCard =
    Boolean(String(quote.stripe_payment_intent_id || '').trim()) ||
    String(quote.payment_type || '').toLowerCase() === 'full'
  const labelKind = kind === 'paid' && stripeCard ? 'card' : kind
  const total = savedFinalPrice(quote)
  const paid = amountRecorded(quote, collections || [])
  const remaining = Number(quote.remaining_balance)
  const ref = quoteRefOf(quote)
  const bytes = await buildBookingConfirmationPdf({
    quote,
    stops: stops || [],
    inventoryItems: items || [],
    requirements: [],
    pricing: null,
    invoiceNumber: labelKind === 'cash' ? `SMH-INV-${ref}-CASH` : `SMH-INV-${ref}`,
    quoteRef: ref,
    paymentStatusLabel: invoicePaidMark(labelKind),
    amountPaidGbp: paid,
    estimatedTotalGbp: total,
    remainingBalanceGbp: Number.isFinite(remaining) ? Math.max(0, remaining) : null,
    paymentType: labelKind === 'cash' ? 'cash' : labelKind === 'card' ? 'card' : labelKind === 'bank_transfer' ? 'bank_transfer' : '',
    paymentTypeLabel: options.paymentTypeLabel || (paid > 0.009 ? invoicePaymentTypeLabel(labelKind) : ''),
  })
  if (!bytes?.length) return null
  return { bytes, filename: `Invoice-${ref}.pdf` }
}

/** Invoice PDF for a card payment. Cash and bank transfer stay off this attachment. */
export async function cardPaidInvoiceAttachment(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quoteId: string,
) {
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, payment_status, payment_type, stripe_payment_intent_id')
    .eq('id', quoteId)
    .maybeSingle()
  if (!quote) return null
  const status = String(quote.payment_status || '').toLowerCase()
  if (status !== 'paid' && status !== 'deposit_paid') return null
  const { data: collections } = await supabase
    .from('driver_collected_payments')
    .select('method, amount')
    .eq('quote_id', quoteId)
  const kind = invoiceKind(quote, collections || [])
  if (kind === 'cash' || kind === 'bank_transfer') return null
  const type = String(quote.payment_type || '').toLowerCase()
  const stripeCard = Boolean(String(quote.stripe_payment_intent_id || '').trim())
  const card = kind === 'card' || type === 'card' || type === 'full' || type === 'deposit' || stripeCard
  if (!card) return null
  const built = await buildCurrentInvoicePdf(supabase, quoteId)
  if (!built?.bytes?.length) return null
  return { filename: built.filename, content: bytesToBase64(built.bytes) }
}

export async function sendCashPaidInvoice(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quoteId: string,
  options: { manual?: boolean; onCompleted?: boolean; onCardSettled?: boolean; onBalanceSettled?: boolean } = {},
) {
  const manual = Boolean(options.manual)
  const balanceInvoice = Boolean(options.onBalanceSettled)
  let activeKind = 'cash'
  const useKind = (figures?: { kind?: unknown }) => {
    const kind = String(figures?.kind || '')
    if (kind) activeKind = kind
    return activeKind
  }
  return deliverCashPaidInvoice({
    manual,
    onCompleted: Boolean(options.onCompleted),
    onCardSettled: Boolean(options.onCardSettled),
    onBalanceSettled: balanceInvoice,
    async loadQuote() {
      const { data } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle()
      return data || null
    },
    async loadCollections() {
      const { data } = await supabase
        .from('driver_collected_payments')
        .select('method, amount, collected_at')
        .eq('quote_id', quoteId)
      return data || []
    },
    async loadNotification(figures) {
      const { data } = await supabase
        .from('job_customer_notifications')
        .select('delivery_status')
        .eq('quote_id', quoteId)
        .eq('event_key', invoiceEventKey(useKind(figures)))
        .maybeSingle()
      return data || null
    },
    async repairArchive(figures) {
      const { data } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle()
      if (data) await repairCashArchive(supabase, quoteId, data, figures || { kind: activeKind })
    },
    async readStoredPdf(figures) {
      const downloaded = await supabase.storage.from('booking-invoices').download(invoiceStoragePath(quoteId, useKind(figures)))
      if (downloaded.error || !downloaded.data) return null
      const bytes = new Uint8Array(await downloaded.data.arrayBuffer())
      return bytes.length ? bytes : null
    },
    async buildPdf({ quote, figures }) {
      const [{ data: stops }, { data: items }, { data: requirements }] = await Promise.all([
        supabase
          .from('quote_stops')
          .select('stop_type, contact_name, contact_phone, address_line_1, floor, lift_available, parking_type, walking_distance, date_time_window, access_notes')
          .eq('quote_id', quoteId),
        supabase
          .from('quote_inventory_items')
          .select('item_name, quantity, volume_m3, size_category, weight_category, notes')
          .eq('quote_id', quoteId),
        supabase.from('quote_requirements').select('requirement_type, description').eq('quote_id', quoteId),
      ])
      const kind = useKind(figures)
      const mark = invoicePaidMark(kind)
      const paidAt = figures.paidAt || new Date().toISOString()
      try {
      return await buildBookingConfirmationPdf({
        quote: {
          ...quote,
          completed_at: balanceInvoice ? null : quote.completed_at,
          paid_at: balanceInvoice ? new Date().toISOString() : quote.paid_at || paidAt,
          amount_paid: figures.paid,
          remaining_balance: 0,
        },
        stops: stops || [],
        inventoryItems: items || [],
        requirements: requirements || [],
        pricing: null,
        invoiceNumber: kind === 'cash' ? `SMH-INV-${quoteRefOf(quote)}-CASH` : `SMH-INV-${quoteRefOf(quote)}`,
        quoteRef: quoteRefOf(quote),
        paymentStatusLabel: mark,
        amountPaidGbp: Number(figures.paid) || 0,
        estimatedTotalGbp: figures.total,
        remainingBalanceGbp: 0,
        paymentType: kind === 'cash' ? 'cash' : 'full',
        statusBadge: mark,
        paymentTypeLabel: invoicePaymentTypeLabel(kind),
        totalCaption: 'Final price',
        extraSummaryLines: invoiceSummaryLines(figures),
      })
      } catch (error) {
        console.error('[cash-invoice] pdf failed', error)
        return null
      }
    },
    async storePdf(bytes, figures) {
      const stored = await storeSentInvoicePdf(
        supabase,
        quoteId,
        invoiceFileKey(useKind(figures)),
        bytes,
        `Invoice-${quoteId}.pdf`,
      )
      return Boolean(stored?.path)
    },
    claim: (figures) => claimCashInvoice(supabase, quoteId, invoiceEventKey(useKind(figures)), invoiceLabel(useKind(figures))),
    async sendEmail({ pdf, email, quote, figures }) {
      const apiKey = (Deno.env.get('RESEND_API_KEY') || '').trim()
      if (!apiKey) return { ok: false, error: 'email_failed' }
      const from = envOrDefault('RESEND_FROM_EMAIL', 'ShiftMyHome <onboarding@resend.dev>')
      const companyWebsite = envOrDefault('COMPANY_WEBSITE', 'https://shiftmyhome.co.uk')
      const site = companyWebsite.replace(/\/$/, '')
      let portalUrl = ''
      try {
        const portal = await buildPortalMagicUrl(supabase, email, `/portal/bookings/${quoteId}`)
        if (portal.ok) portalUrl = portal.url
      } catch {
        portalUrl = ''
      }
      const kind = useKind(figures)
      const filename = kind === 'cash' ? `Invoice-${quoteRefOf(quote)}-cash.pdf` : `Invoice-${quoteRefOf(quote)}.pdf`
      const rendered = renderTransactionalEmailTemplate({
        kind: 'payment_received',
        brand: {
          companyName: envOrDefault('COMPANY_NAME', 'ShiftMyHome'),
          supportEmail: envOrDefault('COMPANY_SUPPORT_EMAIL', envOrDefault('COMPANY_EMAIL', 'admin@shiftmyhome.co.uk')),
          websiteUrl: companyWebsite,
          companyAddress: envOrDefault('COMPANY_ADDRESS', 'Glasgow, Scotland'),
          companyNumber: envOrDefault('COMPANY_NUMBER', 'N/A'),
          logoUrl: '',
          termsUrl: envOrDefault('TERMS_URL', `${site}/terms`),
          privacyUrl: envOrDefault('PRIVACY_URL', `${site}/privacy`),
          contactUrl: envOrDefault('CONTACT_URL', `${site}/contact`),
        },
        paymentPayload: {
          quoteRef: quoteRefOf(quote),
          paymentStatus: invoicePaidMark(kind),
          collectionSummary: String(quote.pickup_address || '-'),
          deliverySummary: String(quote.delivery_address || '-'),
          portalUrl,
        },
      })
      const result = await sendResendEmailMinimal({
        logTag: 'cash-invoice',
        apiKey,
        from,
        to: [email],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        attachments: [{ filename, content: bytesToBase64(pdf) }],
      })
      if (!result.ok) return { ok: false, error: 'email_failed' }
      return {
        ok: true,
        resendId: result.resendId,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        email,
        invoiceFilename: filename,
        kind,
      }
    },
    async markFailed(error) {
      await supabase
        .from('job_customer_notifications')
        .update({ delivery_status: 'failed', provider_status: 'failed', payload: { error } })
        .eq('quote_id', quoteId)
        .eq('event_key', invoiceEventKey(activeKind))
    },
    async markSent(sent) {
      await supabase
        .from('job_customer_notifications')
        .update({
          delivery_status: 'sent',
          provider_status: 'sent',
          recipient_email: sent.email,
          provider_message_id: sent.resendId || null,
          sent_at: new Date().toISOString(),
        })
        .eq('quote_id', quoteId)
        .eq('event_key', invoiceEventKey(String(sent.kind || activeKind)))
    },
    async archive(sent) {
      try {
      const kind = String(sent.kind || activeKind)
      const { data: note } = await supabase
        .from('job_customer_notifications')
        .select('id')
        .eq('quote_id', quoteId)
        .eq('event_key', invoiceEventKey(kind))
        .maybeSingle()
      await saveCustomerEmailArchive(supabase, {
        quoteId,
        notificationId: note?.id || null,
        eventKey: invoiceEventKey(kind),
        subject: String(sent.subject || ''),
        recipientEmail: String(sent.email || ''),
        html: String(sent.html || ''),
        text: String(sent.text || ''),
        providerMessageId: sent.resendId || null,
        providerStatus: 'sent',
        invoiceBucket: 'booking-invoices',
        invoicePath: invoiceStoragePath(quoteId, kind),
        invoiceFilename: String(sent.invoiceFilename || 'invoice.pdf'),
        sentAt: new Date().toISOString(),
      })
      } catch (error) {
        console.error('[cash-invoice] archive failed', error)
      }
    },
  })
}

const APOLOGY_QUOTE_REF = 'SMH-2026-304234'

export async function sendInvoiceApology(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quoteId: string,
) {
  const { data: quote } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle()
  if (!quote) return { ok: false, error: 'quote_not_found' }
  if (quoteRefOf(quote) !== APOLOGY_QUOTE_REF) return { ok: false, error: 'not_allowed' }
  const email = String(quote.email || '').trim()
  if (!email) return { ok: false, error: 'missing_email' }

  const built = await buildCurrentInvoicePdf(supabase, quoteId, { paymentTypeLabel: 'Cash' })
  if (!built?.bytes?.length) return { ok: false, error: 'pdf_failed' }
  const stored = await storeSentInvoicePdf(supabase, quoteId, 'paid', built.bytes, built.filename)
  if (!stored?.path) return { ok: false, error: 'pdf_store_failed' }

  const apiKey = (Deno.env.get('RESEND_API_KEY') || '').trim()
  if (!apiKey) return { ok: false, error: 'email_failed' }
  const from = envOrDefault('RESEND_FROM_EMAIL', 'ShiftMyHome <onboarding@resend.dev>')
  const first = String(quote.full_name || 'there').trim().split(/\s+/)[0] || 'there'
  const safeFirst = first.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] || char)
  const subject = `Your invoice for booking ${APOLOGY_QUOTE_REF}`
  const text = [
    `Hi ${first},`,
    '',
    'Thank you for choosing ShiftMyHome for your move, and thank you for calling us today.',
    '',
    'We are sorry you had to wait, and sorry that you did not receive your invoice. There was a glitch in our system, so the invoice was not sent to you as it should have been. Please accept our apologies.',
    '',
    `Your invoice is attached to this email. It is for booking ${APOLOGY_QUOTE_REF}. The amount paid is £170.00, and there is nothing left to pay.`,
    '',
    'Thank you again for your booking and for your patience. If you need anything else, just reply to this email and we will be glad to help.',
    '',
    'Kind regards,',
    'The ShiftMyHome Team',
    'admin@shiftmyhome.co.uk',
    'www.shiftmyhome.co.uk',
  ].join('\n')
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.55;font-size:15px;max-width:560px;">
      <p>Hi ${safeFirst},</p>
      <p>Thank you for choosing ShiftMyHome for your move, and thank you for calling us today.</p>
      <p>We are sorry you had to wait, and sorry that you did not receive your invoice. There was a glitch in our system, so the invoice was not sent to you as it should have been. Please accept our apologies.</p>
      <p>Your invoice is attached to this email. It is for booking ${APOLOGY_QUOTE_REF}. The amount paid is £170.00, and there is nothing left to pay.</p>
      <p>Thank you again for your booking and for your patience. If you need anything else, just reply to this email and we will be glad to help.</p>
      <p>Kind regards,<br>The ShiftMyHome Team<br>admin@shiftmyhome.co.uk<br>www.shiftmyhome.co.uk</p>
    </div>`
  const result = await sendResendEmailMinimal({
    logTag: 'invoice-apology',
    apiKey,
    from,
    to: [email],
    subject,
    html,
    text,
    attachments: [{ filename: built.filename, content: bytesToBase64(built.bytes) }],
  })
  if (!result.ok) return { ok: false, error: 'email_failed' }

  await saveCustomerEmailArchive(supabase, {
    quoteId,
    eventKey: 'invoice_resent',
    subject,
    recipientEmail: email,
    html,
    text,
    providerMessageId: result.resendId || null,
    providerStatus: 'sent',
    invoiceBucket: 'booking-invoices',
    invoicePath: stored.path,
    invoiceFilename: built.filename,
  })
  return { ok: true, resendId: result.resendId || null, email }
}

export function cashInvoiceAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) return null
  return createClient(supabaseUrl, serviceKey)
}
