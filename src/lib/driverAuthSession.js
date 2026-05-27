import { isSupabaseConfigured, supabase } from './supabase'
import {
  buildPreviewDriverProfile,
  DRIVER_AUTH_INACTIVE,
  DRIVER_AUTH_NO_PROFILE,
  driverAuthMessageForCode,
} from './driverAuthModel'
import { fetchFleetDriverByUserId, fleetDriverToAdminRecord } from './data/driversRepository'

/**
 * True when mobile/driver UI should use a local preview profile (no Auth).
 */
export function isDriverPreviewMode() {
  return import.meta.env.VITE_DRIVER_PREVIEW_MODE === 'true'
}

/**
 * After Supabase Auth sign-in, resolve linked driver profile for mobile app access.
 *
 * @param {{ userId?: string | null, previewMode?: boolean }} [opts]
 * @returns {Promise<{
 *   ok: boolean,
 *   code?: string,
 *   message?: string,
 *   preview?: boolean,
 *   driver?: ReturnType<typeof fleetDriverToAdminRecord> | null,
 * }>}
 */
export async function resolveDriverAccessAfterLogin(opts = {}) {
  const preview = opts.previewMode === true || isDriverPreviewMode()

  if (preview || !isSupabaseConfigured || !supabase) {
    return {
      ok: true,
      preview: true,
      driver: buildPreviewDriverProfile(),
    }
  }

  const userId = String(opts.userId || '').trim()
  if (!userId) {
    const { data } = await supabase.auth.getUser()
    const uid = data?.user?.id
    if (!uid) {
      return { ok: false, code: 'no_session', message: 'Not signed in.' }
    }
    return resolveDriverAccessAfterLogin({ userId: uid, previewMode: false })
  }

  const row = await fetchFleetDriverByUserId(userId)
  if (!row) {
    return {
      ok: false,
      code: DRIVER_AUTH_NO_PROFILE,
      message: driverAuthMessageForCode(DRIVER_AUTH_NO_PROFILE),
      driver: null,
    }
  }

  const driver = fleetDriverToAdminRecord(row)
  const active =
    row.active !== false &&
    driver.accountActive !== false &&
    String(driver.status || '') !== 'Archived' &&
    String(row.fleet_status || '') !== 'Archived'
  if (!active) {
    return {
      ok: false,
      code: DRIVER_AUTH_INACTIVE,
      message: driverAuthMessageForCode(DRIVER_AUTH_INACTIVE),
      driver,
    }
  }

  return { ok: true, driver, preview: false }
}

/**
 * Sign in driver with email/password, then resolve profile.
 *
 * @param {{ email: string, password: string, previewMode?: boolean }} creds
 */
export async function signInDriverWithPassword(creds) {
  if (creds.previewMode === true || isDriverPreviewMode()) {
    return {
      ok: true,
      preview: true,
      driver: buildPreviewDriverProfile(),
      session: null,
    }
  }

  if (!supabase) {
    return { ok: false, message: 'Supabase is not configured.' }
  }

  const email = String(creds.email || '').trim()
  const password = String(creds.password || '')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { ok: false, message: error.message || 'Sign-in failed.' }
  }

  const userId = data?.user?.id
  if (!userId) {
    return { ok: false, message: 'Sign-in succeeded but no user id was returned.' }
  }

  const access = await resolveDriverAccessAfterLogin({ userId })
  if (!access.ok) {
    await supabase.auth.signOut()
    return { ...access, session: null }
  }

  return { ...access, session: data.session }
}
