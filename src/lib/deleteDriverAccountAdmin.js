import { isSupabaseConfigured } from './supabase'
import { adminCleanupDriverFleetLinksClient } from './adminDriverForceCleanup'
import { DRIVER_ARCHIVE_INSTEAD_MESSAGE } from './driverAdminLifecycle'
import { invokeAdminDriverLifecycle } from './adminDriverLifecycleApi'

/**
 * Hard-delete driver with no fleet history (Auth user removed server-side).
 *
 * @param {{ driverId: string, deleteAuthUser?: boolean, forceCleanup?: boolean }} input
 */
export async function deleteDriverAccountAdmin(input) {
  if (!isSupabaseConfigured) {
    throw new Error('Connect Supabase to delete drivers.')
  }

  const driverId = String(input.driverId || '').trim()
  if (!driverId) throw new Error('Driver id is required.')

  try {
    if (input.forceCleanup) {
      await adminCleanupDriverFleetLinksClient(driverId)
    }
    const result = await invokeAdminDriverLifecycle(driverId, 'delete', {
      deleteAuthUser: input.deleteAuthUser !== false,
      forceCleanup: Boolean(input.forceCleanup),
    })
    return {
      message: result.message || 'Driver deleted',
      driverId,
      authUserDeleted: Boolean(result.authUserDeleted),
      partial: Boolean(result.partial),
    }
  } catch (e) {
    if (e?.code === 'driver_has_history') throw e
    if (e?.message) throw e
    throw new Error(DRIVER_ARCHIVE_INSTEAD_MESSAGE)
  }
}
