import { Link } from 'react-router-dom'
import HomeSectionLink from '../components/HomeSectionLink'
import SeoHead from '../components/seo/SeoHead'
import SeoBreadcrumbJsonLd from '../components/seo/SeoBreadcrumbJsonLd'
import { SERVICE_PAGES } from '../constants/servicePages'
import NetworkCoverageMap from '../components/coverage/NetworkCoverageMap'
import { COVERAGE_AREAS } from '../lib/coverageAreas'

const MAIN_LINKS = [
  { sectionId: 'home', label: 'Home' },
  { sectionId: 'services', label: 'Services' },
  { sectionId: 'pricing', label: 'Pricing & quote' },
  { sectionId: 'reviews', label: 'Reviews' },
  { sectionId: 'contact', label: 'Contact' },
]

export default function CoveragePage() {
  return (
    <div className="min-w-0 bg-slate-50 pb-16 pt-8 sm:pb-20 sm:pt-10">
      <SeoHead
        title="Removals Coverage Across Scotland | ShiftMyHome"
        description="ShiftMyHome covers removals, man with van, furniture delivery and moving services across Glasgow, Edinburgh, Aberdeen, Dundee, Inverness, Stirling, Perth and wider Scotland."
        path="/coverage"
        includeSocial
      />
      <SeoBreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'Coverage', path: '/coverage' }]} />
      <div className="mx-auto min-w-0 max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
              <Link to="/" className="font-medium text-brand-700 hover:text-brand-800">
                Home
              </Link>
              <span className="mx-2 text-slate-300">/</span>
              <span className="text-slate-700">Coverage</span>
            </nav>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">UK coverage map</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
              Interactive network view — pins show regular service hubs. We also quote UK-wide moves beyond these markers.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Back to home
          </Link>
        </div>

        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-12 lg:gap-10 lg:items-start">
          <aside className="order-2 space-y-8 lg:order-1 lg:col-span-4 xl:col-span-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-700" aria-hidden>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">Sitemap</p>
                  <p className="text-xs text-slate-500">Navigate the site</p>
                </div>
              </div>

              <div className="mt-5 space-y-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Main pages</p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {MAIN_LINKS.map((l) => (
                      <li key={l.sectionId + l.label}>
                        <HomeSectionLink sectionId={l.sectionId} className="text-slate-700 hover:text-brand-700">
                          {l.label}
                        </HomeSectionLink>
                      </li>
                    ))}
                    <li>
                      <Link to="/coverage" className="font-medium text-brand-700">
                        Coverage (you are here)
                      </Link>
                    </li>
                  </ul>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Services</p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {SERVICE_PAGES.map((p) => (
                      <li key={p.path}>
                        <Link to={p.path} className="text-slate-700 hover:text-brand-700">
                          {p.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Coverage areas</p>
                  <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm text-slate-600">
                    {COVERAGE_AREAS.map((a) => (
                      <li key={a.id}>{a.name}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </aside>

          <div className="order-1 min-w-0 lg:order-2 lg:col-span-8 xl:col-span-9">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
              <NetworkCoverageMap
                variant="full"
                searchInputId="page-coverage-search"
                statusLine="Live status · active service areas"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
