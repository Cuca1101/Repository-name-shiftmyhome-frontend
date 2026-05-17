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
    <div className="min-w-0">
      <section
        className="relative isolate overflow-hidden border-b border-slate-200/80 bg-brand-950"
        aria-label="Service hero"
      >
        <div
          className="absolute inset-0 bg-cover bg-center opacity-90"
          style={{ backgroundImage: `url(${page.heroImage})` }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-950/95 via-brand-900/88 to-brand-800/80" aria-hidden />
        <div className="relative mx-auto min-w-0 max-w-6xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <Link
            to="/#services"
            className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-semibold text-white/90 transition hover:text-white sm:text-sm"
          >
            <span aria-hidden>←</span> Back to services
          </Link>
          <h1 className="mt-3 text-balance text-xl font-bold tracking-tight text-white sm:text-2xl lg:text-[1.75rem]">
            {page.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-100 sm:text-[15px]">
            {page.shortDescription}
          </p>
        </div>
      </section>

      <QuoteWizard serviceType={page.serviceType} compact />
    </div>
  )
}
