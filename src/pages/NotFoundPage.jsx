import { Link } from 'react-router-dom'
import SeoHead from '../components/seo/SeoHead'

export default function NotFoundPage() {
  return (
    <>
      <SeoHead
        title="Page Not Found | ShiftMyHome"
        description="The page you requested could not be found. Browse our removals services or get an instant quote."
        path="/404"
        robots="noindex, nofollow"
      />
      <div className="min-w-0 bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-lg px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Page not found</h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
            This page does not exist. Try our homepage, coverage map, or instant quote wizard.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand-600 px-8 py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-700"
            >
              Back to home
            </Link>
            <Link
              to="/coverage"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-200 bg-white px-8 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              View coverage
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
