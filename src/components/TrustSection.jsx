const points = [
  { title: 'Fully insured service', text: 'Peace of mind for your home and belongings.' },
  { title: 'Clear communication', text: 'We confirm details upfront — no surprises on moving day.' },
  { title: 'Careful loading and unloading', text: 'Blankets, straps, and attention to fragile items.' },
  { title: 'Local Glasgow team', text: 'We know the city — stairs, parking, and quickest routes.' },
  { title: 'Affordable pricing', text: 'Fair quotes with no hidden fees.' },
]

export default function TrustSection() {
  return (
    <section id="why-us" className="scroll-mt-20 bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Why choose ShiftMyHome?
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Straightforward removals from a team that turns up on time and treats your home with respect.
          </p>
        </div>
        <ul className="mt-8 grid grid-cols-2 gap-3 xxs:gap-4 xs:mt-10 sm:mt-12 sm:gap-4 lg:grid-cols-3">
          {points.map(({ title, text }) => (
            <li
              key={title}
              className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 shadow-card transition hover:border-brand-200 hover:shadow-card-hover xxs:p-3.5 xs:rounded-2xl sm:p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
