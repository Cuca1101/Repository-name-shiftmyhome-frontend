import { Link } from 'react-router-dom'
import SeoFaqAccordion from './SeoFaqAccordion'
import SeoInfoBodyCard from './SeoInfoBodyCard'
import SeoLinkCardGrid from './SeoLinkCardGrid'
import SeoLandingServiceGrid from './SeoLandingServiceGrid'
import { normalizeSeoFaqs } from '../../lib/seoStructuredData'
import { groupServicePageCityLinks } from '../../lib/seo/cityAreasWeCover'

/**
 * SEO content sections for service quote pages (below the quote wizard).
 * Matches city SEO landing layout — intro card, info cards, location links.
 *
 * @param {{
 *   content: import('../../lib/seo/servicePageContent').ServicePageSeoContent,
 *   quoteAnchor?: string,
 *   heroImage?: string,
 *   pagePath: string,
 * }} props
 */
export default function ServicePageSeoSections({
  content,
  quoteAnchor = '#service-quote',
  heroImage = '/assets/services/house-removals.jpg',
  pagePath,
}) {
  if (!content) return null

  const faqs = normalizeSeoFaqs(content.faqs)
  const { mainCities, moreAreas, localServices } = groupServicePageCityLinks(content.cityLinks)
  const hasLocationLinks = mainCities.length + moreAreas.length + localServices.length > 0

  return (
    <div className="seo-landing min-w-0">
      <section className="seo-section seo-section--white" aria-labelledby="service-seo-intro-heading">
        <div className="seo-section-inner">
          <div className="grid gap-5 lg:grid-cols-3 lg:gap-6 lg:items-stretch">
            <div className="lg:col-span-2">
              <article className="service-card-shell h-full min-h-[280px] overflow-hidden sm:min-h-[320px]">
                <div className="relative flex min-h-[280px] flex-1 flex-col sm:min-h-[320px]">
                  <img
                    src={heroImage}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover object-center"
                  />
                  <div
                    className="service-card-media-overlay service-card-media-overlay--mobile service-card-media-overlay--desktop pointer-events-none absolute inset-0"
                    aria-hidden
                  />
                  <div className="relative z-10 flex flex-1 flex-col justify-end p-5 sm:p-6">
                    <h2
                      id="service-seo-intro-heading"
                      className="text-xl font-bold leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] sm:text-2xl"
                    >
                      {content.introHeading}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] sm:text-base">
                      {content.intro}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-white/85 drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]">
                      {content.introSecondary}
                    </p>
                  </div>
                </div>
              </article>
            </div>

            <aside className="flex flex-col rounded-2xl border border-slate-200/90 bg-gradient-to-br from-brand-50 via-white to-slate-50 p-5 shadow-md ring-1 ring-slate-900/5 sm:p-6 lg:sticky lg:top-20 lg:self-start">
              <h3 className="text-lg font-bold tracking-tight text-slate-900">Get your instant quote</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Enter addresses and inventory above for a live price — book online in minutes.
              </p>
              <a href={quoteAnchor} className="service-card-cta mt-6 min-h-[48px] text-sm">
                Get a Quote
                <span className="opacity-90" aria-hidden>
                  →
                </span>
              </a>
            </aside>
          </div>
        </div>
      </section>

      {content.bodySections.length > 0 ? (
        <section className="seo-section seo-section--tint" aria-labelledby="service-seo-details-heading">
          <div className="seo-section-inner">
            <h2
              id="service-seo-details-heading"
              className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
            >
              What&apos;s included
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Tap a card to jump back to the quote wizard and price your job.
            </p>
            <ul className="mt-5 grid grid-cols-1 items-stretch gap-4 sm:mt-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {content.bodySections.map((section) => (
                <SeoInfoBodyCard key={section.heading} section={section} quoteAnchor={quoteAnchor} />
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {hasLocationLinks ? (
        <section className="seo-section seo-section--tint" aria-labelledby="service-seo-cities-heading">
          <div className="seo-section-inner">
            <h2 id="service-seo-cities-heading" className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
              Popular locations
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Explore local pricing and service pages for cities and towns across Scotland.
            </p>

            {mainCities.length > 0 ? (
              <div className="mt-6">
                <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Main cities</h3>
                <SeoLinkCardGrid links={mainCities} />
              </div>
            ) : null}

            {moreAreas.length > 0 ? (
              <div className="mt-8">
                <h3 className="text-base font-semibold text-slate-900 sm:text-lg">More areas across Scotland</h3>
                <SeoLinkCardGrid links={moreAreas} />
              </div>
            ) : null}

            {localServices.length > 0 ? (
              <div className="mt-8">
                <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Local service pages</h3>
                <SeoLinkCardGrid links={localServices} />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="seo-section seo-section--white" aria-labelledby="service-seo-all-services-heading">
        <div className="seo-section-inner">
          <h2
            id="service-seo-all-services-heading"
            className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
          >
            All ShiftMyHome services
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Need a different service? Tap a card to open the quote wizard with the right defaults.
          </p>
          <SeoLandingServiceGrid quoteAnchor={quoteAnchor} pagePath={pagePath} />
        </div>
      </section>

      {faqs.length > 0 ? (
        <section className="seo-section seo-section--white" aria-labelledby="service-seo-faq-heading">
          <div className="seo-section-inner max-w-3xl lg:max-w-6xl">
            <h2 id="service-seo-faq-heading" className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Frequently asked questions
            </h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Tap a question to expand — all answers stay on this page for easy reference.
            </p>
            <SeoFaqAccordion faqs={faqs} />
          </div>
        </section>
      ) : null}

      <section className="seo-cta-band" aria-labelledby="service-seo-cta-heading">
        <div className="seo-cta-inner">
          <h2 id="service-seo-cta-heading" className="text-xl font-bold sm:text-2xl lg:text-3xl">
            {content.ctaHeading}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100/95 sm:text-base">
            {content.ctaText}
          </p>
          <div className="seo-cta-actions mt-7 flex flex-col items-stretch justify-center gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center">
            <a href={quoteAnchor} className="seo-cta-btn-primary">
              Get instant quote
            </a>
            <Link to="/coverage" className="seo-cta-btn-secondary">
              View coverage
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
