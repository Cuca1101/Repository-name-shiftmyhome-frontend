import { Link, Navigate, useLocation } from 'react-router-dom'
import QuoteWizard from '../components/quote-wizard/QuoteWizard'
import SeoHead from '../components/seo/SeoHead'
import SeoFaqJsonLd from '../components/seo/SeoFaqJsonLd'
import SeoBusinessJsonLd from '../components/seo/SeoBusinessJsonLd'
import SeoBreadcrumbJsonLd from '../components/seo/SeoBreadcrumbJsonLd'
import SeoFaqAccordion from '../components/seo/SeoFaqAccordion'
import { getSeoPageByPath } from '../data/seoPages'
import { useSeoSettings } from '../context/SeoSettingsContext'
import { mergeSeoLandingPageConfig } from '../lib/seoSettingsMerge'
import { CONTACT, WHATSAPP_URL } from '../config'

const SERVICE_HERO_IMAGE = {
  'House Removals': '/assets/services/house-removals.jpg',
  'Man with Van': '/assets/services/man-with-van.jpg',
  'Furniture Delivery': '/assets/services/furniture-delivery.jpg',
  'Office Moves': '/assets/services/office-moves.jpg',
  'Student Moves': '/assets/services/student-moves.jpg',
  Clearance: '/assets/services/clearance.jpg',
}

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

const SERVICE_LINKS = [
  { to: '/house-removals', label: 'House removals' },
  { to: '/man-with-van', label: 'Man with van' },
  { to: '/furniture-delivery', label: 'Furniture delivery' },
  { to: '/office-moves', label: 'Office moves' },
  { to: '/student-moves', label: 'Student moves' },
  { to: '/clearance', label: 'Clearance' },
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

export default function SeoLandingPage() {
  const { pathname } = useLocation()
  const { getForPath } = useSeoSettings()
  const basePage = getSeoPageByPath(pathname)
  const page = mergeSeoLandingPageConfig(basePage, getForPath(pathname))

  if (!page) {
    return <Navigate to="/" replace />
  }

  const servicesHeading =
    page.cityName === 'Scotland' ? 'Moving services across Scotland' : `Services in ${page.cityName}`
  const nearby = page.nearbyLocations ?? []
  const heroImage = SERVICE_HERO_IMAGE[page.serviceType] || SERVICE_HERO_IMAGE['House Removals']

  return (
    <article className="seo-landing">
      <SeoHead
        title={page.title}
        description={page.metaDescription}
        path={page.path}
        includeSocial
        ogTitle={page.ogTitle ?? page.title}
        ogDescription={page.ogDescription ?? page.metaDescription}
      />
      <SeoBreadcrumbJsonLd
        items={[
          { name: 'Home', path: '/' },
          { name: page.cityName, path: page.path },
        ]}
      />
      <SeoBusinessJsonLd
        path={page.path}
        pageTitle={page.h1}
        description={page.metaDescription}
      />
      <SeoFaqJsonLd faqs={page.faqs} path={page.path} />

      <header className="seo-hero" aria-label="Page introduction">
        <img
          src={heroImage}
          alt=""
          width={1600}
          height={900}
          loading="lazy"
          decoding="async"
          className="seo-hero-bg hidden sm:block"
        />
        <div className="seo-hero-overlay absolute inset-0" aria-hidden />
        <div className="seo-hero-glow absolute inset-0" aria-hidden />
        <div className="seo-hero-content relative mx-auto box-border min-w-0 max-w-6xl px-2.5 py-3 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
          <nav className="text-xs font-medium text-brand-200/90 sm:text-sm" aria-label="Breadcrumb">
            <Link to="/" className="transition hover:text-white">
              Home
            </Link>
            <span className="mx-2 text-brand-400/60">/</span>
            <span className="text-white/90">{page.cityName}</span>
          </nav>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-brand-300 sm:mt-4 sm:text-sm">
            {page.regionLabel}
          </p>
          <h1>{page.h1}</h1>
          <p className="seo-hero-teaser">{page.heroTeaser}</p>
          <ul
            className="mt-4 flex flex-wrap gap-2 sm:mt-5"
            aria-label="Key benefits"
          >
            {HERO_TRUST.map(({ label, icon }) => (
              <li key={label}>
                <span className="seo-trust-pill">
                  <span className="seo-trust-pill-icon" aria-hidden>
                    <TrustIcon name={icon} />
                  </span>
                  {label}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col gap-2.5 xs:flex-row xs:flex-wrap xs:gap-3 sm:mt-7">
            <a href="#seo-quote" className="seo-cta-btn-primary max-w-md xs:max-w-none">
              Get instant quote
            </a>
            <Link
              to="/coverage"
              className="seo-cta-btn-secondary max-w-md xs:max-w-none"
            >
              View coverage
            </Link>
          </div>
        </div>
      </header>

      <section
        className="seo-section seo-section--white"
        aria-labelledby="seo-intro-heading"
      >
        <div className="seo-section-inner">
          <div className="seo-prose">
            <h2 id="seo-intro-heading">
              {page.cityName === 'Scotland'
                ? 'Professional moves across Scotland'
                : `Local movers in ${page.cityName}`}
            </h2>
            <p>{page.intro}</p>
            <p className="text-muted">{page.introSecondary}</p>
            {(page.bodySections ?? []).map((section) => (
              <div key={section.heading} className="mt-6">
                <h3 className="text-base font-semibold text-slate-900 sm:text-lg">{section.heading}</h3>
                {section.paragraphs.map((para) => (
                  <p key={para.slice(0, 48)} className="mt-2 text-slate-700">
                    {para}
                  </p>
                ))}
              </div>
            ))}
            {page.keywordSentence ? (
              <p className="mt-6 text-sm leading-relaxed text-slate-600">{page.keywordSentence}</p>
            ) : null}
          </div>
        </div>
      </section>

      {nearby.length > 0 ? (
        <section
          className="seo-section seo-section--tint"
          aria-labelledby="seo-nearby-heading"
        >
          <div className="seo-section-inner">
            <h2 id="seo-nearby-heading" className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
              Nearby locations
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              We also quote removals and van jobs in surrounding towns — select an area for local pricing.
            </p>
            <ul className="seo-chip-list mt-4 flex flex-wrap gap-2 sm:mt-5">
              {nearby.map(({ href, label }) => (
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

      <section
        className="seo-section seo-section--white"
        aria-labelledby="seo-services-heading"
      >
        <div className="seo-section-inner">
          <h2 id="seo-services-heading" className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {servicesHeading}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Choose the service that matches your move — each option opens our quote wizard with the right defaults.
          </p>
          <ul className="mt-5 space-y-2.5 text-sm text-slate-700 sm:mt-6 sm:space-y-3 sm:text-base">
            {page.serviceBullets.map((item) => (
              <li key={item} className="flex gap-2.5 leading-relaxed">
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-brand-500 to-emerald-500"
                  aria-hidden
                />
                {item}
              </li>
            ))}
          </ul>
          <h3 className="mt-8 text-base font-semibold text-slate-900 sm:mt-10">All ShiftMyHome services</h3>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
            {SERVICE_LINKS.map(({ to, label }) => (
              <li key={to}>
                <Link to={to} className="seo-service-card">
                  <span className="min-w-0 truncate">{label}</span>
                  <span className="shrink-0 text-brand-500" aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        className="seo-section seo-section--muted"
        aria-labelledby="seo-trust-heading"
      >
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
          <SeoFaqAccordion faqs={page.faqs} />
        </div>
      </section>

      <section className="seo-cta-band" aria-labelledby="seo-cta-heading">
        <div className="seo-cta-inner">
          <h2 id="seo-cta-heading" className="text-xl font-bold sm:text-2xl lg:text-3xl">
            {page.cityName === 'Scotland' ? 'Ready to book your move?' : `Ready for your ${page.cityName} move?`}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100/95 sm:text-base">
            Get a clear price in minutes. Call, WhatsApp, or start the quote wizard below.
          </p>
          <div className="seo-cta-actions mt-7 flex flex-col items-stretch justify-center gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center">
            <a href="#seo-quote" className="seo-cta-btn-primary">
              Start quote
            </a>
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

      {page.relatedLinks.length > 0 ? (
        <section
          className="seo-section seo-section--tint"
          aria-labelledby="seo-related-heading"
        >
          <div className="seo-section-inner">
            <h2 id="seo-related-heading" className="text-lg font-bold text-slate-900 sm:text-xl">
              Related guides &amp; services
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Explore nearby services, city pages, and Scotland-wide removal guides.
            </p>
            <ul className="seo-chip-list mt-4 flex flex-wrap gap-2">
              {page.relatedLinks.map(({ href, label }) => (
                <li key={href} className="min-w-0 max-w-full">
                  <Link to={href} className="seo-chip seo-chip--compact">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section id="seo-quote" className="seo-quote-wrap" aria-label="Instant quote">
        <h2 className="sr-only">Get your instant quote</h2>
        <QuoteWizard serviceType={page.serviceType} compact />
      </section>
    </article>
  )
}
