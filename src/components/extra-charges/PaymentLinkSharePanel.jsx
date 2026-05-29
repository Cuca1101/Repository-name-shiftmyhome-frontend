import { useState } from 'react'
import {
  buildExtraChargeShareMessage,
  copyPaymentLinkToClipboard,
  mailtoShareUrl,
  smsShareUrl,
  whatsAppShareUrl,
} from '../../lib/extraChargePaymentLinkApi'

function money(n) {
  if (n == null) return ''
  return `£${Number(n).toFixed(2)}`
}

/**
 * @param {{
 *   paymentLink: string,
 *   customerEmail?: string,
 *   customerName?: string,
 *   bookingReference?: string,
 *   approvedAmount?: number|null,
 *   onCopied?: () => void,
 * }} props
 */
export default function PaymentLinkSharePanel({
  paymentLink,
  customerEmail = '',
  customerName = '',
  bookingReference = '',
  approvedAmount,
  onCopied,
}) {
  const [copyHint, setCopyHint] = useState('')

  const amountLabel = approvedAmount != null ? money(approvedAmount) : ''
  const shareMessage = buildExtraChargeShareMessage({
    customerName,
    bookingReference,
    paymentLink,
    amountLabel,
  })

  async function handleCopy() {
    try {
      await copyPaymentLinkToClipboard(paymentLink)
      setCopyHint('Copied!')
      onCopied?.()
      setTimeout(() => setCopyHint(''), 2500)
    } catch (e) {
      setCopyHint(e.message || 'Copy failed')
    }
  }

  const subject = `Payment link — ${bookingReference || 'ShiftMyHome extra charges'}`

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 sm:p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">Payment link ready</p>
      <p className="mt-1 text-xs text-emerald-800">
        Send this link to the customer yourself. They receive a confirmation email after they pay.
      </p>
      <a
        href={paymentLink}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block min-w-0 break-all text-sm font-semibold text-brand-700 underline"
      >
        {paymentLink}
      </a>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex min-h-[40px] w-full items-center justify-center rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100/60 sm:w-auto"
        >
          {copyHint || 'Copy payment link'}
        </button>
        <a
          href={whatsAppShareUrl(shareMessage)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[40px] w-full items-center justify-center rounded-lg bg-[#25D366] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 sm:w-auto"
        >
          Share via WhatsApp
        </a>
        <a
          href={smsShareUrl(shareMessage)}
          className="inline-flex min-h-[40px] w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 sm:w-auto"
        >
          Share via SMS
        </a>
        <a
          href={mailtoShareUrl({
            email: customerEmail,
            subject,
            body: shareMessage,
          })}
          className="inline-flex min-h-[40px] w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 sm:w-auto"
        >
          Share via Email
        </a>
      </div>
    </div>
  )
}
