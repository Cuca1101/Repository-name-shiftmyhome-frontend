import { useEffect, useMemo, useState } from 'react'
import { fetchPricingSettings } from '../lib/data/pricingSettingsRepository'
import HomeSectionLink from './HomeSectionLink'

export default function PricingPreview() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await fetchPricingSettings()
        if (!cancelled) setSettings(s)
      } catch {
        if (!cancelled) setSettings(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const tiers = useMemo(() => {
    const b = settings?.basePriceByService
    if (!b) {
      return [
        { title: 'Man with Van', priceLabel: '—', sub: 'Ideal for single items & small loads', key: 'Man with Van' },
        { title: 'Small Move', priceLabel: '—', sub: 'Studio / few rooms', key: 'Furniture Delivery' },
        { title: 'House Removals', priceLabel: '—', sub: 'Larger homes & full loads', key: 'House Removals' },
      ]
    }
    const fmt = (k) => {
      const v = b[k]
      return typeof v === 'number' && Number.isFinite(v) ? `£${Math.round(v)}` : '—'
    }
    return [
      { title: 'Man with Van', priceLabel: fmt('Man with Van'), sub: 'Ideal for single items & small loads', key: 'Man with Van' },
      { title: 'Small Move', priceLabel: fmt('Furniture Delivery'), sub: 'Studio / few rooms', key: 'Furniture Delivery' },
      { title: 'House Removals', priceLabel: fmt('House Removals'), sub: 'Larger homes & full loads', key: 'House Removals' },
    ]
  }, [settings])

  return (
    <section id="pricing" className="scroll-mt-20 bg-white py-12 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">Simple starting prices</h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Honest ballpark figures — we&apos;ll confirm your exact quote once we know the details.
          </p>
        </div>
        <ul className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tiers.map(({ title, priceLabel, sub }) => (
            <li
              key={title}
              className="flex flex-col rounded-2xl border border-slate-200 bg-gradient-to-b from-brand-50/80 to-white p-6 text-center shadow-card ring-1 ring-slate-100"
            >
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              <p className="mt-3 text-3xl font-bold tracking-tight text-brand-700">
                {loading ? (
                  <span className="inline-block h-9 w-24 animate-pulse rounded bg-slate-200" />
                ) : (
                  <>from {priceLabel}</>
                )}
              </p>
              <p className="mt-2 flex-1 text-sm text-slate-600">{sub}</p>
              <HomeSectionLink
                sectionId="quote"
                className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                Get a quote
              </HomeSectionLink>
            </li>
          ))}
        </ul>
        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-slate-500">
          Final price depends on distance, items, access and date — use the calculator below for a live estimate.
        </p>
      </div>
    </section>
  )
}
