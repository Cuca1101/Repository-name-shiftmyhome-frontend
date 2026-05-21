/**
 * Resend API helper — shared by transactional edge functions.
 * Secrets: RESEND_API_KEY (required), RESEND_FROM_EMAIL (optional).
 */

export type ResendSendResult = {
  ok: boolean
  skipped?: boolean
  error?: string
  resendId?: string
}

export function resendFromEmail(): string {
  return (Deno.env.get('RESEND_FROM_EMAIL') || 'ShiftMyHome <bookings@shiftmyhome.co.uk>').trim()
}

export function resendApiKey(): string {
  return (Deno.env.get('RESEND_API_KEY') || '').trim()
}

/**
 * @param {object} params
 * @param {string | string[]} params.to
 * @param {string} params.subject
 * @param {string} params.html
 * @param {string} [params.text]
 * @param {string} [params.idempotencyKey]
 */
export async function sendResendEmail(params: {
  to: string | string[]
  subject: string
  html: string
  text?: string
  idempotencyKey?: string
}): Promise<ResendSendResult> {
  const apiKey = resendApiKey()
  if (!apiKey) {
    return { ok: false, skipped: true, error: 'RESEND_API_KEY not configured' }
  }

  const toList = (Array.isArray(params.to) ? params.to : [params.to])
    .map((e) => String(e || '').trim())
    .filter(Boolean)

  if (!toList.length) {
    return { ok: false, error: 'No recipients' }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
  if (params.idempotencyKey) {
    headers['Idempotency-Key'] = params.idempotencyKey
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from: resendFromEmail(),
      to: toList,
      subject: params.subject,
      html: params.html,
      text: params.text || undefined,
    }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err =
      typeof body?.message === 'string'
        ? body.message
        : typeof body?.error === 'string'
          ? body.error
          : `Resend HTTP ${res.status}`
    return { ok: false, error: err }
  }

  return { ok: true, resendId: typeof body?.id === 'string' ? body.id : undefined }
}
