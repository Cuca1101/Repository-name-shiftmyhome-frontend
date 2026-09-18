/**
 * Customer-facing job status labels + notification event keys.
 */

export type JobNotifyEventKey =
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
  status_on_way: 'Driver on the way to pickup',
  status_arrived_pickup: 'Driver arrived at pickup',
  status_pickup_completed: 'Pickup completed',
  status_in_transit: 'On the way to delivery',
  status_arrived_delivery: 'Driver arrived at delivery',
  status_completed: 'Job completed',
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
    on_way: 'On the way',
    started: 'On the way',
    start: 'On the way',
    arrived: 'Arrived at pickup',
    arrived_pickup: 'Arrived at pickup',
    loading: 'Loading',
    loaded: 'Loading',
    pickup_completed: 'Pickup completed',
    in_transit: 'On the way to delivery',
    in_progress: 'In progress',
    arrived_delivery: 'Arrived at delivery',
    unloading: 'Unloading',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  if (map[s]) return map[s]
  // operational_status style "On way"
  const spaced = String(raw || '').trim().toLowerCase()
  if (spaced === 'on way') return 'On the way'
  if (spaced === 'arrived') return 'Arrived at pickup'
  if (spaced === 'in transit') return 'On the way to delivery'
  if (spaced === 'in progress') return 'In progress'
  if (spaced === 'completed') return 'Completed'
  if (spaced === 'assigned') return 'Driver assigned'
  return String(raw || 'Driver assigned')
}

export function siteBaseUrl() {
  return (Deno.env.get('SITE_URL') || 'https://www.shiftmyhome.co.uk').replace(/\/$/, '')
}

export function trackingUrl(token: string) {
  return `${siteBaseUrl()}/track/${token}`
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
      <a href="${reviewUrl}" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:10px;font-size:15px;">⭐ Leave us a Google Review</a>
    </p>
    <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#0f172a;">Would you like to thank your moving team?</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#475569;">
      If you feel the team did a great job, you can optionally leave them a tip. This is completely optional and there is absolutely no obligation.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${tipUrlSafe}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:10px;font-size:15px;">💷 Leave a Tip</a>
    </p>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.55;color:#334155;">Thank you again for trusting ShiftMyHome with your move.</p>
    <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#0f172a;">The ShiftMyHome Team</p>
    <p style="margin:0;font-size:13px;color:#94a3b8;">Moving made simple.</p>
  </td></tr></table>
  </td></tr></table>
</body></html>`
}

export function buildJobCustomerEmailHtml(params: {
  title: string
  intro: string
  rows: Array<{ label: string; value: string }>
  primaryCta?: { label: string; url: string }
  secondaryCtas?: Array<{ label: string; url: string }>
  footerNote?: string
}) {
  const rowsHtml = params.rows
    .filter((r) => r.value && r.value.trim())
    .map(
      (r) =>
        `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;">${esc(r.label)}</td><td style="padding:6px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:600;">${esc(r.value)}</td></tr>`,
    )
    .join('')

  const primary = params.primaryCta
    ? `<p style="margin:20px 0 10px;"><a href="${esc(params.primaryCta.url)}" style="display:inline-block;background:#0284c7;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;">${esc(params.primaryCta.label)}</a></p>`
    : ''

  const secondary = (params.secondaryCtas || [])
    .map(
      (c) =>
        `<a href="${esc(c.url)}" style="display:inline-block;margin:0 8px 8px 0;background:#0f172a;color:#fff;text-decoration:none;font-weight:700;padding:10px 14px;border-radius:10px;font-size:13px;">${esc(c.label)}</a>`,
    )
    .join('')

  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Segoe UI,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;"><tr><td align="center">
  <table width="560" style="max-width:560px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;"><tr><td style="padding:24px;">
    <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">${esc(params.title)}</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#475569;">${esc(params.intro)}</p>
    <table width="100%">${rowsHtml}</table>
    ${primary}
    ${secondary ? `<p style="margin:8px 0 0;">${secondary}</p>` : ''}
    ${params.footerNote ? `<p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">${esc(params.footerNote)}</p>` : ''}
  </td></tr></table>
  </td></tr></table></body></html>`
}
