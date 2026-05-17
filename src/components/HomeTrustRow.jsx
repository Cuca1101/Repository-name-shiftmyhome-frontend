function Stars() {
  return (
    <span className="inline-flex gap-0.5 text-emerald-500" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className="h-4 w-4 fill-current sm:h-5 sm:w-5" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  )
}

export default function HomeTrustRow() {
  return (
    <div className="border-y border-slate-100 bg-white">
      <div className="mx-auto flex min-w-0 max-w-6xl flex-col items-start justify-between gap-4 px-4 py-5 sm:flex-row sm:items-center sm:px-6 sm:py-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <Stars />
          <div>
            <p className="text-sm font-bold text-slate-900 sm:text-base">
              Excellent <span className="font-semibold text-slate-600">4.8 out of 5</span>
            </p>
            <p className="text-xs text-slate-500 sm:text-sm">Trusted by customers across Glasgow &amp; the UK</p>
          </div>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-slate-600 sm:text-sm">
          <li className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-hidden />
            Fully insured moves
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-hidden />
            Professional movers
          </li>
        </ul>
      </div>
    </div>
  )
}
