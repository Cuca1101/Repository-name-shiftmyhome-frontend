import { isSupabaseConfigured, supabase } from './supabase'

/**
 * Admin pre-cleanup before hard delete (RLS: auth_is_admin_session).
 * Mirrors edge cleanup so delete works even if function body is stale.
 * @param {string} driverId
 */
export async function adminCleanupDriverFleetLinksClient(driverId) {
  const id = String(driverId || '').trim()
  if (!id || !isSupabaseConfigured || !supabase) {
    throw new Error('Connect Supabase to clean up driver data.')
  }

  const errors = []

  const { error: histErr } = await supabase.from('job_status_history').delete().eq('driver_id', id)
  if (histErr) errors.push(`status history: ${histErr.message}`)

  const { error: jaErr } = await supabase.from('job_assignments').delete().eq('driver_id', id)
  if (jaErr) errors.push(`assignments: ${jaErr.message}`)

  const { error: quotesErr } = await supabase
    .from('quotes')
    .update({ assigned_driver_id: null })
    .eq('assigned_driver_id', id)
  if (quotesErr) errors.push(`quotes: ${quotesErr.message}`)

  const { error: locErr } = await supabase.from('driver_locations').delete().eq('driver_id', id)
  if (locErr && !String(locErr.message || '').includes('does not exist')) {
    errors.push(`locations: ${locErr.message}`)
  }

  const { error: ecrErr } = await supabase
    .from('extra_charge_requests')
    .update({ driver_id: null })
    .eq('driver_id', id)
  if (ecrErr) errors.push(`extra charges: ${ecrErr.message}`)

  if (errors.length) {
    throw new Error(`Cleanup failed — ${errors.join('; ')}`)
  }
}
