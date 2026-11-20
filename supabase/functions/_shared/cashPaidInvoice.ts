import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildBookingConfirmationPdf } from './paymentConfirmationEmail.ts'
import { saveCustomerEmailArchive, storeSentInvoicePdf } from './customerEmailArchive.ts'
import { sendResendEmailMinimal } from './postResendEmail.ts'
import { renderTransactionalEmailTemplate } from './transactionalEmailTemplates.ts'
import { buildPortalMagicUrl } from './customerPortalMagicLink.ts'
import { isUniqueViolation, notificationClaimDecision } from './deliveryRetryPolicy.js'
import {
  CASH_INVOICE_EVENT,
  CASH_INVOICE_FILE_KEY,
  CASH_PAID_MARK,
  cashInvoiceStoragePath,
  deliverCashPaidInvoice,
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

async function claimCashInvoice(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quoteId: string,
) {
  const insert = await supabase.from('job_customer_notifications').insert({
    quote_id: quoteId,
    event_key: CASH_INVOICE_EVENT,
    event_label: 'Cash invoice',
    delivery_status: 'pending',
  })
  if (!insert.error) return { claimed: true as const }
  if (!isUniqueViolation(insert.error)) return { claimed: false as const, reason: insert.error.message }

  const { data: existing } = await supabase
    .from('job_customer_notifications')
    .select('delivery_status, created_at')
    .eq('quote_id', quoteId)
    .eq('event_key', CASH_INVOICE_EVENT)
    .maybeSingle()

  const decision = notificationClaimDecision(existing)
  if (decision === 'already_sent') return { claimed: false as const, reason: 'already_sent' }
  if (decision === 'in_flight') return { claimed: false as const, reason: 'in_flight' }

  await supabase
    .from('job_customer_notifications')
    .delete()
    .eq('quote_id', quoteId)
    .eq('event_key', CASH_INVOICE_EVENT)
    .in('delivery_status', ['failed', 'pending'])

  const retry = await supabase.from('job_customer_notifications').insert({
    quote_id: quoteId,
    event_key: CASH_INVOICE_EVENT,
    event_label: 'Cash invoice',
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
) {
  const { data: archived } = await supabase
    .from('customer_email_archive')
    .select('id')
    .eq('quote_id', quoteId)
    .eq('invoice_path', cashInvoiceStoragePath(quoteId))
    .limit(1)
  if (archived?.length) return
  const { data: note } = await supabase
    .from('job_customer_notifications')
    .select('id, recipient_email, provider_message_id, sent_at')
    .eq('quote_id', quoteId)
    .eq('event_key', CASH_INVOICE_EVENT)
    .maybeSingle()
  await saveCustomerEmailArchive(supabase, {
    quoteId,
    notificationId: note?.id || null,
    eventKey: CASH_INVOICE_EVENT,
    subject: `[ShiftMyHome] Payment received (${quoteRefOf(quote)})`,
    recipientEmail: String(note?.recipient_email || quote.email || ''),
    html: `<p>Invoice ${CASH_PAID_MARK} for booking ${quoteRefOf(quote)}.</p>`,
    text: `Invoice ${CASH_PAID_MARK} for booking ${quoteRefOf(quote)}.`,
    providerMessageId: note?.provider_message_id || null,
    providerStatus: 'sent',
    invoiceBucket: 'booking-invoices',
    invoicePath: cashInvoiceStoragePath(quoteId),
    invoiceFilename: `Invoice-${quoteRefOf(quote)}-cash.pdf`,
    sentAt: note?.sent_at || new Date().toISOString(),
  })
}

export async function sendCashPaidInvoice(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quoteId: string,
) {
  const path = cashInvoiceStoragePath(quoteId)
  return deliverCashPaidInvoice({
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
    async loadNotification() {
      const { data } = await supabase
        .from('job_customer_notifications')
        .select('delivery_status')
        .eq('quote_id', quoteId)
        .eq('event_key', CASH_INVOICE_EVENT)
        .maybeSingle()
      return data || null
    },
    async repairArchive() {
      const { data } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle()
      if (data) await repairCashArchive(supabase, quoteId, data)
    },
    async readStoredPdf() {
      const downloaded = await supabase.storage.from('booking-invoices').download(path)
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
      const lines = [
        ...(figures.advance > 0 ? [`Advance paid: GBP ${Number(figures.advance).toFixed(2)}`] : []),
        `Cash received: GBP ${Number(figures.cash).toFixed(2)}`,
        ...(figures.discounts || []),
      ]
      const paidAt = figures.paidAt || new Date().toISOString()
      try {
      return await buildBookingConfirmationPdf({
        quote: { ...quote, paid_at: quote.paid_at || paidAt, amount_paid: figures.paid, remaining_balance: 0 },
        stops: stops || [],
        inventoryItems: items || [],
        requirements: requirements || [],
        pricing: null,
        invoiceNumber: `SMH-INV-${quoteRefOf(quote)}-CASH`,
        quoteRef: quoteRefOf(quote),
        paymentStatusLabel: CASH_PAID_MARK,
        amountPaidGbp: figures.paid,
        estimatedTotalGbp: figures.total,
        remainingBalanceGbp: 0,
        paymentType: 'cash',
        statusBadge: CASH_PAID_MARK,
        paymentTypeLabel: 'Cash',
        totalCaption: 'Final price',
        extraSummaryLines: lines,
      })
      } catch (error) {
        console.error('[cash-invoice] pdf failed', error)
        return null
      }
    },
    async storePdf(bytes) {
      const stored = await storeSentInvoicePdf(
        supabase,
        quoteId,
        CASH_INVOICE_FILE_KEY,
        bytes,
        `Invoice-${quoteId}.pdf`,
      )
      return Boolean(stored?.path)
    },
    claim: () => claimCashInvoice(supabase, quoteId),
    async sendEmail({ pdf, email, quote }) {
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
          paymentStatus: 'PAID – Cash',
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
        attachments: [{ filename: `Invoice-${quoteRefOf(quote)}-cash.pdf`, content: bytesToBase64(pdf) }],
      })
      if (!result.ok) return { ok: false, error: 'email_failed' }
      return {
        ok: true,
        resendId: result.resendId,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        email,
        invoiceFilename: `Invoice-${quoteRefOf(quote)}-cash.pdf`,
      }
    },
    async markFailed(error) {
      await supabase
        .from('job_customer_notifications')
        .update({ delivery_status: 'failed', provider_status: 'failed', payload: { error } })
        .eq('quote_id', quoteId)
        .eq('event_key', CASH_INVOICE_EVENT)
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
        .eq('event_key', CASH_INVOICE_EVENT)
    },
    async archive(sent) {
      try {
      const { data: note } = await supabase
        .from('job_customer_notifications')
        .select('id')
        .eq('quote_id', quoteId)
        .eq('event_key', CASH_INVOICE_EVENT)
        .maybeSingle()
      await saveCustomerEmailArchive(supabase, {
        quoteId,
        notificationId: note?.id || null,
        eventKey: CASH_INVOICE_EVENT,
        subject: String(sent.subject || ''),
        recipientEmail: String(sent.email || ''),
        html: String(sent.html || ''),
        text: String(sent.text || ''),
        providerMessageId: sent.resendId || null,
        providerStatus: 'sent',
        invoiceBucket: 'booking-invoices',
        invoicePath: path,
        invoiceFilename: String(sent.invoiceFilename || 'invoice-cash.pdf'),
        sentAt: new Date().toISOString(),
      })
      } catch (error) {
        console.error('[cash-invoice] archive failed', error)
      }
    },
  })
}

export function cashInvoiceAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) return null
  return createClient(supabaseUrl, serviceKey)
}
