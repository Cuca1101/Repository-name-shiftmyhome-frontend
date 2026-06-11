import SeoCityBodyServiceCard from './SeoCityBodyServiceCard'
import SeoInfoBodyCard from './SeoInfoBodyCard'
import { useSeoQuoteModal } from '../../context/SeoQuoteModalContext'
import {
  getCityServicesHeading,
  getCityServicesIntro,
  getIntroHeading,
  getQuoteSidebarTitle,
  usesServiceStyleBodyCards,
} from '../../lib/seo/seoLandingCopy'

/**
 * City SEO intro card + quote sidebar + body sections as scannable cards.
 *
 * @param {{
 *   page: import('../../data/seoPages').SeoPageConfig,
 *   heroImage: string,
 *   pagePath: string,
 * }} props
 */
export default function SeoCityContentSections({ page, heroImage, pagePath }) {
  const { openQuote } = useSeoQuoteModal()
  const bodySections = page.bodySections ?? []
  const introHeading = getIntroHeading(page)
  const quoteSidebarTitle = getQuoteSidebarTitle(page)
  const servicesHeading = getCityServicesHeading(page)
  const servicesIntro = getCityServicesIntro(page)
  const serviceStyleCards = usesServiceStyleBodyCards(page)

  return (
    <>
      <section className="seo-section seo-section--white" aria-labelledby="seo-intro-heading">
        <div className="seo-section-inner">
          <div className="grid gap-5 lg:grid-cols-3 lg:gap-6 lg:items-stretch">
            <div className="lg:col-span-2">
              <article className="service-card-shell mx-auto h-[280px] w-full max-w-[min(96vw,28rem)] overflow-hidden sm:h-[320px] sm:max-w-[min(96vw,32rem)] lg:mx-0 lg:h-full lg:min-h-[320px] lg:max-w-none">
                <div className="relative flex h-full min-h-0 flex-1 flex-col">
                  <img
                    src={heroImage}
                    alt={`${introHeading} — ShiftMyHome ${page.cityName} removals`}
                    title={`${page.cityName} removals | ShiftMyHome`}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full min-h-[280px] object-cover object-center"
                  />
                  <div
                    className="service-card-media-overlay service-card-media-overlay--mobile service-card-media-overlay--desktop pointer-events-none absolute inset-0"
                    aria-hidden
                  />
                  <div className="relative z-10 flex flex-1 flex-col justify-end p-5 sm:p-6">
                    <h2
                      id="seo-intro-heading"
                      className="text-xl font-bold leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] sm:text-2xl"
                    >
                      {introHeading}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] sm:text-base">
                      {page.intro}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-white/85 drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]">
                      {page.introSecondary}
                    </p>
                  </div>
                </div>
              </article>
            </div>

            <aside className="flex flex-col rounded-2xl border border-slate-200/90 bg-gradient-to-br from-brand-50 via-white to-slate-50 p-5 shadow-md ring-1 ring-slate-900/5 sm:p-6 lg:sticky lg:top-20 lg:self-start">
              <h3 className="text-lg font-bold tracking-tight text-slate-900">{quoteSidebarTitle}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Instant online pricing — enter your addresses and inventory for a live estimate.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {page.serviceBullets.slice(0, 3).map((item) => (
                  <li key={item} className="flex gap-2 leading-snug">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-brand-500 to-emerald-500"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={openQuote} className="service-card-cta mt-6 min-h-[48px] text-sm">
                Start your quote
                <span className="opacity-90" aria-hidden>
                  →
                </span>
              </button>
            </aside>
          </div>
        </div>
      </section>

      {bodySections.length > 0 ? (
        <section className="seo-section seo-section--tint" aria-labelledby="seo-city-services-heading">
          <div className="seo-section-inner">
            <h2
              id="seo-city-services-heading"
              className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
            >
              {servicesHeading}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">{servicesIntro}</p>
            <ul className="mt-5 grid grid-cols-1 items-stretch gap-4 sm:mt-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {bodySections.map((section) =>
                serviceStyleCards ? (
                  <SeoCityBodyServiceCard
                    key={section.heading}
                    section={section}
                    pagePath={pagePath}
                  />
                ) : (
                  <SeoInfoBodyCard key={section.heading} section={section} />
                ),
              )}
            </ul>
            {page.keywordSentence ? (
              <p className="mt-6 max-w-3xl text-sm leading-relaxed text-slate-600">{page.keywordSentence}</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  )
}
