const CARDS = [
  {
    title: 'Same-day availability',
    description: 'Need to move urgently? We often have crews available at short notice across Glasgow and nearby.',
    icon: (
      <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Insured drivers',
    description: 'Professional drivers and movers with goods-in-transit cover — your belongings are protected on the road.',
    icon: (
      <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
  },
  {
    title: 'Transparent pricing',
    description: 'Clear quotes based on distance, volume, and access — no surprise charges when we’ve agreed the scope.',
    icon: (
      <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    title: 'Customer & driver support',
    description: 'Friendly office support for bookings and updates, plus drivers who communicate clearly on the day.',
    icon: (
      <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    ),
  },
]

export default function WhyShiftMyHomeSection() {
  return (
    <section id="why-us" className="scroll-mt-20 bg-white py-12 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">Why ShiftMyHome</h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Reliable removals built around speed, safety, honest pricing, and people who actually answer the phone.
          </p>
        </div>
        <ul className="mt-8 grid grid-cols-2 gap-3 xxs:gap-4 xs:mt-10 sm:mt-12 sm:gap-5 lg:grid-cols-4 lg:gap-6">
          {CARDS.map(({ title, description, icon }) => (
            <li
              key={title}
              className="flex flex-col rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 shadow-card transition hover:border-brand-200 hover:shadow-card-hover xxs:p-3.5 xs:rounded-2xl sm:p-6"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-emerald-600 text-white shadow-md shadow-brand-600/25 xxs:h-10 xxs:w-10 sm:h-14 sm:w-14 sm:rounded-2xl [&_svg]:h-5 [&_svg]:w-5 sm:[&_svg]:h-10 sm:[&_svg]:w-10">
                {icon}
              </div>
              <h3 className="mt-2 text-sm font-semibold text-slate-900 xxs:mt-3 xxs:text-base sm:mt-5 sm:text-lg">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 xxs:mt-1.5 sm:mt-2 sm:text-sm">{description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
