import { eventClickLabel } from './websiteEventAnalytics'

/**
 * Admin-only classification for Website Leads / Quote Funnel (display only — no tracking changes).
 */

/** Events shown in Visitor Analytics (website_events). */
export const VISITOR_ANALYTICS_EVENT_NAMES = new Set([
  'page_view',
  'button_click',
  'new_quote_from_service',
  'visitor_started_quote',
])

/** Funnel events on website_leads rows that are not quote leads. */
export const VISITOR_ONLY_LEAD_FUNNEL_EVENTS = new Set(['page_view', 'button_click'])

const QUOTE_FUNNEL_LEAD_FUNNEL_EVENTS = new Set([
  'quote_started',
  'new_quote_started',
  'new_quote_from_service',
  'saved_quote_created',
  'saved_quote_resumed',
  'step_completed',
  'quote_step_1',
  'quote_step_2',
  'quote_step_3',
  'quote_step_4',
  'payment_option_selected',
  'payment_started',
  'payment_completed',
  'booking_completed',
  'quote_completed',
  'quote_abandoned',
  'pickup_address_changed',
  'dropoff_address_changed',
])

const QUOTE_LEAD_STATUSES = new Set([
  'quote_started',
  'step_completed',
  'quote_abandoned',
  'quote_completed',
  'payment_started',
  'payment_completed',
])

/**
 * @param {Record<string, unknown>} ev
 */
export function isVisitorAnalyticsEvent(ev) {
  const name = String(ev?.event_name || '')
  return VISITOR_ANALYTICS_EVENT_NAMES.has(name)
}

/**
 * Quote / funnel rows for the leads table (excludes browse-only visitors).
 * @param {Record<string, unknown>} row
 */
export function isQuoteLeadRow(row) {
  if (!row || typeof row !== 'object') return false

  const funnel = String(row.funnel_event || '').trim()
  if (VISITOR_ONLY_LEAD_FUNNEL_EVENTS.has(funnel)) return false

  if (row.quote_ref) return true

  const name = String(row.customer_name || '').trim()
  const email = String(row.customer_email || '').trim()
  const phone = String(row.customer_phone || '').trim()
  if (name || email || phone) return true

  const step = Number(row.current_step)
  if (step > 0) return true

  if (row.estimated_total != null && row.estimated_total !== '') return true

  const eff = String(row.effective_status || row.status || '')
  if (QUOTE_LEAD_STATUSES.has(eff)) return true

  if (QUOTE_FUNNEL_LEAD_FUNNEL_EVENTS.has(funnel)) return true

  if (String(row.service_type || '').trim() && eff !== 'visited') return true

  return false
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
export function filterQuoteLeadRows(rows) {
  return (rows || []).filter(isQuoteLeadRow)
}

/**
 * @param {Array<Record<string, unknown>>} events
 */
export function filterVisitorAnalyticsEvents(events) {
  return (events || []).filter(isVisitorAnalyticsEvent)
}

/**
 * Visitor KPIs + top lists (page views, sessions, clicks only).
 * @param {Array<Record<string, unknown>>} events
 */
export function computeVisitorAnalytics(events) {
  const list = filterVisitorAnalyticsEvents(events)
  const now = Date.now()
  const MS_DAY = 86400000

  /** @param {string|undefined} ts @param {number} days */
  function withinDays(ts, days) {
    if (!ts) return false
    return now - new Date(ts).getTime() <= days * MS_DAY
  }

  const pageViews = { today: 0, week: 0, month: 0 }
  const clicks = { today: 0, week: 0, month: 0 }
  const sessionsToday = new Set()
  const sessionsWeek = new Set()
  const sessionsMonth = new Set()
  const pageViewCounts = new Map()
  const clickLabelCounts = new Map()

  for (const ev of list) {
    const ts = String(ev.created_at || '')
    const name = String(ev.event_name || '')
    const sid = String(ev.session_id || '').trim()
    const path = String(ev.page_path || '/')
    /** @type {Record<string, unknown>} */
    const meta =
      ev.metadata && typeof ev.metadata === 'object' && !Array.isArray(ev.metadata)
        ? ev.metadata
        : {}

    if (name === 'page_view') {
      if (withinDays(ts, 1)) pageViews.today += 1
      if (withinDays(ts, 7)) pageViews.week += 1
      if (withinDays(ts, 30)) pageViews.month += 1
      pageViewCounts.set(path, (pageViewCounts.get(path) || 0) + 1)
    }

    if (name === 'button_click' || name === 'new_quote_from_service') {
      if (withinDays(ts, 1)) clicks.today += 1
      if (withinDays(ts, 7)) clicks.week += 1
      if (withinDays(ts, 30)) clicks.month += 1
      const label =
        name === 'new_quote_from_service'
          ? 'Service card quote'
          : String(meta.label || 'Click').trim() || 'Click'
      clickLabelCounts.set(label, (clickLabelCounts.get(label) || 0) + 1)
    }

    if (sid) {
      if (withinDays(ts, 1)) sessionsToday.add(sid)
      if (withinDays(ts, 7)) sessionsWeek.add(sid)
      if (withinDays(ts, 30)) sessionsMonth.add(sid)
    }
  }

  return {
    pageViews,
    clicks,
    uniqueVisitors: {
      today: sessionsToday.size,
      week: sessionsWeek.size,
      month: sessionsMonth.size,
    },
    topPages: [...pageViewCounts.entries()]
      .map(([page_path, count]) => ({ page_path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    topClicks: [...clickLabelCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
  }
}

/**
 * Deduped funnel KPIs from website_events (quote_started / booking_completed).
 * @param {Array<Record<string, unknown>>} events
 */
export function computeFunnelKpisFromEvents(events) {
  const list = Array.isArray(events) ? events : []
  const now = Date.now()
  const MS_DAY = 86400000

  /** @param {string|undefined} ts @param {number} days */
  function withinDays(ts, days) {
    if (!ts) return false
    return now - new Date(ts).getTime() <= days * MS_DAY
  }

  const quoteStarts = { today: 0, week: 0, month: 0 }
  const bookings = { today: 0, week: 0, month: 0 }

  const startKeysToday = new Set()
  const startKeysWeek = new Set()
  const startKeysMonth = new Set()
  const bookingRefsToday = new Set()
  const bookingRefsWeek = new Set()
  const bookingRefsMonth = new Set()

  for (const ev of list) {
    const ts = String(ev.created_at || '')
    const name = String(ev.event_name || '')
    const sid = String(ev.session_id || '').trim()
    const ref = String(ev.quote_ref || '').trim()

    if (name === 'quote_started') {
      const key = ref || sid || String(ev.id || '')
      if (!key) continue
      if (withinDays(ts, 1) && !startKeysToday.has(key)) {
        startKeysToday.add(key)
        quoteStarts.today += 1
      }
      if (withinDays(ts, 7) && !startKeysWeek.has(key)) {
        startKeysWeek.add(key)
        quoteStarts.week += 1
      }
      if (withinDays(ts, 30) && !startKeysMonth.has(key)) {
        startKeysMonth.add(key)
        quoteStarts.month += 1
      }
    }

    if (name === 'booking_completed') {
      const key = ref || `${sid}:${ts.slice(0, 10)}`
      if (!key) continue
      if (withinDays(ts, 1) && !bookingRefsToday.has(key)) {
        bookingRefsToday.add(key)
        bookings.today += 1
      }
      if (withinDays(ts, 7) && !bookingRefsWeek.has(key)) {
        bookingRefsWeek.add(key)
        bookings.week += 1
      }
      if (withinDays(ts, 30) && !bookingRefsMonth.has(key)) {
        bookingRefsMonth.add(key)
        bookings.month += 1
      }
    }
  }

  return { quoteStarts, bookings }
}

/** @param {string} label */
export function normalizeVisitorClickLabel(label) {
  const l = String(label || '').trim()
  if (!l) return ''
  if (/^Footer:\s*Admin/i.test(l)) return 'Footer: Admin'
  if (/^Nav:\s*/i.test(l)) return l.replace(/\s+/g, ' ').slice(0, 48)
  return l.length > 56 ? `${l.slice(0, 54)}…` : l
}

/**
 * Badge tone for event_name (admin display only).
 * @param {string} eventName
 */
export function eventBadgeTone(eventName) {
  const n = String(eventName || '')
  if (n === 'page_view') return 'slate'
  if (n === 'button_click' || n === 'new_quote_from_service') return 'blue'
  if (n === 'quote_started' || n.startsWith('quote_step_')) return 'amber'
  if (n === 'payment_completed' || n === 'booking_completed') return 'green'
  if (n === 'quote_abandoned') return 'orange'
  if (n === 'payment_started') return 'violet'
  if (n === 'quote_completed') return 'teal'
  return 'slate'
}

/**
 * Group noisy duplicate visitor rows for compact admin table.
 * @param {Array<Record<string, unknown>>} events
 * @param {{ limit?: number }} [opts]
 */
export function groupVisitorActivityForDisplay(events, opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 80, 1), 150)
  const sorted = [...(events || [])].sort(
    (a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime(),
  )

  /** @type {Map<string, { count: number, latest: Record<string, unknown>, clickLabel: string }>} */
  const groups = new Map()

  for (const ev of sorted) {
    const rawClick = eventClickLabel(ev)
    const clickLabel = normalizeVisitorClickLabel(rawClick) || rawClick
    const name = String(ev.event_name || '')
    const page = String(ev.page_path || '/')
    const groupKey = `${name}|${page}|${clickLabel}`

    const existing = groups.get(groupKey)
    if (existing) {
      existing.count += 1
      if (new Date(String(ev.created_at)) > new Date(String(existing.latest.created_at))) {
        existing.latest = ev
      }
    } else {
      groups.set(groupKey, { count: 1, latest: ev, clickLabel })
    }
  }

  return [...groups.values()]
    .sort(
      (a, b) =>
        new Date(String(b.latest.created_at)).getTime() - new Date(String(a.latest.created_at)).getTime(),
    )
    .slice(0, limit)
    .map((g, i) => ({
      id: String(g.latest.id || `grp-${i}`),
      count: g.count,
      clickLabel: g.clickLabel,
      event: g.latest,
    }))
}
