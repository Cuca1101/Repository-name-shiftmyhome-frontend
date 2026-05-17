import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SERVICE_PAGES } from '../constants/servicePages'
import { fetchPricingSettings } from '../lib/data/pricingSettingsRepository'
import { HouseIcon, iconBySlug } from './serviceIcons'

/** Display titles on homepage cards (serviceType / routes unchanged). */
const CARD_TITLES = {
  'office-moves': 'Office Move',
}

const CARD_DESCRIPTIONS = {
  'house-removals': 'Full or partial moves of any size.',
  'man-with-van': 'Van & crew for smaller loads and quick jobs.',
  'furniture-delivery': 'Bulky furniture moved safely with care.',
  'office-moves': 'Office relocations planned around your business.',
  'student-moves': 'Student & flat moves across Glasgow & beyond.',
  clearance: 'Clearances with upfront pricing & disposal.',
}

function cardTitle(service) {
  return CARD_TITLES[service.slug] ?? service.title
}

function cardDescription(service) {
  return CARD_DESCRIPTIONS[service.slug] ?? service.heroTeaser
}

export default function HeroServiceGrid() {
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await fetchPricingSettings()
        if (!cancelled) setSettings(s)
      } catch {
        if (!cancelled) setSettings(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const priceByService = useMemo(() => {
    const b = settings?.basePriceByService
    if (!b) return {}
    const out = {}
    for (const s of SERVICE_PAGES) {
      const v = b[s.serviceType]
      out[s.slug] = typeof v === 'number' && Number.isFinite(v) ? `£${Math.round(v)}` : null
    }
    return out
  }, [settings])

  return (
    <section id="services" className="scroll-mt-24 bg-white pb-12 pt-8 sm:pb-16 sm:pt-12">
      <div className="mx-auto min-w-0 max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Our removal services</h2>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Choose a service and get an instant quote — same trusted quote wizard on every page.
          </p>
        </div>

        <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-6">
          {SERVICE_PAGES.map((service) => {
            const Icon = iconBySlug[service.slug] ?? HouseIcon
            const price = priceByService[service.slug]
            return (
              <li key={service.path} className="min-w-0">
                <Link
                  to={service.path}
                  className="group flex h-full min-h-[280px] flex-col overflow-hidden rounded-2xl bg-white shadow-premium ring-1 ring-slate-200/80 transition hover:shadow-card-hover sm:min-h-[300px] sm:flex-row"
                >
                  <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-brand-200 bg-brand-50 text-brand-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-3 text-base font-bold leading-snug text-slate-900 sm:text-lg">
                      {cardTitle(service)}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600 sm:text-sm">
                      {cardDescription(service)}
                    </p>
                    {price ? (
                      <p className="mt-2 text-sm font-bold text-brand-600 sm:text-base">From {price}</p>
                    ) : (
                      <p className="mt-2 text-sm font-semibold text-slate-400">Get a quote</p>
                    )}
                    <span className="mt-auto inline-flex min-h-[40px] w-full items-center justify-center gap-1 rounded-full bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-2 text-xs font-bold text-white shadow-md transition group-hover:from-brand-700 sm:mt-4 sm:min-h-[44px] sm:text-sm">
                      Get a Quote
                      <span aria-hidden>→</span>
                    </span>
                  </div>
                  <div
                    className="relative h-28 shrink-0 bg-slate-100 sm:h-auto sm:w-[42%] sm:min-w-[140px]"
                    aria-hidden
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
                      style={{ backgroundImage: `url(${service.heroImage})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-white via-white/70 to-transparent sm:from-white sm:via-white/50" />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
