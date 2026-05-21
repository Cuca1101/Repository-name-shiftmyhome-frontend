import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onUnlock: (creds: { password?: string, pin?: string }) => Promise<{ ok: boolean, error?: string }>,
 *   title?: string,
 * }} props
 */
export default function UnlockProtectedSettingsModal({
  open,
  onClose,
  onUnlock,
  title = 'Unlock protected settings',
}) {
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [mode, setMode] = useState('password')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setPassword('')
      setPin('')
      setError('')
      setBusy(false)
    }
  }, [open])

  if (!open) return null

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const creds =
        mode === 'pin' ? { pin } : { password }
      const result = await onUnlock(creds)
      if (!result.ok) {
        setError(result.error || 'Verification failed.')
        return
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unlock-protected-settings-title"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <Lock className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="unlock-protected-settings-title" className="text-lg font-bold text-slate-900">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Verify with your admin password or PIN. Unlock lasts 30 minutes for this browser session.
            </p>
          </div>
        </div>

        <div className="mt-4 flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => setMode('password')}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold ${
              mode === 'password' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Admin password
          </button>
          <button
            type="button"
            onClick={() => setMode('pin')}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold ${
              mode === 'pin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            PIN
          </button>
        </div>

        {mode === 'password' ? (
          <label className="mt-4 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Admin password
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
            />
          </label>
        ) : (
          <label className="mt-4 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Admin PIN
            </span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
            />
          </label>
        )}

        {error ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy}
            className="min-h-[44px] flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? 'Verifying…' : 'Unlock'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
