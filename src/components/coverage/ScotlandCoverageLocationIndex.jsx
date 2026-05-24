import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getScotlandLocationsGroupedByRegion,
  SCOTLAND_LOCATION_NAMES,
} from '../../lib/seo/locations.js'

export default function ScotlandCoverageLocationIndex() {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => getScotlandLocationsGroupedByRegion(), [])

  const normalizedQuery = query.trim().toLowerCase()

  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) return groups
    return groups
      .map((group) => ({
        ...group,
        locations: group.locations.filter(
          (loc) =>
            loc.name.toLowerCase().includes(normalizedQuery) ||
            loc.slug.includes(normalizedQuery.replace(/\s+/g, '-')),
        ),
      }))
      .filter((group) => group.locations.length > 0)
  }, [groups, normalizedQuery])

  const visibleCount = filteredGroups.reduce((sum, g) => sum + g.locations.length, 0)

  return (
    <section id="scotland-coverage" className="mt-10 scroll-mt-[76px]" aria-labelledby="coverage-locations-heading">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="coverage-locations-heading" className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Scotland removals coverage areas
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Browse {SCOTLAND_LOCATION_NAMES.length} towns and cities across Scotland. Each link opens a local removals
              page with instant online quotes — house moves, man with van, and furniture delivery.
            </p>
          </div>
          <p className="shrink-0 text-sm font-medium text-slate-500">
            {visibleCount} area{visibleCount === 1 ? '' : 's'}
            {normalizedQuery ? ' matched' : ''}
          </p>
        </div>

        <label className="mt-6 block">
          <span className="sr-only">Search coverage areas</span>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400" aria-hidden>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
              </svg>
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search town or city…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/25"
              autoComplete="off"
            />
          </div>
        </label>

        {filteredGroups.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
            No areas match &ldquo;{query}&rdquo;. Try Glasgow, Edinburgh, Aberdeen, or another Scottish town.
          </p>
        ) : (
          <div className="mt-8 space-y-8">
            {filteredGroups.map((group) => (
              <div key={group.regionKey}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-700">{group.label}</h3>
                <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.locations.map((loc) => (
                    <li key={loc.href}>
                      <Link
                        to={loc.href}
                        className="flex min-h-[44px] items-center rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
                      >
                        {loc.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Need a quote for your postcode? We also cover UK-wide routes from Scotland.
          </p>
          <Link
            to="/quote"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Get instant quote
          </Link>
        </div>
      </div>
    </section>
  )
}
