/**
 * Customer-facing job status labels + notification event keys.
 */

export type JobNotifyEventKey =
  | 'booking_confirmed'
  | 'driver_assigned'
  | 'driver_reassigned'
  | 'status_on_way'
  | 'status_arrived_pickup'
  | 'status_pickup_completed'
  | 'status_in_transit'
  | 'status_arrived_delivery'
  | 'status_completed'
  | 'tip_received'

export const JOB_NOTIFY_EVENT_LABELS: Record<JobNotifyEventKey, string> = {
  driver_assigned: 'Driver assigned',
  driver_reassigned: 'Driver reassigned',
  status_on_way: 'Left for collection',
  status_arrived_pickup: 'At collection',
  status_pickup_completed: 'Items collected',
  status_in_transit: 'Left for delivery',
  status_arrived_delivery: 'At delivery',
  status_completed: 'Completed',
  tip_received: 'Tip payment received',
}

/** Map raw DB / app status → customer portal label */
export function customerStatusLabel(raw: string | null | undefined): string {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  const map: Record<string, string> = {
    assigned: 'Driver assigned',
    accepted: 'Driver assigned',
    booked: 'Driver assigned',
    active: 'Driver assigned',
    on_way: 'Left for collection',
    started: 'Left for collection',
    start: 'Left for collection',
    arrived: 'At collection',
    arrived_pickup: 'At collection',
    loading: 'Loading',
    loading_started: 'Loading',
    loaded: 'Collection finished',
    pickup_completed: 'Collection finished',
    in_transit: 'Left for delivery',
    in_progress: 'Left for collection',
    arrived_delivery: 'At delivery',
    unloading: 'Unloading',
    unloading_started: 'Unloading',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  if (map[s]) return map[s]
  const spaced = String(raw || '').trim().toLowerCase()
  if (spaced === 'on way' || spaced === 'left for collection') return 'Left for collection'
  if (spaced === 'arrived' || spaced === 'at collection') return 'At collection'
  if (spaced === 'in transit' || spaced === 'left for delivery') return 'Left for delivery'
  if (spaced === 'in progress') return 'Left for collection'
  if (spaced === 'collection finished' || spaced === 'items collected') return 'Items collected'
  if (spaced === 'at delivery') return 'At delivery'
  if (spaced === 'completed') return 'Completed'
  if (spaced === 'assigned') return 'Driver assigned'
  return String(raw || 'Driver assigned')
}

export function siteBaseUrl() {
  const raw = (Deno.env.get('SITE_URL') || 'https://www.shiftmyhome.co.uk').trim().replace(/\/$/, '')
  if (raw.startsWith('https://') || raw.startsWith('http://')) return raw
  return 'https://www.shiftmyhome.co.uk'
}

export function trackingUrl(token: string) {
  return `${siteBaseUrl()}/track/${token}`
}

/** Customer sign-in with her booking email already filled in. */
export function customerAccountUrl(email: string) {
  const value = String(email || '').trim()
  const base = `${siteBaseUrl()}/portal`
  if (!value) return base
  return `${base}?email=${encodeURIComponent(value)}`
}

export function feedbackUrl(token: string) {
  return `${siteBaseUrl()}/track/${token}/feedback`
}

export function tipUrl(token: string) {
  return `${siteBaseUrl()}/track/${token}/tip`
}

export function evidenceUrl(token: string) {
  return `${siteBaseUrl()}/track/${token}?view=evidence`
}

/** Default Google Business leave-review URL (overridden by website_settings.ops). */
export const DEFAULT_GOOGLE_REVIEW_URL = 'https://g.page/r/CWmwRUPz2dC7EAE/review'

/**
 * Resolve Google review URL from website_settings.ops (admin-editable).
 * @param supabase service-role client
 */
export async function resolveGoogleReviewUrl(
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<string> {
  try {
    const { data } = await supabase
      .from('website_settings')
      .select('ops')
      .eq('id', 'default')
      .maybeSingle()
    const fromOps = String(data?.ops?.google_review_url || '').trim()
    if (fromOps.startsWith('http://') || fromOps.startsWith('https://')) return fromOps
  } catch {
    /* ignore */
  }
  const envUrl = String(Deno.env.get('GOOGLE_REVIEWS_URL') || '').trim()
  if (envUrl.startsWith('http://') || envUrl.startsWith('https://')) return envUrl
  return DEFAULT_GOOGLE_REVIEW_URL
}

export function customerFirstName(fullName: unknown): string {
  const n = String(fullName || '').trim()
  if (!n) return 'there'
  return n.split(/\s+/)[0] || 'there'
}

function esc(v: unknown) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * Dedicated thank-you / Google review / optional tip email (job completed).
 */
export function buildJobCompletedThankYouEmailHtml(params: {
  firstName: string
  googleReviewUrl: string
  tipPageUrl: string
}) {
  const name = esc(params.firstName)
  const reviewUrl = esc(params.googleReviewUrl)
  const tipUrlSafe = esc(params.tipPageUrl)

  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;"><tr><td align="center">
  <table width="560" style="max-width:560px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;"><tr><td style="padding:28px 24px;">
    <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#334155;">Hi ${name},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#334155;">
      Thank you for choosing ShiftMyHome for your move. We hope everything went smoothly and that you were happy with the service provided by our team.
    </p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#334155;">
      Your feedback means a lot to us and helps other customers choose a reliable moving company.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${reviewUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:10px;font-size:15px;">⭐ Leave us a Google Review</a>
    </p>
    <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#0f172a;">Would you like to thank your moving team?</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#475569;">
      If you feel the team did a great job, you can optionally leave them a tip. This is completely optional and there is absolutely no obligation.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${tipUrlSafe}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:10px;font-size:15px;">💷 Leave a Tip</a>
    </p>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.55;color:#334155;">Thank you again for trusting ShiftMyHome with your move.</p>
    <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#0f172a;">The ShiftMyHome Team</p>
    <p style="margin:0;font-size:13px;color:#94a3b8;">Moving made simple.</p>
  </td></tr></table>
  </td></tr></table>
</body></html>`
}

export type BookingInventoryLine = { name: string; quantity: number }

/** Quote JSON, a text blob, or wizard lines all become name + quantity. */
export function bookingInventoryLines(raw: unknown): BookingInventoryLine[] {
  let value = raw
  if (typeof value === 'string' && value.trim()) {
    try {
      value = JSON.parse(value)
    } catch {
      return []
    }
  }
  const list = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { items?: unknown }).items)
      ? (value as { items: unknown[] }).items
      : []
  return list
    .map((line) => {
      const row = line && typeof line === 'object' ? (line as Record<string, unknown>) : {}
      const name = String(row.name || row.label || '').trim()
      const qty = Number(row.quantity ?? row.qty ?? 1)
      return { name, quantity: Number.isFinite(qty) && qty > 0 ? qty : 1 }
    })
    .filter((line) => line.name)
}

function stripSupplyLines(text: string) {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^Supply:\s/i.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function withoutPriceNote(text: string, priceNote: string) {
  const body = String(text || '').trim()
  const note = String(priceNote || '').trim()
  if (!body) return ''
  if (!note) return body
  if (body === note) return ''
  return body
    .split(/\r?\n/)
    .filter((line) => line.trim() !== note)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Customer words only. Crew supply lines and the price note stay out of this paragraph. */
export function customerInstructionText(raw: unknown, priceNote = '') {
  const normalized = String(raw || '')
    .replace(/\s*·\s*/g, '\n')
    .trim()
  if (!normalized) return ''
  const labeled = normalized.match(/Added by customer:\s*\n?([\s\S]*?)(?=\nAdded by admin:|$)/i)
  const words = labeled
    ? labeled[1]
    : /Added by admin:/i.test(normalized)
      ? ''
      : normalized
  return stripSupplyLines(withoutPriceNote(words, priceNote))
}

function inventoryRowsHtml(items: BookingInventoryLine[]) {
  if (items.length < 6) {
    return items
      .map(
        (item) =>
          `<tr><td style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155;">${esc(item.name)}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-weight:600;">×${item.quantity}</td></tr>`,
      )
      .join('')
  }
  const rows: string[] = []
  for (let i = 0; i < items.length; i += 3) {
    const slice: Array<BookingInventoryLine | null> = items.slice(i, i + 3)
    while (slice.length < 3) slice.push(null)
    rows.push(
      `<tr>${slice
        .map((item) =>
          item
            ? `<td width="33%" valign="top" style="width:33%;padding:6px 8px 6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;line-height:1.35;color:#334155;">${esc(item.name)} <span style="color:#0f172a;font-weight:600;white-space:nowrap;">×${item.quantity}</span></td>`
            : `<td width="33%" style="width:33%;padding:6px 0;border-bottom:1px solid #f1f5f9;">&nbsp;</td>`,
        )
        .join('')}</tr>`,
    )
  }
  return rows.join('')
}

/** Inventory list for the booking confirmation. Notes stay out of this email. */
export function buildBookingMoveSectionsHtml(params: {
  inventory: BookingInventoryLine[]
  customerNote?: string
  priceReason?: string
}) {
  const inventory = params.inventory
  if (!inventory.length) return ''
  const itemTotal = inventory.reduce((sum, line) => sum + line.quantity, 0)
  const itemTotalLabel = itemTotal === 1 ? '1 item' : `${itemTotal} items`
  return `<div style="margin-top:16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:12px;"><tr><td style="padding:12px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:6px;"><tr><td style="font-size:15px;font-weight:700;color:#0f172a;">Inventory</td><td align="right" style="font-size:13px;font-weight:700;color:#1d4ed8;">${esc(itemTotalLabel)}</td></tr></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${inventoryRowsHtml(inventory)}</table></td></tr></table></div>`
}

export function buildJobCustomerEmailHtml(params: {
  title: string
  intro: string
  rows: Array<{ label: string; value: string }>
  primaryCta?: { label: string; url: string }
  secondaryCtas?: Array<{ label: string; url: string }>
  footerNote?: string
  /** Inventory and notes. Used by the booking-confirmed email only. */
  moveSectionsHtml?: string
  /** Dark website footer. Used by the booking-confirmed email only. */
  companyFooter?: boolean
  /** Sits on the right of Track my booking. Opens her account with her email filled in. */
  accountCta?: { label: string; url: string }
}) {
  const rowsHtml = params.rows
    .filter((r) => r.value && r.value.trim())
    .map(
      (r) =>
        `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;">${esc(r.label)}</td><td style="padding:6px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:600;">${esc(r.value)}</td></tr>`,
    )
    .join('')

  const button = (cta: { label: string; url: string }, dark: boolean) =>
    `<a href="${esc(cta.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${dark ? '#0f172a' : '#0284c7'};color:#fff;text-decoration:none;font-weight:700;padding:${dark ? '10px 14px' : '12px 18px'};border-radius:10px;font-size:${dark ? '13px' : '14px'};">${esc(cta.label)}</a>`

  const account = params.accountCta
  const track =
    params.primaryCta?.label === 'Track my booking'
      ? params.primaryCta
      : (params.secondaryCtas || []).find((cta) => cta.label === 'Track my booking')
  const pay = params.primaryCta && params.primaryCta !== track ? params.primaryCta : undefined
  const otherSecondary = (params.secondaryCtas || []).filter((cta) => cta !== track)

  const primary = account && track
    ? `${pay ? `<p style="margin:20px 0 10px;">${button(pay, false)}</p>` : ''}
       <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:${pay ? '8px' : '20px'};"><tr>
         <td align="left" valign="middle">${button(track, true)}</td>
         <td align="right" valign="middle">${button(account, true)}</td>
       </tr></table>`
    : params.primaryCta
      ? `<p style="margin:20px 0 10px;">${button(params.primaryCta, false)}</p>`
      : ''

  const secondary = (account && track ? otherSecondary : params.secondaryCtas || [])
    .map(
      (cta) =>
        `<span style="display:inline-block;margin:0 8px 8px 0;">${button(cta, true)}</span>`,
    )
    .join('')

  const year = new Date().getFullYear()
  const site = siteBaseUrl()
  const companyFooter = params.companyFooter
    ? `<tr><td style="background:#020617;padding:18px 24px;text-align:center;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#e2e8f0;">
          <a href="tel:+441414614813" style="color:#e2e8f0;text-decoration:none;">0141 461 4813</a>
          <span style="color:#64748b;"> · </span>
          <a href="${esc(site)}" style="color:#93c5fd;text-decoration:none;">www.shiftmyhome.co.uk</a>
        </p>
        <p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;">© ${year} ShiftMyHome. All rights reserved.</p>
      </td></tr>`
    : ''

  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Segoe UI,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;"><tr><td style="padding:24px;">
    <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">${esc(params.title)}</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#475569;">${esc(params.intro)}</p>
    <table width="100%">${rowsHtml}</table>
    ${params.moveSectionsHtml || ''}
    ${primary}
    ${secondary ? `<p style="margin:8px 0 0;">${secondary}</p>` : ''}
    ${params.footerNote ? `<p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">${esc(params.footerNote)}</p>` : ''}
  </td></tr>${companyFooter}</table>
  </td></tr></table></body></html>`
}
