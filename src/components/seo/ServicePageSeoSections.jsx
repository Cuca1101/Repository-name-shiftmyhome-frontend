import { Link } from 'react-router-dom'
import SeoFaqAccordion from './SeoFaqAccordion'
import { normalizeSeoFaqs } from '../../lib/seoStructuredData'

/**
 * SEO content sections for service quote pages (below the quote wizard).
 * Reuses existing seo-section / seo-prose styles from SeoLandingPage.
 *
 * @param {{
 *   content: import('../../lib/seo/servicePageContent').ServicePageSeoContent,
 *   quoteAnchor?: string,
 * }} props
 */
export default function ServicePageSeoSections({ content, quoteAnchor = '#service-quote' }) {
  if (!content) return null

  const faqs = normalizeSeoFaqs(content.faqs)

  return (
    <div className="seo-landing min-w-0">
      <section className="seo-section seo-section--white" aria-labelledby="service-seo-intro-heading">
        <div className="seo-section-inner">
          <div className="seo-prose">
            <h2 id="service-seo-intro-heading">{content.introHeading}</h2>
            <p>{content.intro}</p>
            <p className="text-muted">{content.introSecondary}</p>
            {content.bodySections.map((section) => (
              <div key={section.heading} className="mt-6">
                <h3 className="text-base font-semibold text-slate-900 sm:text-lg">{section.heading}</h3>
                {section.paragraphs.map((para) => (
                  <p key={para.slice(0, 48)} className="mt-2 text-slate-700">
                    {para}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {content.cityLinks.length > 0 ? (
        <section className="seo-section seo-section--tint" aria-labelledby="service-seo-cities-heading">
          <div className="seo-section-inner">
            <h2 id="service-seo-cities-heading" className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
              Popular locations
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Explore local pricing and service pages for major Scottish cities.
            </p>
            <ul className="seo-chip-list mt-4 flex flex-wrap gap-2 sm:mt-5">
              {content.cityLinks.map(({ href, label }) => (
                <li key={href} className="min-w-0 max-w-full">
                  <Link to={href} className="seo-chip">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

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
