import { logResendPayloadBeforeFetch } from './resendPayloadLog.ts'

/** Official minimal attachment row: only `filename` + `content` (base64). */
export type ResendMinimalAttachment = Readonly<{
  filename: string
  content: string
}>

export type SendResendEmailMinimalResult = {
  ok: boolean
  status: number
  statusText: string
  bodyText: string
  resendId: string
  requestId: string
}

const RESEND_EMAILS_URL = 'https://api.resend.com/emails'

/**
 * Single shared path for Resend `POST /emails` (used by `resend-pdf-attachment-test` and payment invoice).
 * Payload shape: `{ from, to, subject, html, text, attachments }` — no extra keys.
 */
export async function sendResendEmailMinimal(params: {
  logTag: string
  apiKey: string
  from: string
  to: string[]
  subject: string
  html: string
  text: string
  attachments: ResendMinimalAttachment[]
}): Promise<SendResendEmailMinimalResult> {
  const { logTag, apiKey, from, to, subject, html, text, attachments } = params

  const first = attachments[0]
  console.log(`[${logTag}] resend attachment final`, {
    final_attachment_filename: first?.filename ?? null,
    final_attachment_content_length: first && typeof first.content === 'string' ? first.content.length : 0,
    final_attachments_array_length: attachments.length,
    resend_payload_attachments_preview: attachments.map((a, idx) => ({
      index: idx,
      filename: a.filename,
      content_length: a.content.length,
      content_head: a.content.slice(0, 96),
      content_tail: a.content.length > 120 ? a.content.slice(-48) : '',
    })),
  })

  const payload = { from, to, subject, html, text, attachments }
  logResendPayloadBeforeFetch(logTag, payload as Record<string, unknown>)

  const resendResp = await fetch(RESEND_EMAILS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const requestId =
    resendResp.headers.get('x-request-id') || resendResp.headers.get('x-resend-request-id') || ''

  let bodyText = ''
  try {
    bodyText = await resendResp.text()
  } catch {
    bodyText = ''
  }

  let resendId = ''
  try {
    const j = JSON.parse(bodyText) as { id?: string }
    if (typeof j?.id === 'string') resendId = j.id
  } catch {
    /* not JSON */
  }

  console.log(`[${logTag}] resend response body`, {
    status: resendResp.status,
    status_text: resendResp.statusText || '',
    request_id: requestId || null,
    resend_id: resendId || null,
    body: bodyText,
  })

  return {
    ok: resendResp.ok,
    status: resendResp.status,
    statusText: resendResp.statusText || '',
    bodyText,
    resendId,
    requestId,
  }
}
