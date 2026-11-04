import { isSupabaseConfigured, supabase } from '../supabase'

const ARRIVAL_STATUSES = [
  'arrived',
  'arrived_pickup',
  'arrived_delivery',
  'arrived_at_collection',
  'arrived_at_delivery',
  'arrived_collection',
  'at_collection',
  'at_delivery',
]

/**
 * Arrival stamps and customer ratings for the quotes already loaded.
 * Missing tables return empty lists so the dashboard still renders.
 * @param {string[]} quoteIds
 */
export async function fetchInsightsSignals(quoteIds) {
  if (!isSupabaseConfigured || !supabase) return { events: [], feedback: [] }
  const ids = [...new Set((quoteIds || []).map((id) => String(id || '').trim()).filter(Boolean))]
  /** @type {Record<string, unknown>[]} */
  const events = []
  /** @type {Record<string, unknown>[]} */
  const feedback = []

  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80)
    const [history, ratings] = await Promise.all([
      supabase
        .from('job_status_history')
        .select('quote_id, status, occurred_at, created_at, stop_type')
        .in('quote_id', chunk)
        .in('status', ARRIVAL_STATUSES)
        .limit(2000),
      supabase
        .from('job_customer_feedback')
        .select('quote_id, rating, driver_rating, submitted_at')
        .in('quote_id', chunk)
        .limit(500),
    ])

    if (!history.error) events.push(...(history.data || []))
    else if (!/stop_type|schema cache/i.test(history.error.message || '')) {
      const retry = await supabase
        .from('job_status_history')
        .select('quote_id, status, occurred_at, created_at')
        .in('quote_id', chunk)
        .in('status', ARRIVAL_STATUSES)
        .limit(2000)
      if (!retry.error) events.push(...(retry.data || []))
    }
    if (!ratings.error) feedback.push(...(ratings.data || []))
  }

  return { events, feedback }
}
