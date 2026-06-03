const STEPS = [
  {
    title: 'Enter addresses',
    text: 'Add pickup and delivery postcodes — we calculate distance automatically.',
  },
  {
    title: 'List your items',
    text: 'Choose furniture, boxes, and extras so crew and van size match your job.',
  },
  {
    title: 'Book online',
    text: 'See your live price, pick a date, and confirm — no phone call required.',
  },
]

/**
 * Three-step booking explainer — shared across all SEO landing pages.
 *
 * @param {{ cityName?: string }} props
 */
export default function SeoQuickBookSteps({ cityName = 'Scotland' }) {
  const place = cityName === 'Scotland' ? 'Scotland' : cityName

  return (
    <section className="seo-section seo-section--white !py-4 sm:!py-5" aria-labelledby="seo-steps-heading">
      <div className="seo-section-inner">
        <h2 id="seo-steps-heading" className="sr-only">
          How to book your {place} move
        </h2>
        <p className="text-center text-sm font-medium text-slate-600 sm:text-base">
          Book your {place} move in <span className="font-bold text-brand-700">3 simple steps</span>
        </p>
        <ol className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-3 sm:gap-4">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm sm:flex-col sm:items-center sm:px-4 sm:py-4 sm:text-center"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-emerald-500 text-sm font-bold text-white shadow-md sm:h-9 sm:w-9"
                aria-hidden
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">{step.title}</p>
                <p className="mt-0.5 text-xs leading-snug text-slate-600 sm:mt-1 sm:text-sm">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
