import { Link } from 'react-router-dom'
import PublicLayout from '../layouts/PublicLayout'
import CustomerQuoteCalculator from '../components/CustomerQuoteCalculator'

export default function QuotePage() {
  return (
    <PublicLayout>
      <div className="min-w-0 bg-slate-50">
        <div className="home-container border-b border-slate-200/80 bg-white py-5 sm:py-6">
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-brand-700"
          >
            <span aria-hidden>←</span> Back to home
          </Link>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
            Get your instant quote
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 sm:text-base">
            Four quick steps — your price appears when you review and submit.
          </p>
        </div>
        <CustomerQuoteCalculator />
      </div>
    </PublicLayout>
  )
}
