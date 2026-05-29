import { isSupabaseConfigured, supabase } from '../supabase'

const VIEW = 'booking_workflow_status_v'

/**
 * Latest driver workflow event per quote (from job_status_history via view).
 *
 * @param {string[]} quoteIds
 * @returns {Promise<Record<string, { workflow_status: string, workflow_at: string }>>}
 */
export async function fetchBookingWorkflowByQuoteIds(quoteIds) {
  /** @type {Record<string, { workflow_status: string, workflow_at: string }>} */
  const out = {}
  if (!isSupabaseConfigured || !supabase) return out

  const ids = [...new Set((quoteIds || []).map((x) => String(x || '').trim()).filter(Boolean))]
  if (ids.length === 0) return out

  const { data, error } = await supabase
    .from(VIEW)
    .select('quote_id, workflow_status, workflow_at')
    .in('quote_id', ids.slice(0, 200))

  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[booking_workflow_status_v] fetch failed', error.message)
    }
    return out
  }

  for (const row of data ?? []) {
    if (!row?.quote_id) continue
    out[String(row.quote_id)] = {
      workflow_status: String(row.workflow_status || ''),
      workflow_at: row.workflow_at != null ? String(row.workflow_at) : '',
    }
  }
  return out
}

/**
 * Full driver status timeline for admin Status Tracker (oldest → newest).
 *
 * @param {string} quoteId
 * @returns {Promise<Array<{ status: string, created_at: string }>>}
 */
export async function fetchJobStatusHistoryForQuote(quoteId) {
  if (!isSupabaseConfigured || !supabase) return []
  const id = String(quoteId || '').trim()
  if (!id) return []

  const { data, error } = await supabase
    .from('job_status_history')
    .select('status, created_at')
    .eq('quote_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[job_status_history] fetch failed', error.message)
    }
    return []
  }

  return (data ?? [])
    .filter((row) => row?.status && row?.created_at)
    .map((row) => ({
      status: String(row.status),
      created_at: String(row.created_at),
    }))
}
