import { Link } from 'react-router-dom'
import PublicLayout from '../layouts/PublicLayout'
import CustomerQuoteCalculator from '../components/CustomerQuoteCalculator'

export default function QuotePage() {
  return (
    <PublicLayout>
      <div className="quote-flow-layout min-w-0 bg-slate-50" data-quote-flow>
        <div className="home-container border-b border-slate-200/80 bg-white px-3 py-3 sm:px-6 sm:py-6">
          <Link
            to="/"
            className="inline-flex min-h-[36px] items-center gap-2 text-xs font-semibold text-slate-600 transition hover:text-brand-700 sm:min-h-[44px] sm:text-sm"
          >
            <span aria-hidden>←</span> Back to home
          </Link>
          <h1 className="mt-1.5 text-xl font-extrabold tracking-tight text-navy sm:mt-2 sm:text-3xl">
            Get your instant quote
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-snug text-slate-600 sm:text-base">
            Four quick steps — your price appears when you review and submit.
          </p>
        </div>
        <CustomerQuoteCalculator />
      </div>
    </PublicLayout>
  )
}
