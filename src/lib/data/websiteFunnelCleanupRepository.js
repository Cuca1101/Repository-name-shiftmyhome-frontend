import { formatDateTimeUK } from '../formatDateDisplay'
import { isSupabaseConfigured, supabase } from '../supabase'

/** @typedef {7 | 30 | 90} CleanupPresetDays */

/**
 * @returns {Promise<{ eventsTotal: number, abandonedSessionsTotal: number, oldestEventAt: string|null, oldestEventLabel: string }>}
 */
export async function fetchWebsiteFunnelCleanupStats() {
  if (!isSupabaseConfigured || !supabase) {
    return {
      eventsTotal: 0,
      abandonedSessionsTotal: 0,
      oldestEventAt: null,
      oldestEventLabel: '—',
    }
  }

  const { data, error } = await supabase.rpc('admin_website_funnel_cleanup_stats')
  if (error) {
    if (isMissingRpcError(error)) {
      return fetchWebsiteFunnelCleanupStatsFallback()
    }
    throw new Error(error.message || 'Failed to load cleanup stats.')
  }

  const row = data && typeof data === 'object' ? data : {}
  const oldest = row.oldest_event_at != null ? String(row.oldest_event_at) : null
  return {
    eventsTotal: Number(row.events_total) || 0,
    abandonedSessionsTotal: Number(row.abandoned_sessions_total) || 0,
    oldestEventAt: oldest,
    oldestEventLabel: oldest ? formatDateTimeUK(oldest).replace(', ', ' ') : '—',
  }
}

async function fetchWebsiteFunnelCleanupStatsFallback() {
  const [eventsCount, oldestRes, leadsRes] = await Promise.all([
    supabase.from('website_events').select('*', { count: 'exact', head: true }),
    supabase.from('website_events').select('created_at').order('created_at', { ascending: true }).limit(1),
    supabase.from('website_leads').select('*', { count: 'exact', head: true }),
  ])

  if (eventsCount.error && !isMissingTableError(eventsCount.error)) {
    throw new Error(eventsCount.error.message || 'Failed to count events.')
  }

  const oldest =
    oldestRes.data?.[0]?.created_at != null ? String(oldestRes.data[0].created_at) : null

  return {
    eventsTotal: eventsCount.count ?? 0,
    abandonedSessionsTotal: leadsRes.count ?? 0,
    oldestEventAt: oldest,
    oldestEventLabel: oldest ? formatDateTimeUK(oldest).replace(', ', ' ') : '—',
  }
}

/**
 * @param {{
 *   olderThanDays: CleanupPresetDays,
 *   clearEvents?: boolean,
 *   clearAbandoned?: boolean,
 *   clearDemo?: boolean,
 *   onProgress?: (message: string) => void,
 * }} opts
 * @returns {Promise<{ eventsDeleted: number, leadsDeleted: number }>}
 */
export async function runWebsiteFunnelCleanup(opts) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Database is not configured.')
  }

  const olderThanDays = opts.olderThanDays
  const clearEvents = Boolean(opts.clearEvents)
  const clearAbandoned = Boolean(opts.clearAbandoned)
  const clearDemo = Boolean(opts.clearDemo)

  if (!clearEvents && !clearAbandoned && !clearDemo) {
    throw new Error('Select at least one cleanup action.')
  }

  let eventsDeleted = 0
  let leadsDeleted = 0
  let pass = 0

  do {
    pass += 1
    opts.onProgress?.(
      pass === 1 ? 'Cleaning up…' : `Cleaning up (batch ${pass})…`,
    )

    const { data, error } = await supabase.rpc('admin_cleanup_website_funnel', {
      p_older_than_days: olderThanDays,
      p_clear_events: clearEvents,
      p_clear_abandoned: clearAbandoned,
      p_clear_demo: clearDemo,
    })

    if (error) {
      if (isMissingRpcError(error)) {
        throw new Error(
          'Cleanup is not available yet. Apply Supabase migration 035_website_funnel_admin_cleanup.sql.',
        )
      }
      throw new Error(error.message || 'Cleanup failed.')
    }

    const row = data && typeof data === 'object' ? data : {}
    if (row.ok === false) {
      throw new Error(String(row.error || 'Cleanup failed.'))
    }

    eventsDeleted += Number(row.events_deleted) || 0
    leadsDeleted += Number(row.leads_deleted) || 0

    const batchTotal = (Number(row.events_deleted) || 0) + (Number(row.leads_deleted) || 0)
    if (batchTotal === 0) break
  } while (pass < 25)

  return { eventsDeleted, leadsDeleted }
}

/** @param {unknown} err */
function isMissingRpcError(err) {
  const msg = `${err?.message || ''} ${err?.code || ''}`.toLowerCase()
  return (
    msg.includes('could not find the function') ||
    msg.includes('admin_cleanup_website_funnel') ||
    msg.includes('admin_website_funnel_cleanup_stats') ||
    msg.includes('pgrst202')
  )
}

/** @param {unknown} err */
function isMissingTableError(err) {
  const msg = `${err?.message || ''} ${err?.code || ''}`.toLowerCase()
  return msg.includes('does not exist') || msg.includes('42p01') || msg.includes('pgrst205')
}
