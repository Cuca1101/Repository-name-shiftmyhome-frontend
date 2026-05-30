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

  const forceCleanup = input.forceCleanup !== false

  try {
    if (forceCleanup) {
      try {
        await adminCleanupDriverFleetLinksClient(driverId)
      } catch (clientCleanupErr) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[deleteDriverAccountAdmin] client cleanup partial:', clientCleanupErr)
        }
      }
    }
    const result = await invokeAdminDriverLifecycle(driverId, 'delete', {
      deleteAuthUser: input.deleteAuthUser !== false,
      forceCleanup,
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
