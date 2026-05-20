/**
 * Client-side aggregates for website_events (admin dashboard).
 * @param {Array<Record<string, unknown>>} events
 */
export function computeWebsiteEventAnalytics(events) {
  const list = Array.isArray(events) ? events : []
  const now = Date.now()
  const MS_DAY = 86400000

  /** @param {string|undefined} ts */
  function ageMs(ts) {
    if (!ts) return Infinity
    return now - new Date(ts).getTime()
  }

  /** @param {string|undefined} ts @param {number} days */
  function withinDays(ts, days) {
    return ageMs(ts) <= days * MS_DAY
  }

  const pageViews = { today: 0, week: 0, month: 0 }
  const clicks = { today: 0, week: 0, month: 0 }
  const quoteStarts = { today: 0, week: 0, month: 0 }
  const bookings = { today: 0, week: 0, month: 0 }
  const sessionsToday = new Set()
  const sessionsWeek = new Set()
  const sessionsMonth = new Set()

  const pageViewCounts = new Map()
  const clickLabelCounts = new Map()

  const QUOTE_START_EVENTS = new Set([
    'quote_started',
    'new_quote_started',
    'new_quote_from_service',
    'saved_quote_resumed',
    'visitor_started_quote',
  ])

  for (const ev of list) {
    const ts = String(ev.created_at || '')
    const name = String(ev.event_name || '')
    const sid = String(ev.session_id || '')
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

    if (name === 'button_click') {
      if (withinDays(ts, 1)) clicks.today += 1
      if (withinDays(ts, 7)) clicks.week += 1
      if (withinDays(ts, 30)) clicks.month += 1
      const label = String(meta.label || 'Click').trim() || 'Click'
      clickLabelCounts.set(label, (clickLabelCounts.get(label) || 0) + 1)
    }

    if (QUOTE_START_EVENTS.has(name)) {
      if (withinDays(ts, 1)) quoteStarts.today += 1
      if (withinDays(ts, 7)) quoteStarts.week += 1
      if (withinDays(ts, 30)) quoteStarts.month += 1
    }

    if (name === 'booking_completed') {
      if (withinDays(ts, 1)) bookings.today += 1
      if (withinDays(ts, 7)) bookings.week += 1
      if (withinDays(ts, 30)) bookings.month += 1
    }

    if (sid) {
      if (withinDays(ts, 1)) sessionsToday.add(sid)
      if (withinDays(ts, 7)) sessionsWeek.add(sid)
      if (withinDays(ts, 30)) sessionsMonth.add(sid)
    }
  }

  const topPages = [...pageViewCounts.entries()]
    .map(([page_path, count]) => ({ page_path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  const topClicks = [...clickLabelCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  return {
    pageViews,
    clicks,
    quoteStarts,
    bookings,
    uniqueSessions: {
      today: sessionsToday.size,
      week: sessionsWeek.size,
      month: sessionsMonth.size,
    },
    topPages,
    topClicks,
  }
}

/**
 * @param {Record<string, unknown>} ev
 */
export function eventClickLabel(ev) {
  const meta = ev?.metadata
  if (meta && typeof meta === 'object' && !Array.isArray(meta) && meta.label) {
    return String(meta.label)
  }
  return ''
}
