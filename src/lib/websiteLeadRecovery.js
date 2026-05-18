import { isWebsiteLeadAbandoned } from './data/websiteLeadsRepository'

const HIGH_VALUE_GBP = 400

/**
 * @param {Record<string, unknown>} row
 */
export function recoveryStatusForLead(row) {
  if (row.recovered_booking) return 'Recovered'
  if (row.recovery_email_clicked) return 'Clicked'
  if (row.recovery_email_opened) return 'Opened'
  if (row.recovery_email_sent) return 'Sent'
  if (row.recovery_scheduled_at) return 'Scheduled'
  return 'Not sent'
}

/**
 * @param {Record<string, unknown>[]} rows
 */
export function computeFunnelStats(rows) {
  const list = rows || []
  const visitors = list.filter((r) => (r.effective_status || r.status) === 'visited').length
  const started = list.filter((r) => {
    const s = r.effective_status || r.status
    return s === 'quote_started' || s === 'step_completed'
  }).length
  const abandoned = list.filter((r) => (r.effective_status || r.status) === 'quote_abandoned').length
  const recoverySent = list.filter((r) => r.recovery_email_sent).length
  const recovered = list.filter((r) => r.recovered_booking).length
  const completed = list.filter((r) => (r.effective_status || r.status) === 'payment_completed').length
  const conversionPct = started > 0 ? Math.round((completed / started) * 1000) / 10 : 0

  return {
    visitors,
    started,
    abandoned,
    recoverySent,
    recovered,
    completed,
    conversionPct,
  }
}

/**
 * @param {Record<string, unknown>[]} rows
 */
export function computeAbandonmentAnalytics(rows) {
  const abandoned = (rows || []).filter((r) => (r.effective_status || r.status) === 'quote_abandoned')
  const reasonCounts = {}
  let valueSum = 0
  let valueCount = 0
  const cityCounts = {}

  for (const r of abandoned) {
    const reason = String(r.feedback_reason || 'Unknown').trim() || 'Unknown'
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1
    if (r.estimated_total != null && Number.isFinite(Number(r.estimated_total))) {
      valueSum += Number(r.estimated_total)
      valueCount += 1
    }
    const city = String(r.city_route || r.delivery_postcode || r.pickup_postcode || 'Unknown').trim()
    cityCounts[city] = (cityCounts[city] || 0) + 1
  }

  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]
  const topCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0]
  const recoverySent = abandoned.filter((r) => r.recovery_email_sent).length
  const recovered = abandoned.filter((r) => r.recovered_booking).length

  return {
    topReason: topReason ? { label: topReason[0], count: topReason[1] } : null,
    avgAbandonedValue: valueCount > 0 ? valueSum / valueCount : null,
    recoveryConversionPct: recoverySent > 0 ? Math.round((recovered / recoverySent) * 1000) / 10 : 0,
    topCity: topCity ? { label: topCity[0], count: topCity[1] } : null,
  }
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {string} chip
 */
export function filterLeadsByRecoveryChip(rows, chip) {
  if (!chip || chip === 'all') return rows
  return rows.filter((r) => {
    switch (chip) {
      case 'recovery_sent':
        return Boolean(r.recovery_email_sent)
      case 'feedback':
        return Boolean(r.feedback_received_at || r.feedback_reason)
      case 'recovered':
        return Boolean(r.recovered_booking)
      case 'high_value':
        return Number(r.estimated_total) >= HIGH_VALUE_GBP
      default:
        return true
    }
  })
}

/**
 * @param {Record<string, unknown>} row
 */
export function leadNeedsAbandonmentSchedule(row) {
  const eff = row.effective_status || row.status
  if (eff === 'payment_completed' || eff === 'quote_completed' || eff === 'payment_started') {
    return false
  }
  if (eff !== 'quote_abandoned' && !isWebsiteLeadAbandoned(row.last_activity_at)) return false
  return !row.recovery_email_sent && !row.recovery_scheduled_at
}

/**
 * @param {Record<string, unknown>[]} rows
 * @returns {string}
 */
export function exportAbandonedLeadsCsv(rows) {
  const headers = [
    'quote_ref',
    'service_type',
    'customer_name',
    'customer_email',
    'customer_phone',
    'pickup_postcode',
    'delivery_postcode',
    'estimated_total',
    'status',
    'last_activity_at',
    'recovery_status',
  ]
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.quote_ref,
        r.service_type,
        r.customer_name,
        r.customer_email,
        r.customer_phone,
        r.pickup_postcode,
        r.delivery_postcode,
        r.estimated_total,
        r.effective_status || r.status,
        r.last_activity_at,
        recoveryStatusForLead(r),
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
  }
  return lines.join('\n')
}

/**
 * @param {unknown} timeline
 * @returns {{ at: string, label: string }[]}
 */
export function normalizeLeadTimeline(timeline) {
  if (!Array.isArray(timeline)) return []
  return timeline
    .filter((e) => e && typeof e === 'object')
    .map((e) => ({
      at: String(e.at || e.time || ''),
      label: String(e.label || e.event || ''),
    }))
    .filter((e) => e.label)
}
