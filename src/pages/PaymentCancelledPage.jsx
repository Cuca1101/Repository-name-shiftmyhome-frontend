import { Link } from 'react-router-dom'
import SeoHead from '../components/seo/SeoHead'

export default function PaymentCancelledPage() {
  return (
    <>
      <SeoHead
        title="Payment Cancelled | ShiftMyHome"
        description="Your ShiftMyHome payment was cancelled. Return to your quote to try again."
        path="/payment-cancelled"
        robots="noindex, nofollow"
      />
      <div className="min-w-0 bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-lg px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Payment cancelled</h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
            No charge was made. You can return to your quote to try again or submit your enquiry without paying.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand-600 px-8 py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-700"
            >
              Back to home
            </Link>
            <a
              href="/quote"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-200 bg-white px-8 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Return to quote form
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
