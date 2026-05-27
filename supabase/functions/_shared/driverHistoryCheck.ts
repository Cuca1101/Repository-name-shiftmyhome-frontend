import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

export type DriverHistoryCheck = {
  hasHistory: boolean
  reasons: string[]
}

async function hasRows(
  admin: SupabaseClient,
  table: string,
  column: string,
  driverId: string,
): Promise<boolean> {
  const { count, error } = await admin
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, driverId)
  if (error) {
    console.warn(`[driverHistoryCheck] ${table}:`, error.message)
    return true
  }
  return (count ?? 0) > 0
}

/**
 * True when driver must not be hard-deleted (job/payment/audit trail exists).
 */
export async function driverHasFleetHistory(
  admin: SupabaseClient,
  driverId: string,
): Promise<DriverHistoryCheck> {
  const reasons: string[] = []

  if (await hasRows(admin, 'quotes', 'assigned_driver_id', driverId)) {
    reasons.push('assigned_quotes')
  }
  if (await hasRows(admin, 'job_assignments', 'driver_id', driverId)) {
    reasons.push('job_assignments')
  }
  if (await hasRows(admin, 'driver_charges', 'driver_id', driverId)) {
    reasons.push('driver_charges')
  }
  if (await hasRows(admin, 'job_status_history', 'driver_id', driverId)) {
    reasons.push('job_status_history')
  }
  if (await hasRows(admin, 'driver_payout_audit_log', 'driver_id', driverId)) {
    reasons.push('driver_payout_audit_log')
  }
  return { hasHistory: reasons.length > 0, reasons }
}
