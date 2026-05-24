import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  acceptAllCookies,
  acceptEssentialCookiesOnly,
  needsCookieConsentChoice,
} from '../lib/cookieConsent.js'
import { isGaConfigured, isMetaPixelConfigured } from '../lib/marketingPixels.js'

export default function CookieConsentBanner() {
  const { pathname } = useLocation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (pathname.startsWith('/admin')) {
      setVisible(false)
      return
    }
    const hasOptionalPixels = isGaConfigured() || isMetaPixelConfigured()
    setVisible(needsCookieConsentChoice() && hasOptionalPixels)
  }, [pathname])

  if (!visible) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[120] px-4 pb-4 sm:px-6 sm:pb-6"
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-live="polite"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-5">
        <h2 id="cookie-consent-title" className="text-sm font-bold text-slate-900 sm:text-base">
          Cookie preferences
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-600 sm:text-sm">
          We use essential cookies to run the site. With your permission, we also use analytics and marketing cookies
          (Google Analytics and Meta Pixel) to measure visits, quote interest, and ad performance. You can change your
          choice anytime in{' '}
          <Link to="/cookies" className="font-semibold text-brand-700 hover:text-brand-800">
            cookie preferences
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => {
              acceptAllCookies()
              setVisible(false)
            }}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Accept all
          </button>
          <button
            type="button"
            onClick={() => {
              acceptEssentialCookiesOnly()
              setVisible(false)
            }}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            Essential only
          </button>
          <Link
            to="/cookies"
            className="inline-flex min-h-[44px] items-center justify-center px-2 text-sm font-semibold text-slate-600 transition hover:text-brand-700"
          >
            Learn more
          </Link>
        </div>
      </div>
    </div>
  )
}
