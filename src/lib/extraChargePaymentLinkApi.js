import { isSupabaseConfigured, supabase } from './supabase'
import {
  buildAdminFunctionInvokeOpts,
  detailFromFunctionsInvokeError,
} from './functionsInvokeError'

/**
 * Approve extra charge row + create Stripe checkout link (no customer email on create).
 * @param {{
 *   requestId: string,
 *   approvedAmount: number,
 *   customerEmail: string,
 *   customerName?: string,
 *   bookingReference?: string,
 * }} input
 * @returns {Promise<{ paymentLink: string|null, approvedAmount: number, alreadyCreated?: boolean }>}
 */
export async function approveAndGenerateExtraChargePaymentLink(input) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }

  const requestId = String(input.requestId || '').trim()
  if (!requestId) throw new Error('Request id is required.')

  const invokeOpts = await buildAdminFunctionInvokeOpts(supabase, {
    request_id: requestId,
    approved_amount: input.approvedAmount,
    customer_email: String(input.customerEmail || '').trim(),
    customer_name: String(input.customerName || '').trim(),
    booking_reference: String(input.bookingReference || '').trim(),
  })

  const { data, error } = await supabase.functions.invoke('create-extra-charge-payment', invokeOpts)

  if (error) {
    throw new Error(
      await detailFromFunctionsInvokeError(
        error,
        'Could not generate payment link. Sign in to admin again or check Edge Function logs.',
      ),
    )
  }

  if (data?.error) {
    throw new Error(String(data.error))
  }

  const paymentLink = data?.stripe_payment_link != null ? String(data.stripe_payment_link) : null
  if (!paymentLink) {
    throw new Error('Payment link was not returned. Check Stripe configuration and try again.')
  }

  return {
    paymentLink,
    approvedAmount: Number(data?.approved_amount) || input.approvedAmount,
    alreadyCreated: Boolean(data?.already_created),
  }
}

/**
 * @param {string} link
 */
export async function copyPaymentLinkToClipboard(link) {
  const url = String(link || '').trim()
  if (!url) throw new Error('No payment link to copy.')
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url)
    return
  }
  throw new Error('Clipboard not available in this browser.')
}

/**
 * @param {{ customerName?: string, bookingReference?: string, paymentLink: string, amountLabel?: string }} params
 */
export function buildExtraChargeShareMessage(params) {
  const name = String(params.customerName || '').trim()
  const ref = String(params.bookingReference || '').trim()
  const link = String(params.paymentLink || '').trim()
  const amount = params.amountLabel ? ` (${params.amountLabel})` : ''
  const greeting = name ? `Hi ${name},` : 'Hi,'
  const refPart = ref ? ` for booking ${ref}` : ''
  return `${greeting} please pay the additional charges${refPart}${amount} using this secure link:\n\n${link}\n\nThank you — ShiftMyHome`
}

/**
 * @param {string} message
 */
export function whatsAppShareUrl(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

/**
 * @param {string} message
 */
export function smsShareUrl(message) {
  return `sms:?&body=${encodeURIComponent(message)}`
}

/**
 * @param {{ email: string, subject: string, body: string }} params
 */
export function mailtoShareUrl(params) {
  const email = encodeURIComponent(String(params.email || '').trim())
  const subject = encodeURIComponent(params.subject)
  const body = encodeURIComponent(params.body)
  return `mailto:${email}?subject=${subject}&body=${body}`
}
