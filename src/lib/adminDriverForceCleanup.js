import { isSupabaseConfigured, supabase } from './supabase'

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} driverId
 */
async function resolveDriverDisplayName(client, driverId) {
  const { data, error } = await client.from('drivers').select('full_name').eq('id', driverId).maybeSingle()
  if (error) throw new Error(`Could not read driver: ${error.message}`)
  const name = String(data?.full_name || '').trim()
  return name || 'Former driver'
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} driverId
 * @param {string} driverName
 */
async function stampDriverOnQuotes(client, driverId, driverName) {
  const { data: rows, error: selErr } = await client
    .from('quotes')
    .select('id, assigned_driver_name')
    .eq('assigned_driver_id', driverId)
  if (selErr) throw new Error(`quotes read: ${selErr.message}`)

  for (const row of rows ?? []) {
    const stampedName = String(row.assigned_driver_name || '').trim() || driverName
    const { error } = await client
      .from('quotes')
      .update({ assigned_driver_id: null, assigned_driver_name: stampedName })
      .eq('id', row.id)
    if (error) throw new Error(`quotes: ${error.message}`)
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} driverId
 * @param {string} driverName
 */
async function stampDriverOnStatusHistory(client, driverId, driverName) {
  const { data: rows, error: selErr } = await client
    .from('job_status_history')
    .select('id, driver_name')
    .eq('driver_id', driverId)
  if (selErr) {
    if (String(selErr.message || '').includes('driver_name')) return
    throw new Error(`status history read: ${selErr.message}`)
  }

  for (const row of rows ?? []) {
    const stampedName = String(row.driver_name || '').trim() || driverName
    const { error } = await client.from('job_status_history').update({ driver_name: stampedName }).eq('id', row.id)
    if (error) throw new Error(`status history: ${error.message}`)
  }
}

/**
 * Admin pre-cleanup before hard delete (RLS: auth_is_admin_session).
 * Preserves assigned_driver_name on quotes and job_status_history timeline rows.
 * @param {string} driverId
 */
export async function adminCleanupDriverFleetLinksClient(driverId) {
  const id = String(driverId || '').trim()
  if (!id || !isSupabaseConfigured || !supabase) {
    throw new Error('Connect Supabase to clean up driver data.')
  }

  const errors = []
  let driverName = 'Former driver'

  try {
    driverName = await resolveDriverDisplayName(supabase, id)
    await stampDriverOnQuotes(supabase, id, driverName)
    await stampDriverOnStatusHistory(supabase, id, driverName)
  } catch (e) {
    errors.push(e?.message || 'stamp failed')
  }

  const { error: jaErr } = await supabase.from('job_assignments').delete().eq('driver_id', id)
  if (jaErr) errors.push(`assignments: ${jaErr.message}`)

  const { error: locErr } = await supabase.from('driver_locations').delete().eq('driver_id', id)
  if (locErr && !String(locErr.message || '').includes('does not exist')) {
    errors.push(`locations: ${locErr.message}`)
  }

  const { error: ecrErr } = await supabase
    .from('extra_charge_requests')
    .update({ driver_id: null })
    .eq('driver_id', id)
  if (ecrErr) errors.push(`extra charges: ${ecrErr.message}`)

  const { error: chargesErr } = await supabase.from('driver_charges').delete().eq('driver_id', id)
  if (chargesErr) errors.push(`charges: ${chargesErr.message}`)

  const { error: auditErr } = await supabase
    .from('driver_payout_audit_log')
    .update({ driver_id: null })
    .eq('driver_id', id)
  if (auditErr && !String(auditErr.message || '').includes('permission')) {
    errors.push(`payout audit: ${auditErr.message}`)
  }

  const { error: docsErr } = await supabase.from('driver_documents').delete().eq('driver_id', id)
  if (docsErr) errors.push(`documents: ${docsErr.message}`)

  if (errors.length) {
    throw new Error(`Cleanup failed — ${errors.join('; ')}`)
  }
}
