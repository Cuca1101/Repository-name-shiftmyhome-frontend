import { Link } from 'react-router-dom'

/** Homepage anchor target for navbar "Coverage" → #coverage */
export default function CoverageHomeSection() {
  return (
    <section id="coverage" className="scroll-mt-20 border-t border-slate-200 bg-slate-50 py-12 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">Coverage</h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Glasgow-based with UK-wide moves — see our network map and service hubs across the country.
          </p>
          <Link
            to="/coverage"
            className="mt-8 inline-flex min-h-[48px] items-center justify-center rounded-full bg-brand-600 px-8 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-brand-700"
          >
            View coverage map
          </Link>
        </div>
      </div>
    </section>
  )
}
