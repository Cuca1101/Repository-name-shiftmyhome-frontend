/**
 * Convenience wrapper around the production Resend POST helper (`postResendEmail.ts`).
 *
 * Secrets (existing only — do not create or overwrite):
 * - RESEND_API_KEY (required) — same key used by payment invoices / webhooks
 * - RESEND_FROM_EMAIL (optional) — same from-address as the rest of production
 */
import { sendResendEmailMinimal } from './postResendEmail.ts'

export type ResendSendResult = {
  ok: boolean
  skipped?: boolean
  error?: string
  resendId?: string
}

/** Same from-address resolution as payment / webhook Edge Functions. */
export function resendFromEmail(): string {
  return (
    Deno.env.get('RESEND_FROM_EMAIL') ||
    'ShiftMyHome <bookings@shiftmyhome.co.uk>'
  ).trim()
}

/** Existing production Resend API key — never generate a new one here. */
export function resendApiKey(): string {
  return (Deno.env.get('RESEND_API_KEY') || '').trim()
}

/**
 * Send a transactional email via the shared Resend path.
 * Used by quote recovery, job customer notify, tip confirmation, admin notifications, etc.
 */
export async function sendResendEmail(params: {
  to: string | string[]
  subject: string
  html: string
  text?: string
  idempotencyKey?: string
  logTag?: string
}): Promise<ResendSendResult> {
  const apiKey = resendApiKey()
  if (!apiKey) {
    console.error('[resend] RESEND_API_KEY not configured')
    return { ok: false, skipped: true, error: 'RESEND_API_KEY not configured' }
  }

  const toList = (Array.isArray(params.to) ? params.to : [params.to])
    .map((e) => String(e || '').trim())
    .filter(Boolean)

  if (!toList.length) {
    return { ok: false, error: 'No recipients' }
  }

  const result = await sendResendEmailMinimal({
    logTag: params.logTag || 'resend',
    apiKey,
    from: resendFromEmail(),
    to: toList,
    subject: params.subject,
    html: params.html,
    text: params.text || '',
    attachments: [],
    idempotencyKey: params.idempotencyKey,
  })

  if (!result.ok) {
    let detail = result.bodyText
    try {
      const j = JSON.parse(result.bodyText) as { message?: string; error?: string }
      if (typeof j?.message === 'string') detail = j.message
      else if (typeof j?.error === 'string') detail = j.error
    } catch {
      /* raw */
    }
    const err = detail || `Resend HTTP ${result.status}`
    return { ok: false, error: err }
  }

  return { ok: true, resendId: result.resendId || undefined }
}
