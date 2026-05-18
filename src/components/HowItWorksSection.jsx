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

/**
 * @param {{ compact?: boolean }} props — tighter spacing when used on mobile homepage stack.
 */
export default function HowItWorksSection({ compact = false }) {
  return (
    <section
      id="how-it-works"
      className={`bg-white ${compact ? 'scroll-mt-[60px] py-5' : 'scroll-mt-[76px] py-10 sm:py-14'}`}
    >
      <div className={compact ? 'home-container px-4' : 'home-container'}>
        <div className={compact ? 'min-w-0' : 'mx-auto max-w-2xl text-center'}>
          <h2
            className={`font-bold tracking-tight text-navy ${compact ? 'text-lg' : 'text-2xl sm:text-3xl'}`}
          >
            How it works
          </h2>
          <p className={`text-slate-600 ${compact ? 'mt-1 text-xs leading-snug' : 'mt-2 text-sm sm:text-base'}`}>
            Four simple steps from quote to completion — no surprises along the way.
          </p>
        </div>
        <ol
          className={
            compact
              ? 'mt-4 grid grid-cols-1 gap-2.5'
              : 'mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5'
          }
        >
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className={`relative rounded-xl border border-slate-200/80 bg-slate-50/80 shadow-sm ${
                compact ? 'p-3' : 'p-4 sm:p-5'
              }`}
            >
              <span
                className={`inline-flex items-center justify-center rounded-full bg-brand-600 font-bold text-white ${
                  compact ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-sm'
                }`}
              >
                {index + 1}
              </span>
              <h3 className={`font-bold text-slate-900 ${compact ? 'mt-2 text-sm' : 'mt-3 text-base'}`}>
                {step.title}
              </h3>
              <p
                className={`leading-relaxed text-slate-600 ${
                  compact ? 'mt-0.5 text-xs' : 'mt-1 text-sm'
                }`}
              >
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
