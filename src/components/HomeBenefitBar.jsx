const BENEFITS = [
  {
    title: 'Fully Insured',
    caption: 'Goods in safe hands',
    icon: (
      <svg className="h-7 w-7 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
  },
  {
    title: 'Experienced Team',
    caption: 'Trained & professional',
    icon: (
      <svg className="h-7 w-7 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.433-2.054M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
  {
    title: 'On Time',
    caption: 'We value your time',
    icon: (
      <svg className="h-7 w-7 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    title: 'No Hidden Fees',
    caption: 'Transparent pricing',
    icon: (
      <svg className="h-7 w-7 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 7.756a4.5 4.5 0 1 0 0 8.488M7.5 10.5h5.25m-5.25 3h5.25M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
]

export default function HomeBenefitBar() {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-slate-50/90">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <ul className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-4">
          {BENEFITS.map(({ title, caption, icon }) => (
            <li key={title} className="flex min-w-0 flex-col items-center text-center sm:items-start sm:text-left">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-brand-100 bg-white shadow-sm">
                {icon}
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900 sm:text-base">{title}</h3>
              <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{caption}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
