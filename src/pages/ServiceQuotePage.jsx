import { Link, Navigate, useLocation } from 'react-router-dom'
import { getServicePageByPath } from '../constants/servicePages'
import QuoteWizard from '../components/quote-wizard/QuoteWizard'

export default function ServiceQuotePage() {
  const { pathname } = useLocation()
  const page = getServicePageByPath(pathname)
  if (!page) {
    return <Navigate to="/" replace />
  }

  return (
    <div>
      <section
        className="relative isolate overflow-hidden border-b border-slate-200 bg-brand-950"
        aria-label="Service hero"
      >
        <div
          className="absolute inset-0 bg-cover bg-center opacity-90"
          style={{ backgroundImage: `url(${page.heroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-950/95 via-brand-900/88 to-brand-800/80" />
        <div className="relative mx-auto min-w-0 max-w-6xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
          <Link
            to="/#services"
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-white/90 transition hover:text-white"
          >
            <span aria-hidden>←</span> Back to Services
          </Link>
          <h1 className="mt-6 text-balance text-2xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            {page.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-brand-100 sm:text-lg">{page.shortDescription}</p>
          <p className="mt-3 max-w-2xl text-sm text-brand-200/90">
            Four quick steps — your price appears at the end when you review and submit.
          </p>
        </div>
      </section>

      <QuoteWizard serviceType={page.serviceType} />
    </div>
  )
}
