import { Link, Navigate, useLocation } from 'react-router-dom'
import QuoteWizard from '../components/quote-wizard/QuoteWizard'
import SeoHead from '../components/seo/SeoHead'
import SeoFaqJsonLd from '../components/seo/SeoFaqJsonLd'
import { getSeoPageByPath } from '../data/seoPages'
import { CONTACT, WHATSAPP_URL } from '../config'

const TRUST_ITEMS = [
  {
    title: 'Fully insured',
    text: 'Goods-in-transit cover on booked moves — share fragile or high-value items when you quote.',
  },
  {
    title: 'Scotland-wide coverage',
    text: 'Local crews across Scottish cities with UK-wide routes when you need to go further.',
  },
  {
    title: 'Experienced movers',
    text: 'Professional drivers and handlers who communicate clearly before and on move day.',
  },
  {
    title: 'Same-day when available',
    text: 'Short-notice slots depend on crew schedules — quote with your date for an honest answer.',
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

const HERO_TRUST = ['Fully insured moves', 'Scotland-wide coverage', 'Experienced local crews']

export default function SeoLandingPage() {
  const { pathname } = useLocation()
  const page = getSeoPageByPath(pathname)

  if (!page) {
    return <Navigate to="/" replace />
  }

  const servicesHeading =
    page.cityName === 'Scotland' ? 'Moving services across Scotland' : `Services in ${page.cityName}`
  const nearby = page.nearbyLocations ?? []

  return (
    <article className="min-w-0">
      <SeoHead title={page.title} description={page.metaDescription} path={page.path} />
      <SeoFaqJsonLd faqs={page.faqs} path={page.path} />

      <header
        className="relative isolate overflow-hidden border-b border-slate-200/80 bg-brand-950"
        aria-label="Page introduction"
      >
        <div
          className="absolute inset-0 bg-gradient-to-br from-brand-950 via-brand-900 to-slate-900"
          aria-hidden
        />
        <div className="relative mx-auto min-w-0 max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <nav className="text-xs font-medium text-brand-200/90 sm:text-sm" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-white">
              Home
            </Link>
            <span className="mx-2 text-brand-400/60">/</span>
            <span className="text-white/90">{page.cityName}</span>
          </nav>
          <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-brand-300">{page.regionLabel}</p>
          <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
            {page.h1}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-100 sm:text-base">{page.heroTeaser}</p>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-100/95 sm:text-sm" aria-label="Key benefits">
            {HERO_TRUST.map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-brand-300" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#seo-quote"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-brand-900 shadow-md transition hover:bg-brand-50"
            >
              Get instant quote
            </a>
            <Link
              to="/coverage"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-white/25 bg-white/10 px-6 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              View coverage
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-white py-10 sm:py-14" aria-labelledby="seo-intro-heading">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-slate-700">
            <h2 id="seo-intro-heading" className="text-lg font-bold text-slate-900 sm:text-xl">
              {page.cityName === 'Scotland' ? 'Professional moves across Scotland' : `Local movers in ${page.cityName}`}
            </h2>
            <p className="mt-4 text-base leading-relaxed sm:text-lg">{page.intro}</p>
            <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">{page.introSecondary}</p>
          </div>
        </div>
      </section>

      {nearby.length > 0 ? (
        <section
          className="border-b border-slate-200 bg-slate-50 py-8 sm:py-10"
          aria-labelledby="seo-nearby-heading"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 id="seo-nearby-heading" className="text-lg font-bold text-slate-900 sm:text-xl">
              Nearby locations
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              We also quote removals and van jobs in surrounding towns — select an area for local pricing.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {nearby.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    to={href}
                    className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-800"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="border-b border-slate-200 bg-white py-10 sm:py-14" aria-labelledby="seo-services-heading">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 id="seo-services-heading" className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {servicesHeading}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
            Choose the service that matches your move — each option opens our quote wizard with the right defaults.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-700 sm:text-base">
            {page.serviceBullets.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <h3 className="mt-8 text-base font-semibold text-slate-900">All ShiftMyHome services</h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICE_LINKS.map(({ to, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="flex min-h-[52px] items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-brand-300 hover:text-brand-800"
                >
                  {label}
                  <span className="text-brand-500" aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 py-10 sm:py-14" aria-labelledby="seo-trust-heading">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 id="seo-trust-heading" className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Why book ShiftMyHome{page.cityName !== 'Scotland' ? ` in ${page.cityName}` : ''}
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {TRUST_ITEMS.map(({ title, text }) => (
              <li key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white py-10 sm:py-14" aria-labelledby="seo-faq-heading">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 id="seo-faq-heading" className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Frequently asked questions
            {page.cityName !== 'Scotland' ? ` — ${page.cityName}` : ''}
          </h2>
          <dl className="mt-8 space-y-4">
            {page.faqs.map(({ q, a }) => (
              <div key={q} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <dt className="text-sm font-semibold text-slate-900 sm:text-base">{q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-slate-600">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-brand-950 py-10 text-white sm:py-12" aria-labelledby="seo-cta-heading">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
          <h2 id="seo-cta-heading" className="text-xl font-bold sm:text-2xl">
            {page.cityName === 'Scotland' ? 'Ready to book your move?' : `Ready for your ${page.cityName} move?`}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-brand-100 sm:text-base">
            Get a clear price in minutes. Call, WhatsApp, or start the quote wizard below.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#seo-quote"
              className="inline-flex min-h-[48px] items-center rounded-full bg-white px-6 text-sm font-semibold text-brand-900 hover:bg-brand-50"
            >
              Start quote
            </a>
            <a
              href={`tel:${CONTACT.phoneTel}`}
              className="inline-flex min-h-[48px] items-center rounded-full border border-white/30 px-6 text-sm font-semibold text-white hover:bg-white/10"
            >
              {CONTACT.phoneDisplay}
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[48px] items-center rounded-full border border-white/30 px-6 text-sm font-semibold text-white hover:bg-white/10"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </section>

      {page.relatedLinks.length > 0 ? (
        <section className="border-b border-slate-200 bg-white py-8 sm:py-10" aria-labelledby="seo-related-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 id="seo-related-heading" className="text-lg font-bold text-slate-900 sm:text-xl">
              Related guides &amp; services
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Explore nearby services, city pages, and Scotland-wide removal guides.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {page.relatedLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    to={href}
                    className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-800 sm:text-sm"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section id="seo-quote" className="scroll-mt-[76px] border-t border-slate-200 bg-white" aria-label="Instant quote">
        <h2 className="sr-only">Get your instant quote</h2>
        <QuoteWizard serviceType={page.serviceType} compact />
      </section>
    </article>
  )
}
