/** Resend rejects / mishandles base64 with line breaks. */
export function sanitizeBase64ForResend(raw: string): string {
  return String(raw || '').replace(/\s/g, '').trim()
}

/**
 * Same encoding path as `resend-pdf-attachment-test` (Deno.encodeBase64 or byte-wise btoa) + sanitize.
 * Use for every PDF attachment so payment + test behave identically.
 */
export function encodePdfBytesToResendBase64(bytes: Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const g = globalThis as typeof globalThis & { Deno?: { encodeBase64?: (u: Uint8Array) => string } }
  const raw =
    typeof g.Deno?.encodeBase64 === 'function'
      ? g.Deno.encodeBase64(u8)
      : btoa(Array.from(u8, (b) => String.fromCharCode(b)).join(''))
  return sanitizeBase64ForResend(raw)
}

/** Avoid non-ASCII in Subject (test used ASCII-only; some stacks mishandle encoded-word edge cases). */
export function asciiEmailSubject(raw: string): string {
  return String(raw || '')
    .replace(/[\u2013\u2014\u2212]/g, '-') // en dash, em dash, minus
    .replace(/[^\x20-\x7E]/g, '') // drop remaining non-ASCII
    .replace(/\s+/g, ' ')
    .trim()
}

export type ResendAttachmentPayloadDiagnostics = {
  body_utf8_bytes: number
  top_level_keys: string[]
  has_attachments: boolean
  attachments_length: number | null
  attachment_0_keys: string[]
  attachment_0_filename: string | null
  attachment_0_content_length: number
  attachment_0_content_preview_start: string
  attachment_0_content_preview_end: string
  standard_base64_charset_ok: boolean
  stringify_ok: boolean
  stringify_error: string | null
  attachment_0_is_minimal_filename_content_only: boolean
}

/** Same shape we log / return for HTTP diagnostics (never exposes full base64). */
export function getResendPayloadDiagnostics(payload: Record<string, unknown>): ResendAttachmentPayloadDiagnostics {
  let bodyStr = ''
  let stringifyOk = true
  let stringifyError: string | null = null
  try {
    bodyStr = JSON.stringify(payload)
  } catch (e) {
    stringifyOk = false
    stringifyError = e instanceof Error ? e.message : String(e)
    return {
      body_utf8_bytes: 0,
      top_level_keys: Object.keys(payload),
      has_attachments: Array.isArray(payload.attachments),
      attachments_length: Array.isArray(payload.attachments) ? payload.attachments.length : null,
      attachment_0_keys: [],
      attachment_0_filename: null,
      attachment_0_content_length: 0,
      attachment_0_content_preview_start: '',
      attachment_0_content_preview_end: '',
      standard_base64_charset_ok: false,
      stringify_ok: false,
      stringify_error: stringifyError,
      attachment_0_is_minimal_filename_content_only: false,
    }
  }

  const enc = new TextEncoder().encode(bodyStr)
  const atts = payload.attachments
  const first = Array.isArray(atts) && atts.length > 0 ? (atts[0] as Record<string, unknown>) : null
  const content = typeof first?.content === 'string' ? first.content : ''

  const attKeys = first ? Object.keys(first) : []
  const canonicalMinimalKeysOnly =
    attKeys.length === 2 &&
    attKeys.includes('filename') &&
    attKeys.includes('content') &&
    !attKeys.some((k) => k !== 'filename' && k !== 'content')

  return {
    body_utf8_bytes: enc.length,
    top_level_keys: Object.keys(payload),
    has_attachments: Array.isArray(atts),
    attachments_length: Array.isArray(atts) ? atts.length : null,
    attachment_0_keys: attKeys,
    attachment_0_filename: typeof first?.filename === 'string' ? first.filename : null,
    attachment_0_content_length: content.length,
    attachment_0_content_preview_start: content.slice(0, 64),
    attachment_0_content_preview_end: content.length > 80 ? content.slice(-32) : '',
    standard_base64_charset_ok:
      content.length > 0 ? /^[A-Za-z0-9+/]+=*$/.test(content) : false,
    stringify_ok: stringifyOk,
    stringify_error: stringifyError,
    attachment_0_is_minimal_filename_content_only: canonicalMinimalKeysOnly,
  }
}


/** Logs JSON.stringify(payload) meta + truncated JSON for dashboards (never full base64). */
export function logResendPayloadBeforeFetch(tag: string, payload: Record<string, unknown>) {
  const snapshot = getResendPayloadDiagnostics(payload)

  console.log(`[${tag}] resend exact POST body (meta only; content not logged in full)`, snapshot)
  try {
    const truncated = JSON.stringify(payload, (key, value) => {
      if (key === 'content' && typeof value === 'string' && value.length > 120) {
        return `${value.slice(0, 48)}…[${value.length} chars total]…${value.slice(-24)}`
      }
      return value
    })
    console.log(`[${tag}] resend payload JSON (content truncated for logs)`, truncated)
  } catch {
    /* ignore */
  }
}
