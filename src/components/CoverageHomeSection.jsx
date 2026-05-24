import { COVERAGE_DIRECTORY_PATH } from './CoverageLink'
import { Link } from 'react-router-dom'
import { useWebsiteCms } from '../context/WebsiteCmsContext'
import { DEFAULT_COVERAGE } from '../lib/websiteCmsDefaults'

/** Homepage anchor target for navbar "Coverage" → #coverage */
export default function CoverageHomeSection() {
  const { coverage } = useWebsiteCms()
  const c = coverage ?? DEFAULT_COVERAGE

  return (
    <section id="coverage" className="scroll-mt-[76px] border-t border-slate-200 bg-slate-50 py-12 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
            {c.heading || 'Coverage'}
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">{c.subheading}</p>
          {c.bodyText ? <p className="mt-3 text-sm text-slate-600">{c.bodyText}</p> : null}
          {c.cities?.length ? (
            <p className="mt-4 text-sm font-medium text-slate-700">{c.cities.join(' · ')}</p>
          ) : null}
          {c.imageUrl ? (
            <img src={c.imageUrl} alt="" className="mx-auto mt-6 max-h-48 rounded-xl object-cover shadow-md" />
          ) : null}
          <Link
            to={COVERAGE_DIRECTORY_PATH}
            className="mt-8 inline-flex min-h-[48px] items-center justify-center rounded-full bg-brand-600 px-8 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-brand-700"
          >
            View coverage map
          </Link>
          {c.seoText ? <p className="mt-6 text-xs text-slate-500">{c.seoText}</p> : null}
        </div>
      </div>
    </section>
  )
}
