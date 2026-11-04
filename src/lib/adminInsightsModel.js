import { ukCalendarYmd } from './formatDateDisplay'

const UK = 'Europe/London'

function paidQuote(q) {
  const status = String(q.payment_status || '')
  return status === 'paid' || status === 'deposit_paid'
}

function ymdFromIso(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return ukCalendarYmd(date)
}

function clockMinutes(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: UK,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

function quoteDay(q) {
  const move = String(q.move_date || '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(move)) return move
  if (q.completed_at) return ymdFromIso(q.completed_at)
  if (q.paid_at) return ymdFromIso(q.paid_at)
  return ''
}

function monthKeyFromYmd(ymd) {
  return String(ymd || '').slice(0, 7)
}

function shiftMonth(ym, delta) {
  const [year, month] = String(ym).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function formatClock(minutes) {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** Pickup window in minutes from midnight, or null when the booking has no time. */
function pickupWindow(q) {
  const blob = `${q.arrival_window || ''} ${q.arrival_time || ''}`
  const range = blob.match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/)
  if (range) {
    return [Number(range[1]) * 60 + Number(range[2]), Number(range[3]) * 60 + Number(range[4])]
  }
  const presets = { morning: [8 * 60, 12 * 60], midday: [12 * 60, 16 * 60], evening: [16 * 60, 20 * 60] }
  const key = String(q.arrival_window || '').trim()
  if (presets[key]) return presets[key]
  if (key === 'flex_window') return null
  const exact = blob.match(/(\d{1,2}):(\d{2})/)
  if (!exact) return null
  const at = Number(exact[1]) * 60 + Number(exact[2])
  return [at, at + 10]
}

/**
 * @param {string} iso
 * @param {string} moveYmd
 * @param {[number, number] | null} window
 */
function classifySameDay(iso, moveYmd) {
  if (!iso || !moveYmd) return null
  const day = ymdFromIso(iso)
  if (!day) return null
  if (day < moveYmd) return { state: 'early', label: 'Early', detail: '' }
  if (day === moveYmd) return { state: 'ontime', label: 'On time', detail: '' }
  return { state: 'late', label: 'Late', detail: 'Next day' }
}

function classifyArrival(iso, moveYmd, window) {
  if (!iso || !moveYmd || !window) return null
  const day = ymdFromIso(iso)
  const minutes = clockMinutes(iso)
  if (!day || minutes == null) return null
  const [start, end] = window
  if (day > moveYmd) return { state: 'late', label: 'Late', detail: 'Next day' }
  if (day < moveYmd) return { state: 'early', label: 'Early', detail: 'Day before' }
  if (minutes < start) {
    const early = start - minutes
    return { state: 'early', label: 'Early', detail: `${early} min early` }
  }
  if (minutes <= end) return { state: 'ontime', label: 'On time', detail: '' }
  return { state: 'late', label: 'Late', detail: `${minutes - end} min late` }
}

function indexArrivals(events) {
  /** @type {Map<string, { pickup: string, delivery: string, plain: string[] }>} */
  const byQuote = new Map()
  for (const row of events || []) {
    const id = String(row.quote_id || '')
    const at = String(row.occurred_at || row.created_at || '')
    if (!id || !at) continue
    const status = String(row.status || '').trim().toLowerCase().replace(/\s+/g, '_')
    const stop = String(row.stop_type || '').toLowerCase()
    if (!byQuote.has(id)) byQuote.set(id, { pickup: '', delivery: '', plain: [] })
    const bag = byQuote.get(id)
    const pickup = /pickup|collection/.test(status) || (status === 'arrived' && /pick|collect/.test(stop))
    const delivery = /delivery/.test(status) || (status === 'arrived' && /deliv/.test(stop))
    if (pickup) {
      if (!bag.pickup || at < bag.pickup) bag.pickup = at
    } else if (delivery) {
      if (!bag.delivery || at < bag.delivery) bag.delivery = at
    } else if (status === 'arrived') {
      bag.plain.push(at)
    }
  }
  for (const bag of byQuote.values()) {
    bag.plain.sort()
    if (!bag.pickup && bag.plain[0]) bag.pickup = bag.plain[0]
    if (!bag.delivery && bag.plain[1]) bag.delivery = bag.plain[1]
  }
  return byQuote
}

function indexFeedback(rows) {
  const byQuote = new Map()
  for (const row of rows || []) {
    const id = String(row.quote_id || '')
    if (!id) continue
    const rating = Number(row.driver_rating || row.rating)
    if (!Number.isFinite(rating)) continue
    byQuote.set(id, rating)
  }
  return byQuote
}

function rate(hits, total) {
  if (!total) return null
  return Math.round((hits / total) * 100)
}

function average(values) {
  if (!values.length) return null
  const sum = values.reduce((total, value) => total + value, 0)
  return Math.round((sum / values.length) * 10) / 10
}

function sumPaid(rows) {
  return rows.reduce((total, row) => total + (Number(row.amount_paid) || 0), 0)
}

/**
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, unknown>[]} events
 * @param {Record<string, unknown>[]} feedback
 * @param {number} [now]
 */
export function buildAdminInsights(quotes, events, feedback, now = Date.now()) {
  const arrivals = indexArrivals(events)
  const ratings = indexFeedback(feedback)
  const thisMonth = monthKeyFromYmd(ukCalendarYmd(new Date(now)))
  const lastMonth = shiftMonth(thisMonth, -1)
  const paid = (quotes || []).filter(paidQuote)

  const scored = paid.map((quote) => {
    const day = quoteDay(quote)
    const window = pickupWindow(quote)
    const stamps = arrivals.get(String(quote.id)) || { pickup: '', delivery: '' }
    const pickup = classifyArrival(stamps.pickup, day, window)
    const delivery = classifySameDay(stamps.delivery, day)
    const rating = ratings.get(String(quote.id)) ?? null
    const cancelledDay = quote.cancelled_at ? ymdFromIso(quote.cancelled_at) : ''
    return {
      quote,
      day,
      month: monthKeyFromYmd(day),
      window,
      pickup,
      delivery,
      rating,
      cancelledOnDay: Boolean(cancelledDay && day && cancelledDay === day),
      open: !quote.completed_at && !quote.cancelled_at,
    }
  })

  function periodStats(month) {
    const rows = scored.filter((row) => row.month === month)
    const pickupJudged = rows.filter((row) => row.pickup)
    const deliveryJudged = rows.filter((row) => row.delivery)
    const rated = rows.filter((row) => row.rating != null)
    const onTime = (row, key) => row[key] && row[key].state !== 'late'
    return {
      jobs: rows.length,
      collected: sumPaid(rows.map((row) => row.quote)),
      pickupPct: rate(pickupJudged.filter((row) => onTime(row, 'pickup')).length, pickupJudged.length),
      pickupJudged: pickupJudged.length,
      deliveryPct: rate(deliveryJudged.filter((row) => onTime(row, 'delivery')).length, deliveryJudged.length),
      deliveryJudged: deliveryJudged.length,
      ratedPct: rate(rated.length, rows.length),
      ratedCount: rated.length,
      rating: average(rated.map((row) => row.rating)),
      cancelledOnDay: rows.filter((row) => row.cancelledOnDay).length,
      cancelledPct: rate(rows.filter((row) => row.cancelledOnDay).length, rows.length),
      open: rows.filter((row) => row.open).length,
    }
  }

  const current = periodStats(thisMonth)
  const previous = periodStats(lastMonth)

  /** @type {Map<string, { name: string, jobs: number, rated: number, ratings: number[], pickupHit: number, pickupJudged: number, deliveryHit: number, deliveryJudged: number }>} */
  const drivers = new Map()
  for (const row of scored.filter((item) => item.month === thisMonth)) {
    const name = String(row.quote.assigned_driver_name || '').trim()
    if (!name) continue
    if (!drivers.has(name)) {
      drivers.set(name, {
        name,
        jobs: 0,
        rated: 0,
        ratings: [],
        pickupHit: 0,
        pickupJudged: 0,
        deliveryHit: 0,
        deliveryJudged: 0,
      })
    }
    const driver = drivers.get(name)
    driver.jobs += 1
    if (row.rating != null) {
      driver.rated += 1
      driver.ratings.push(row.rating)
    }
    if (row.pickup) {
      driver.pickupJudged += 1
      if (row.pickup.state !== 'late') driver.pickupHit += 1
    }
    if (row.delivery) {
      driver.deliveryJudged += 1
      if (row.delivery.state !== 'late') driver.deliveryHit += 1
    }
  }

  const driverRows = [...drivers.values()]
    .map((driver) => ({
      ...driver,
      rating: average(driver.ratings),
      pickupPct: rate(driver.pickupHit, driver.pickupJudged),
      deliveryPct: rate(driver.deliveryHit, driver.deliveryJudged),
    }))
    .sort((a, b) => b.jobs - a.jobs || String(a.name).localeCompare(String(b.name)))

  const jobRows = scored
    .filter((row) => row.month === thisMonth)
    .sort((a, b) => String(b.day).localeCompare(String(a.day)))
    .slice(0, 20)
    .map((row) => ({
      id: String(row.quote.id),
      ref: String(row.quote.quote_ref || '—'),
      customer: String(row.quote.full_name || '—'),
      driver: String(row.quote.assigned_driver_name || '').trim() || '—',
      day: row.day,
      planned: row.window ? formatClock(row.window[0]) : '—',
      pickup: row.pickup,
      delivery: row.delivery,
      rating: row.rating,
      href: row.quote.assigned_at || row.quote.assigned_driver_id || row.quote.completed_at
        ? `/admin/active-jobs/${row.quote.id}`
        : `/admin/available-jobs/${row.quote.id}`,
    }))

  const today = ukCalendarYmd(new Date(now))
  const days = []
  for (let i = 29; i >= 0; i -= 1) {
    const date = new Date(new Date(`${today}T12:00:00Z`).getTime() - i * 86400000)
    const ymd = date.toISOString().slice(0, 10)
    const rows = scored.filter((row) => row.day === ymd)
    const judged = rows.filter((row) => row.pickup)
    days.push({
      day: ymd,
      label: `${Number(ymd.slice(8, 10))}`,
      jobs: rows.length,
      collected: sumPaid(rows.map((row) => row.quote)),
      pickupPct: rate(judged.filter((row) => row.pickup.state !== 'late').length, judged.length),
    })
  }

  return { thisMonth, lastMonth, current, previous, driverRows, jobRows, days }
}
