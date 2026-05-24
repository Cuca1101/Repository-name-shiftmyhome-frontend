import { useEffect, useState } from 'react'
import {
  acceptAllCookies,
  acceptEssentialCookiesOnly,
  getCookieConsent,
  setCookieConsent,
} from '../lib/cookieConsent.js'
import {
  isGaConfigured,
  isMetaPixelConfigured,
  subscribeMarketingConsentChanges,
} from '../lib/marketingPixels.js'

export default function CookiePreferencesPage() {
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const sync = () => {
      const consent = getCookieConsent()
      setAnalytics(Boolean(consent?.analytics))
      setMarketing(Boolean(consent?.marketing))
    }
    sync()
    return subscribeMarketingConsentChanges(sync)
  }, [])

  const hasOptionalPixels = isGaConfigured() || isMetaPixelConfigured()

  function savePreferences() {
    setCookieConsent({ analytics, marketing })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="min-w-0 bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-900">Cookie preferences</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated {new Date().getFullYear()}</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
          <p>
            We use essential cookies so the site works — for example to remember your quote progress and keep you signed
            in on admin pages. These cannot be switched off.
          </p>

          {hasOptionalPixels ? (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
              <h2 className="text-base font-semibold text-slate-900">Optional cookies</h2>

              {isGaConfigured() ? (
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium text-slate-900">Analytics (Google Analytics)</span>
                    <span className="mt-1 block text-slate-600">
                      Helps us understand how visitors use the site — page views, quote interest, and conversions.
                    </span>
                  </span>
                </label>
              ) : null}

              {isMetaPixelConfigured() ? (
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium text-slate-900">Marketing (Meta Pixel)</span>
                    <span className="mt-1 block text-slate-600">
                      Used to measure ad performance on Facebook and Instagram when you interact with our quote tools.
                    </span>
                  </span>
                </label>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={savePreferences}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
                >
                  Save preferences
                </button>
                <button
                  type="button"
                  onClick={() => {
                    acceptAllCookies()
                    setAnalytics(true)
                    setMarketing(true)
                    setSaved(true)
                    window.setTimeout(() => setSaved(false), 2500)
                  }}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                >
                  Accept all
                </button>
                <button
                  type="button"
                  onClick={() => {
                    acceptEssentialCookiesOnly()
                    setAnalytics(false)
                    setMarketing(false)
                    setSaved(true)
                    window.setTimeout(() => setSaved(false), 2500)
                  }}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                >
                  Essential only
                </button>
              </div>

              {saved ? (
                <p className="text-sm font-medium text-emerald-700" role="status">
                  Preferences saved.
                </p>
              ) : null}
            </div>
          ) : (
            <p>
              We may add analytics or marketing tools in future. When we do, you will be able to manage your preferences
              here.
            </p>
          )}

          <p>
            You can also control cookies through your browser settings. Blocking some cookies may affect how parts of the
            site work.
          </p>
          <p>
            Questions?{' '}
            <a className="font-medium text-brand-700 hover:underline" href="mailto:admin@shiftmyhome.co.uk">
              admin@shiftmyhome.co.uk
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
