import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWebsiteCms } from '../context/WebsiteCmsContext'

const STYLE_CLASSES = {
  christmas: 'bg-emerald-800 text-white',
  blue: 'bg-brand-600 text-white',
  green: 'bg-emerald-600 text-white',
  warning: 'bg-amber-500 text-slate-900',
}

const STORAGE_PREFIX = 'smh_announcement_dismissed_'

function isWithinDateRange(startDate, endDate) {
  const now = Date.now()
  if (startDate) {
    const start = new Date(startDate).getTime()
    if (Number.isFinite(start) && now < start) return false
  }
  if (endDate) {
    const end = new Date(endDate).getTime()
    if (Number.isFinite(end) && now > end) return false
  }
  return true
}

export default function WebsiteAnnouncementBar() {
  const { announcement } = useWebsiteCms()
  const [dismissed, setDismissed] = useState(false)

  const storageKey = useMemo(() => {
    const sig = [announcement.messageText, announcement.startDate, announcement.endDate].join('|')
    return `${STORAGE_PREFIX}${encodeURIComponent(sig).slice(0, 80)}`
  }, [announcement])

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey) === '1')
    } catch {
      setDismissed(false)
    }
  }, [storageKey])

  const visible =
    announcement.enabled &&
    announcement.messageText?.trim() &&
    isWithinDateRange(announcement.startDate, announcement.endDate) &&
    !dismissed

  if (!visible) return null

  const styleClass = STYLE_CLASSES[announcement.backgroundStyle] || STYLE_CLASSES.blue
  const isExternal = announcement.buttonLink?.startsWith('http')

  function handleClose() {
    setDismissed(true)
    try {
      localStorage.setItem(storageKey, '1')
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={`relative z-[60] ${styleClass}`} role="region" aria-label="Announcement">
      <div className="home-container flex min-h-[40px] items-center justify-center gap-3 py-2 pr-10 text-center text-xs sm:min-h-[44px] sm:text-sm">
        <p className="font-medium leading-snug">{announcement.messageText}</p>
        {announcement.buttonText && announcement.buttonLink ? (
          isExternal ? (
            <a
              href={announcement.buttonLink}
              className="shrink-0 rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 sm:text-sm"
            >
              {announcement.buttonText}
            </a>
          ) : (
            <Link
              to={announcement.buttonLink}
              className="shrink-0 rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 sm:text-sm"
            >
              {announcement.buttonText}
            </Link>
          )
        ) : null}
        {announcement.showCloseButton !== false ? (
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg hover:bg-black/10"
            aria-label="Dismiss announcement"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  )
}
