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

function esc(v: unknown) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
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
