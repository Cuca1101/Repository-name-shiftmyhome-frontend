import { useCallback, useEffect, useState } from 'react'
import {
  isProtectedMarketplaceSettingsUnlocked,
  lockProtectedMarketplaceSettings,
  protectedMarketplaceSettingsUnlockRemainingMs,
  setProtectedMarketplaceSettingsUnlocked,
} from '../lib/adminProtectedMarketplaceSettingsSession'
import { verifyProtectedMarketplaceSettingsUnlock } from '../lib/adminProtectedMarketplaceSettingsAuth'
import { debugProtectedSettings } from '../lib/adminProtectedMarketplaceSettingsDebug'

/**
 * Session unlock for protected marketplace margin + auto-send settings.
 */
export function useProtectedMarketplaceSettingsUnlock() {
  const [unlocked, setUnlocked] = useState(() => isProtectedMarketplaceSettingsUnlocked())
  const [remainingMs, setRemainingMs] = useState(() => protectedMarketplaceSettingsUnlockRemainingMs())

  const refresh = useCallback(() => {
    const ok = isProtectedMarketplaceSettingsUnlocked()
    setUnlocked(ok)
    setRemainingMs(ok ? protectedMarketplaceSettingsUnlockRemainingMs() : null)
  }, [])

  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, 5000)
    return () => window.clearInterval(id)
  }, [refresh])

  const unlock = useCallback(
    async (creds) => {
      debugProtectedSettings('unlock-attempt', {
        mode: creds.pin ? 'pin' : 'password',
        pinLength: creds.pin ? String(creds.pin).length : 0,
      })
      const result = await verifyProtectedMarketplaceSettingsUnlock(creds)
      if (!result.ok) {
        debugProtectedSettings('unlock-failed', { error: result.error, method: result.method })
        return result
      }
      setProtectedMarketplaceSettingsUnlocked()
      refresh()
      debugProtectedSettings('unlock-state', {
        unlocked: isProtectedMarketplaceSettingsUnlocked(),
        remainingMs: protectedMarketplaceSettingsUnlockRemainingMs(),
        method: result.method,
      })
      return { ok: true }
    },
    [refresh],
  )

  const lock = useCallback(() => {
    lockProtectedMarketplaceSettings()
    refresh()
  }, [refresh])

  return { unlocked, remainingMs, unlock, lock, refresh }
}
