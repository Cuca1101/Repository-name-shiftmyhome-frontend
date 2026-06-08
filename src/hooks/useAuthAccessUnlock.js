import { useCallback, useEffect, useState } from 'react'
import {
  authAccessUnlockRemainingMs,
  isAuthAccessUnlocked,
  lockAuthAccess,
  setAuthAccessUnlocked,
} from '../lib/adminAuthAccessSession'
import { verifyProtectedMarketplaceSettingsUnlock } from '../lib/adminProtectedMarketplaceSettingsAuth'

/** PIN/password gate for protected user access (admin vs driver roles). */
export function useAuthAccessUnlock() {
  const [unlocked, setUnlocked] = useState(() => isAuthAccessUnlocked())
  const [remainingMs, setRemainingMs] = useState(() => authAccessUnlockRemainingMs())

  const refresh = useCallback(() => {
    const ok = isAuthAccessUnlocked()
    setUnlocked(ok)
    setRemainingMs(ok ? authAccessUnlockRemainingMs() : null)
  }, [])

  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, 5000)
    return () => window.clearInterval(id)
  }, [refresh])

  const unlock = useCallback(
    async (creds) => {
      const result = await verifyProtectedMarketplaceSettingsUnlock(creds)
      if (!result.ok) return result
      setAuthAccessUnlocked()
      refresh()
      return { ok: true }
    },
    [refresh],
  )

  const lock = useCallback(() => {
    lockAuthAccess()
    refresh()
  }, [refresh])

  return { unlocked, remainingMs, unlock, lock, refresh }
}
