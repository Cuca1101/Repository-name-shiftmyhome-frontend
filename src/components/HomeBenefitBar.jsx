const BENEFITS = [
  {
    title: 'Fully Insured',
    caption: 'Goods in safe hands',
    icon: (
      <svg className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
  },
  {
    title: 'Experienced Team',
    caption: 'Trained & professional',
    icon: (
      <svg className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.433-2.054M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
  {
    title: 'On Time',
    caption: 'We value your time',
    icon: (
      <svg className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    title: 'No Hidden Fees',
    caption: 'Transparent pricing',
    icon: (
      <svg className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 7.756a4.5 4.5 0 1 0 0 8.488M7.5 10.5h5.25m-5.25 3h5.25M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
]

function BenefitList({ embedded }) {
  return (
    <ul
      className={
        embedded
          ? 'grid grid-cols-2 divide-x-0 divide-y divide-slate-300/50 sm:grid-cols-4 sm:divide-x sm:divide-y-0'
          : 'grid grid-cols-2 divide-x-0 divide-y divide-slate-200/90 sm:grid-cols-4 sm:divide-x sm:divide-y-0'
      }
    >
      {BENEFITS.map(({ title, caption, icon }) => (
        <li key={title} className="flex flex-col items-center px-3 py-4 text-center sm:px-5 sm:py-3">
          <div
            className={
              embedded
                ? 'flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200/60'
                : 'flex h-10 w-10 items-center justify-center rounded-lg border border-white bg-white shadow-sm ring-1 ring-slate-200/60'
            }
          >
            {icon}
          </div>
          <h3 className="mt-2 text-sm font-bold text-navy">{title}</h3>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500 sm:text-xs">{caption}</p>
        </li>
      ))}
    </ul>
  )
}

/**
 * @param {{ embedded?: boolean }} props — `embedded` renders under the About card (reference layout).
 */
export default function HomeBenefitBar({ embedded = false }) {
  if (embedded) {
    return (
      <div id="benefits" className="overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-100/90 shadow-sm">
        <div className="px-2 py-4 sm:px-4 sm:py-5">
          <BenefitList embedded />
        </div>
      </div>
    )
  }

  return (
    <section id="benefits" className="scroll-mt-[76px] border-y border-slate-200/80 bg-surface-muted">
      <div className="home-container py-5 sm:py-6">
        <BenefitList embedded={false} />
      </div>
    </section>
  )
}
