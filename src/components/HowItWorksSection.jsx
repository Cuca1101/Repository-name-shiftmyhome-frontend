const STEPS = [
  {
    title: 'Get your quote',
    description: 'Tell us about your move online — addresses, items, and date — for a clear price in minutes.',
  },
  {
    title: 'Book your slot',
    description: 'Confirm your booking and we assign the right van and crew for your job.',
  },
  {
    title: 'We move you',
    description: 'Professional loading, safe transport, and careful delivery to your new address.',
  },
  {
    title: 'Job complete',
    description: 'Unpack essentials, sign off happy, and reach us anytime if you need support.',
  },
]

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="scroll-mt-[76px] bg-white py-10 sm:py-14">
      <div className="home-container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">How it works</h2>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Four simple steps from quote to completion — no surprises along the way.
          </p>
        </div>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="relative rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-sm sm:p-5"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                {index + 1}
              </span>
              <h3 className="mt-3 text-base font-bold text-slate-900">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
