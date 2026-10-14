import { useEffect, useRef, useState } from 'react'
import { repairEmailPreviewLogo } from '../../lib/emailLogoUrl'
import RecoveryEmailPreviewFrame from './RecoveryEmailPreviewFrame'

/**
 * Large email preview. Header and footer stay compact; the message uses the
 * remaining height and is the only vertical scroll.
 *
 * @param {{
 *   kicker: string,
 *   subject: string,
 *   to?: string,
 *   html?: string,
 *   missingMessage?: string,
 *   repairLogo?: boolean,
 *   onClose: () => void,
 *   footer?: import('react').ReactNode,
 * }} props
 */
export default function EmailPreviewDialog({
  kicker,
  subject,
  to = '',
  html = '',
  missingMessage = '',
  repairLogo = false,
  onClose,
  footer = null,
}) {
  const [fullScreen, setFullScreen] = useState(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const frameHtml = repairLogo ? repairEmailPreviewLogo(html) : html

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const shell = fullScreen
    ? 'flex h-[100dvh] w-full flex-col bg-white'
    : 'flex h-[100dvh] w-full flex-col bg-white sm:m-auto sm:h-[90vh] sm:w-[min(960px,calc(100vw-2rem))] sm:rounded-2xl sm:shadow-xl'

  return (
    <div className="fixed inset-0 z-[80] flex bg-slate-900/60 sm:items-center sm:justify-center" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Email preview"
        className={shell}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{kicker}</p>
            <p className="truncate text-sm font-bold text-slate-900">{subject || 'Email'}</p>
            {to ? <p className="truncate text-xs text-slate-600">To: {to}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => setFullScreen((open) => !open)}
            className="hidden shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex"
          >
            {fullScreen ? 'Exit full screen' : 'Open full screen'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        {missingMessage ? (
          <p className="min-h-0 flex-1 px-4 py-8 text-sm text-slate-700">{missingMessage}</p>
        ) : (
          <div className="relative min-h-0 flex-1">
            <RecoveryEmailPreviewFrame
              html={frameHtml}
              repairLogo={repairLogo}
              className="absolute inset-0 h-full w-full border-0 bg-white"
            />
          </div>
        )}
        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-2">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
