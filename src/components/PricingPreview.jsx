import { useEffect, useMemo, useState } from 'react'
import { fetchPricingSettings } from '../lib/data/pricingSettingsRepository'
import { onPricingSettingsUpdated } from '../lib/pricingSettingsEvents'
import { formatServiceCardDisplayPrice } from '../lib/serviceCardDisplayPrice'
import OpenInstantQuoteButton from './OpenInstantQuoteButton'

const PRICING_TIERS = [
  { title: 'Man with Van', sub: 'Ideal for single items & small loads', serviceType: 'Man with Van' },
  { title: 'Small Move', sub: 'Studio / few rooms', serviceType: 'Furniture Delivery' },
  { title: 'House Removals', sub: 'Larger homes & full loads', serviceType: 'House Removals' },
]

export default function PricingPreview() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      try {
        const s = await fetchPricingSettings()
        if (!cancelled) setSettings(s)
      } catch {
        if (!cancelled) setSettings(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadSettings()
    const unsubscribe = onPricingSettingsUpdated(() => {
      setLoading(true)
      void loadSettings()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const tiers = useMemo(
    () =>
      PRICING_TIERS.map((tier) => ({
        ...tier,
        priceLabel: formatServiceCardDisplayPrice(settings, tier.serviceType) || '—',
      })),
    [settings],
  )

  return (
    <section id="pricing" className="scroll-mt-20 bg-white py-12 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">Simple starting prices</h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Honest ballpark figures — we&apos;ll confirm your exact quote once we know the details.
          </p>
        </div>
        <ul className="mt-8 grid grid-cols-2 gap-3 xxs:gap-4 xs:mt-10 sm:mt-12 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          {tiers.map(({ title, priceLabel, sub }) => (
            <li
              key={title}
              className="flex flex-col rounded-xl border border-slate-200 bg-gradient-to-b from-brand-50/80 to-white p-3 text-center shadow-card ring-1 ring-slate-100 xxs:p-3.5 xs:rounded-2xl sm:p-6"
            >
              <h3 className="text-sm font-semibold text-slate-900 xxs:text-base sm:text-lg">{title}</h3>
              <p className="mt-2 text-xl font-bold tracking-tight text-brand-700 xxs:mt-2.5 xxs:text-2xl sm:mt-3 sm:text-3xl">
                {loading ? (
                  <span className="inline-block h-9 w-24 animate-pulse rounded bg-slate-200" />
                ) : (
                  <>from {priceLabel}</>
                )}
              </p>
              <p className="mt-2 flex-1 text-sm text-slate-600">{sub}</p>
              <OpenInstantQuoteButton
                trackLabel="Pricing: get a quote"
                trackSection="pricing"
                className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                Get a quote
              </OpenInstantQuoteButton>
            </li>
          ))}
        </ul>
        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-slate-500">
          Final price depends on distance, items, access and date — use our instant quote page for a live estimate.
        </p>
      </div>
    </section>
  )
}
