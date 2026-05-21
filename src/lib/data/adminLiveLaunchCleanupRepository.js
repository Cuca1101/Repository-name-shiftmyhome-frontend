import { isSupabaseConfigured, supabase } from '../supabaseClient'

/**
 * @returns {Promise<{ quotesToArchive: number, quotesProtected: number, journeysToArchive: number } | null>}
 */
export async function fetchLiveLaunchCleanupStats() {
  if (!isSupabaseConfigured || !supabase) return null
  const { data, error } = await supabase.rpc('admin_live_launch_cleanup_stats')
  if (error) {
    if (isMissingRpc(error)) return null
    throw new Error(error.message || 'Could not load launch cleanup stats.')
  }
  const row = data && typeof data === 'object' ? data : {}
  return {
    quotesToArchive: Number(row.quotes_to_archive) || 0,
    quotesProtected: Number(row.quotes_protected) || 0,
    journeysToArchive: Number(row.journeys_to_archive) || 0,
  }
}

/**
 * @param {number} [batchSize]
 * @returns {Promise<{ quotesArchived: number, journeysArchived: number }>}
 */
export async function runLiveLaunchCleanupBatch(batchSize = 200) {
  if (!isSupabaseConfigured || !supabase) {
    return { quotesArchived: 0, journeysArchived: 0 }
  }
  const { data, error } = await supabase.rpc('admin_live_launch_cleanup', {
    p_batch_size: batchSize,
  })
  if (error) {
    if (isMissingRpc(error)) {
      throw new Error(
        'Server cleanup is not available. Apply migration 043_admin_live_launch_cleanup.sql.',
      )
    }
    throw new Error(error.message || 'Launch cleanup batch failed.')
  }
  const row = data && typeof data === 'object' ? data : {}
  if (row.ok === false) {
    throw new Error(String(row.error || 'Launch cleanup failed.'))
  }
  return {
    quotesArchived: Number(row.quotes_archived) || 0,
    journeysArchived: Number(row.journeys_archived) || 0,
  }
}

/** @param {unknown} err */
function isMissingRpc(err) {
  const msg = `${err?.message || ''} ${err?.code || ''}`.toLowerCase()
  return (
    msg.includes('could not find the function') ||
    msg.includes('admin_live_launch_cleanup') ||
    msg.includes('pgrst202')
  )
}
