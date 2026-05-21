import { Lock, LockOpen } from 'lucide-react'
import UnlockProtectedSettingsModal from './UnlockProtectedSettingsModal'

/**
 * Compact unlock control for protected marketplace fields (no overlay).
 * @param {{
 *   unlocked: boolean,
 *   remainingMs?: number | null,
 *   onRequestUnlock: () => void,
 *   onLock?: () => void,
 *   unlockModalOpen: boolean,
 *   onCloseUnlockModal: () => void,
 *   onUnlock: (creds: { password?: string, pin?: string }) => Promise<{ ok: boolean, error?: string }>,
 * }} props
 */
export default function ProtectedMarketplaceSettingsUnlockBar({
  unlocked,
  remainingMs = null,
  onRequestUnlock,
  onLock,
  unlockModalOpen,
  onCloseUnlockModal,
  onUnlock,
}) {
  const minsLeft =
    remainingMs != null && remainingMs > 0 ? Math.max(1, Math.ceil(remainingMs / 60000)) : null

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-y border-slate-100 bg-slate-50/60 py-2">
        {unlocked ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800">
              <LockOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Unlocked for this session{minsLeft ? ` · ${minsLeft}m left` : ''}
            </span>
            {onLock ? (
              <button
                type="button"
                onClick={onLock}
                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                Lock now
              </button>
            ) : null}
          </>
        ) : (
          <>
            <span className="inline-flex max-w-[min(100%,20rem)] items-center gap-1.5 text-[11px] text-slate-600">
              <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              Protected — unlock to edit margin and auto-send
            </span>
            <button
              type="button"
              onClick={onRequestUnlock}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              <Lock className="h-3 w-3 text-slate-500" aria-hidden />
              Unlock protected settings
            </button>
          </>
        )}
      </div>

      <UnlockProtectedSettingsModal
        open={unlockModalOpen}
        onClose={onCloseUnlockModal}
        onUnlock={onUnlock}
      />
    </>
  )
}

/**
 * @param {{ locked: boolean, children: import('react').ReactNode }} props
 */
export function ProtectedFieldLabel({ locked, children }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      {locked ? (
        <Lock className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
      ) : null}
    </span>
  )
}
