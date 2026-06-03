import { Link, Navigate, useLocation } from 'react-router-dom'
import { getServicePageByPath } from '../constants/servicePages'
import { useSeoSettings } from '../context/SeoSettingsContext'
import { mergeServicePageConfig } from '../lib/seoSettingsMerge'
import SeoHead from '../components/seo/SeoHead'
import SeoServiceJsonLd from '../components/seo/SeoServiceJsonLd'
import ServicePageSeoSections from '../components/seo/ServicePageSeoSections'
import SeoQuickBookSteps from '../components/seo/SeoQuickBookSteps'
import SeoQuoteSectionHeader from '../components/seo/SeoQuoteSectionHeader'
import QuoteWizard from '../components/quote-wizard/QuoteWizard'
import { normalizePublicPath } from '../lib/normalizePublicPath'
import { normalizeSeoFaqs } from '../lib/seoStructuredData'
import { useServiceCardImageBySlug } from '../hooks/useServiceGridCards'

export default function ServiceQuotePage() {
  const { pathname } = useLocation()
  const routePath = normalizePublicPath(pathname)
  const getImageForSlug = useServiceCardImageBySlug()
  const { getForPath } = useSeoSettings()
  const basePage = getServicePageByPath(pathname)
  const page = mergeServicePageConfig(basePage, getForPath(pathname))
  if (!page) {
    return <Navigate to="/" replace />
  }

  const seoContent = page.seoContent ?? null
  const cardHeroImage = getImageForSlug(page.slug)
  const faqs =
    Array.isArray(page.faqs) && page.faqs.length
      ? normalizeSeoFaqs(page.faqs)
      : normalizeSeoFaqs(seoContent?.faqs)

  return (
    <div className="min-w-0">
      <SeoHead
        title={page.seoTitle || page.title}
        description={page.metaDescription || page.shortDescription}
        path={routePath}
        ogTitle={page.ogTitle || page.seoTitle || page.title}
        ogDescription={page.ogDescription || page.metaDescription || page.shortDescription}
        ogImage={cardHeroImage}
        ogType="website"
        includeSocial
        faqs={faqs.length ? faqs : undefined}
        breadcrumbItems={[
          { name: 'Home', path: '/' },
          { name: page.title, path: routePath },
        ]}
      />
      <SeoServiceJsonLd
        name={page.title}
        description={page.shortDescription}
        path={routePath}
        serviceType={page.serviceType}
      />
      <section
        className="relative isolate max-md:max-h-[6.5rem] overflow-hidden border-b border-slate-200/80 bg-brand-950 md:max-h-none"
        aria-label="Service hero"
      >
        <div
          className="absolute inset-0 bg-cover bg-center opacity-90"
          style={{ backgroundImage: `url(${cardHeroImage})` }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-950/95 via-brand-900/88 to-brand-800/80" aria-hidden />
        <div className="relative mx-auto box-border min-w-0 max-w-6xl px-2.5 py-2 sm:px-6 sm:py-5 lg:px-8">
          <Link
            to="/#services"
            className="inline-flex min-h-[32px] items-center gap-1 text-[10px] font-semibold text-white/90 transition hover:text-white sm:min-h-[40px] sm:text-sm"
          >
            <span aria-hidden>←</span> Back to services
          </Link>
          <h1 className="mt-1 text-balance text-base font-bold leading-tight tracking-tight text-white sm:mt-3 sm:text-2xl lg:text-[1.75rem]">
            {page.title}
          </h1>
          <p className="quote-hero-desc-mobile mt-0.5 max-w-2xl text-[11px] leading-snug text-brand-100 sm:mt-2 sm:text-sm sm:leading-relaxed md:text-[15px]">
            {page.shortDescription}
          </p>
        </div>
      </section>

      <SeoQuickBookSteps cityName="Scotland" />

      <section id="service-quote" className="seo-quote-wrap scroll-mt-[76px]" aria-label="Instant quote">
        <SeoQuoteSectionHeader
          title={`Get your instant ${page.title.toLowerCase()} quote`}
          subtitle="Enter pickup and delivery addresses, add your items, and see a live price — no phone call needed."
        />
        <QuoteWizard serviceType={page.serviceType} compact />
      </section>

      {seoContent ? (
        <ServicePageSeoSections
          content={seoContent}
          quoteAnchor="#service-quote"
          heroImage={cardHeroImage}
          pagePath={routePath}
        />
      ) : null}
    </div>
  )
}
