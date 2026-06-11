import { Link, useLocation } from 'react-router-dom'
import NotFoundPage from './NotFoundPage'
import SeoHead from '../components/seo/SeoHead'
import SeoFaqAccordion from '../components/seo/SeoFaqAccordion'
import SeoInternalLinks from '../components/seo/SeoInternalLinks'
import SeoExpandableLinkGrid from '../components/seo/SeoExpandableLinkGrid'
import SeoCityContentSections from '../components/seo/SeoCityContentSections'
import SeoQuickBookSteps from '../components/seo/SeoQuickBookSteps'
import SeoCityMap from '../components/seo/SeoCityMap'
import SupportCTASection from '../components/SupportCTASection'
import RecentMovesGallerySection from '../components/RecentMovesGallerySection'
import { SeoQuoteModalProvider, useSeoQuoteModal } from '../context/SeoQuoteModalContext'
import { serviceTypeToSlug, useServiceCardImageBySlug } from '../hooks/useServiceGridCards'
import { getSeoPageByPath } from '../data/seoPages'
import { getServicePageByPath } from '../constants/servicePages'
import { normalizePublicPath } from '../lib/normalizePublicPath'
import { useSeoSettings } from '../context/SeoSettingsContext'
import { mergeSeoLandingPageConfig } from '../lib/seoSettingsMerge'
import { normalizeSeoFaqs } from '../lib/seoStructuredData'
import { CONTACT, WHATSAPP_URL } from '../config'

const TRUST_ITEMS = [
  {
    title: 'Fully insured',
    text: 'Goods-in-transit cover on booked moves — share fragile or high-value items when you quote.',
    icon: 'shield',
  },
  {
    title: 'Scotland-wide coverage',
    text: 'Local crews across Scottish cities with UK-wide routes when you need to go further.',
    icon: 'map',
  },
  {
    title: 'Experienced movers',
    text: 'Professional drivers and handlers who communicate clearly before and on move day.',
    icon: 'crew',
  },
  {
    title: 'Same-day when available',
    text: 'Short-notice slots depend on crew schedules — quote with your date for an honest answer.',
    icon: 'clock',
  },
]

const HERO_TRUST = [
  { label: 'Fully insured moves', icon: 'shield' },
  { label: 'Scotland-wide coverage', icon: 'map' },
  { label: 'Experienced local crews', icon: 'crew' },
]

function TrustIcon({ name, className = 'h-3 w-3' }) {
  if (name === 'shield') {
    return (
      <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.351-.166-2A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z"
          clipRule="evenodd"
        />
      </svg>
    )
  }
  if (name === 'map') {
    return (
      <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
          clipRule="evenodd"
        />
      </svg>
    )
  }
  if (name === 'clock') {
    return (
      <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
          clipRule="evenodd"
        />
      </svg>
    )
  }
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
  )
}

function SeoLandingPageContent({ page, routePath, heroImage, faqs, areasWeCover, nearby }) {
  const { openQuote } = useSeoQuoteModal()

  return (
    <article className="seo-landing">
      <header className="seo-hero-split" aria-label="Page introduction">
        <div className="seo-hero-split-grid mx-auto grid min-w-0 max-w-6xl gap-0 lg:grid-cols-2 lg:items-stretch">
          <div className="seo-hero-split-panel order-2 flex min-w-0 flex-col justify-center px-4 py-8 sm:px-6 sm:py-10 lg:order-1 lg:py-12 lg:pl-8 lg:pr-6 xl:pl-10">
            <nav className="text-xs font-medium text-slate-500 sm:text-sm" aria-label="Breadcrumb">
              <Link to="/" className="transition hover:text-brand-700">
                Home
              </Link>
              <span className="mx-2 text-slate-300">/</span>
              <span className="text-slate-700">{page.h1}</span>
            </nav>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-brand-600 sm:text-sm">
              {page.regionLabel}
            </p>
            <h1 className="seo-hero-split-title">{page.h1}</h1>
            <p className="seo-hero-split-teaser">{page.heroTeaser}</p>
            <ul className="mt-5 flex flex-wrap gap-2 sm:mt-6" aria-label="Key benefits">
              {HERO_TRUST.map(({ label, icon }) => (
                <li key={label}>
                  <span className="seo-hero-split-badge">
                    <span className="seo-hero-split-badge-icon" aria-hidden>
                      <TrustIcon name={icon} className="h-3.5 w-3.5 text-brand-600" />
                    </span>
                    {label}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={openQuote}
                className="btn-premium-primary min-h-[48px] w-full px-6 py-3 text-sm sm:w-auto sm:min-w-[200px] sm:text-[15px]"
              >
                Start your quote
                <span aria-hidden className="text-white/90">
                  →
                </span>
              </button>
              <a
                href={`tel:${CONTACT.phoneTel}`}
                className="btn-premium-secondary min-h-[48px] w-full px-5 py-3 text-sm sm:w-auto sm:text-[15px]"
              >
                Call {CONTACT.phoneDisplay}
              </a>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-600 sm:text-sm">
              Online quote wizard — add addresses and items, then book when you&apos;re ready.
            </p>
          </div>

          <div className="seo-hero-split-media order-1 flex min-w-0 justify-center px-4 pt-6 sm:px-6 sm:pt-8 lg:order-2 lg:justify-stretch lg:px-8 lg:py-10 lg:pl-4 xl:pr-10">
            <div className="seo-hero-split-frame relative mx-auto w-full max-w-[min(96vw,28rem)] overflow-hidden rounded-2xl shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/10 sm:max-w-[min(96vw,32rem)] lg:mx-0 lg:max-w-none">
              <img
                src={heroImage}
                alt=""
                width={960}
                height={640}
                fetchPriority="high"
                decoding="async"
                className="h-[280px] w-full object-cover object-center sm:h-[320px] lg:h-auto lg:min-h-[360px]"
              />
            </div>
          </div>
        </div>
      </header>

      <SeoQuickBookSteps cityName={page.cityName} />

      <SeoCityMap cityName={page.cityName} />

      <SeoCityContentSections page={page} heroImage={heroImage} pagePath={routePath} />

      {areasWeCover.length > 0 || nearby.length > 0 ? (
        <section className="seo-section seo-section--tint" aria-labelledby="seo-areas-heading">
          <div className="seo-section-inner">
            <h2 id="seo-areas-heading" className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
              {areasWeCover.length > 0 ? 'Areas we cover' : 'Nearby locations'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              We provide removals and man with van services across {page.cityName} and surrounding areas — select a
              town for local pricing.
            </p>
            {areasWeCover.length > 0 ? (
              <SeoExpandableLinkGrid
                links={areasWeCover.map(({ href, name }) => ({ href, label: `${name} removals` }))}
                initialVisible={6}
                expandLabel={`Show all ${areasWeCover.length} areas`}
                collapseLabel="Show fewer areas"
              />
            ) : null}
            {nearby.length > 0 ? (
              <div className={areasWeCover.length > 0 ? 'mt-6' : ''}>
                {areasWeCover.length > 0 ? (
                  <h3 className="text-base font-semibold text-slate-800">Nearby locations</h3>
                ) : null}
                <SeoExpandableLinkGrid
                  links={nearby}
                  initialVisible={6}
                  expandLabel={`Show all ${nearby.length} nearby areas`}
                  collapseLabel="Show fewer locations"
                  className={areasWeCover.length > 0 ? 'mt-3' : ''}
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <RecentMovesGallerySection />

      <section className="seo-section seo-section--muted" aria-labelledby="seo-trust-heading">
        <div className="seo-section-inner">
          <h2 id="seo-trust-heading" className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Why book ShiftMyHome{page.cityName !== 'Scotland' ? ` in ${page.cityName}` : ''}
          </h2>
          <ul className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4">
            {TRUST_ITEMS.map(({ title, text, icon }) => (
              <li key={title} className="seo-trust-card">
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-emerald-500 text-white shadow-md"
                    aria-hidden
                  >
                    <TrustIcon name={icon} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="seo-section seo-section--white" aria-labelledby="seo-faq-heading">
        <div className="seo-section-inner max-w-3xl lg:max-w-6xl">
          <h2 id="seo-faq-heading" className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Frequently asked questions
            {page.cityName !== 'Scotland' ? ` — ${page.cityName}` : ''}
          </h2>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Tap a question to expand — all answers stay on this page for easy reference.
          </p>
          <SeoFaqAccordion faqs={faqs} />
        </div>
      </section>

      <SupportCTASection />

      <section className="seo-cta-band" aria-labelledby="seo-cta-heading">
        <div className="seo-cta-inner">
          <h2 id="seo-cta-heading" className="text-xl font-bold sm:text-2xl lg:text-3xl">
            {page.cityName === 'Scotland' ? 'Ready to book your move?' : `Ready for your ${page.cityName} move?`}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100/95 sm:text-base">
            Get a clear price in minutes. Call, WhatsApp, or start the quote wizard.
          </p>
          <div className="seo-cta-actions mt-7 flex flex-col items-stretch justify-center gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center">
            <button type="button" onClick={openQuote} className="seo-cta-btn-primary">
              Start your quote
            </button>
            <a href={`tel:${CONTACT.phoneTel}`} className="seo-cta-btn-secondary">
              {CONTACT.phoneDisplay}
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="seo-cta-btn-secondary"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </section>

      <SeoInternalLinks currentPath={routePath} cityName={page.cityName} regionKey={page.regionKey} />
    </article>
  )
}

export default function SeoLandingPage() {
  const { pathname } = useLocation()
  const routePath = normalizePublicPath(pathname)
  const { getForPath } = useSeoSettings()
  const getImageForSlug = useServiceCardImageBySlug()
  const basePage = getSeoPageByPath(routePath)
  const page = mergeSeoLandingPageConfig(basePage, getForPath(routePath))

  if (!page) {
    return <NotFoundPage />
  }

  const areasWeCover = page.areasWeCover ?? []
  const nearby = page.nearbyLocations ?? []
  const slug = serviceTypeToSlug(page.serviceType)
  const heroImage =
    getServicePageByPath(`/${slug}`)?.heroImage ??
    getImageForSlug(slug)
  const faqs = normalizeSeoFaqs(page.faqs)

  return (
    <SeoQuoteModalProvider defaultServiceType={page.serviceType}>
      <SeoHead
        title={page.title}
        description={page.metaDescription}
        path={routePath}
        includeSocial
        ogTitle={page.ogTitle ?? page.title}
        ogDescription={page.ogDescription ?? page.metaDescription}
        faqs={faqs}
        breadcrumbItems={[
          { name: 'Home', path: '/' },
          { name: page.h1, path: page.path },
        ]}
        localBusiness={{
          path: routePath,
          pageTitle: page.h1,
          description: page.metaDescription,
        }}
      />
      <SeoLandingPageContent
        page={page}
        routePath={routePath}
        heroImage={heroImage}
        faqs={faqs}
        areasWeCover={areasWeCover}
        nearby={nearby}
      />
    </SeoQuoteModalProvider>
  )
}
