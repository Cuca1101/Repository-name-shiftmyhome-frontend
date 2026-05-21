import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWebsiteCms } from '../context/WebsiteCmsContext'
import {
  announcementDismissStorageKey,
  isAnnouncementVisible,
  normalizeAnnouncement,
} from '../lib/websiteCmsDefaults'

const STYLE_CLASSES = {
  christmas: 'bg-emerald-800 text-white',
  blue: 'bg-brand-600 text-white',
  green: 'bg-emerald-600 text-white',
  warning: 'bg-amber-500 text-slate-900',
}

export default function WebsiteAnnouncementBar() {
  const { announcement, loading } = useWebsiteCms()
  const normalized = useMemo(() => normalizeAnnouncement(announcement), [announcement])
  const [dismissed, setDismissed] = useState(false)

  const storageKey = useMemo(
    () => announcementDismissStorageKey(normalized),
    [normalized],
  )

  useEffect(() => {
    if (loading) return
    try {
      setDismissed(localStorage.getItem(storageKey) === '1')
    } catch {
      setDismissed(false)
    }
  }, [storageKey, loading])

  const shouldShow = !loading && isAnnouncementVisible(normalized) && !dismissed

  if (!shouldShow) return null

  const styleClass = STYLE_CLASSES[normalized.backgroundStyle] || STYLE_CLASSES.blue
  const isExternal = normalized.buttonLink.startsWith('http')
  const hasButton = Boolean(normalized.buttonText && normalized.buttonLink)
  const showClose = normalized.showCloseButton !== false

  function handleClose() {
    setDismissed(true)
    try {
      localStorage.setItem(storageKey, '1')
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={`relative z-[60] w-full ${styleClass}`} role="region" aria-label="Announcement">
      <div className="home-container py-2 sm:py-2.5">
        <div
          className={`flex min-h-[40px] items-center gap-2 sm:min-h-[44px] sm:gap-3 ${
            showClose ? 'pr-0 sm:pr-1' : ''
          }`}
        >
          <div
            className={`min-w-0 flex-1 ${showClose ? 'pl-1 pr-1 sm:px-2' : 'px-1'} ${
              hasButton ? 'text-center sm:text-left' : 'text-center'
            }`}
          >
            <p className="break-words text-xs font-medium leading-snug sm:text-sm">
              {normalized.messageText}
            </p>
            {hasButton ? (
              <div className="mt-1.5 flex justify-center sm:justify-start">
                {isExternal ? (
                  <a
                    href={normalized.buttonLink}
                    className="inline-flex min-h-[32px] items-center rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 sm:text-sm"
                  >
                    {normalized.buttonText}
                  </a>
                ) : (
                  <Link
                    to={normalized.buttonLink}
                    className="inline-flex min-h-[32px] items-center rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 sm:text-sm"
                  >
                    {normalized.buttonText}
                  </Link>
                )}
              </div>
            ) : null}
          </div>

          {showClose ? (
            <button
              type="button"
              onClick={handleClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-lg hover:bg-black/10 sm:h-10 sm:w-10"
              aria-label="Dismiss announcement"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
