import HomeSectionLink from './HomeSectionLink'

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80'

const btnPrimary =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:from-brand-700 hover:to-brand-600 sm:px-8 sm:text-base'
const btnSecondary =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border-2 border-brand-600 bg-white px-6 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 sm:px-8 sm:text-base'

export default function Hero() {
  return (
    <section id="home" className="scroll-mt-24 overflow-hidden bg-white">
      <div className="mx-auto grid min-w-0 max-w-7xl lg:grid-cols-2 lg:items-center">
        <div className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Glasgow &amp; UK removals</p>
          <h1 className="mt-3 text-balance text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-5xl xl:text-[3.25rem]">
            Moving made{' '}
            <span className="bg-gradient-to-r from-brand-600 to-cyan-500 bg-clip-text text-transparent">simple.</span>
            <br />
            Stress-free{' '}
            <span className="bg-gradient-to-r from-brand-600 to-cyan-500 bg-clip-text text-transparent">
              from start to finish.
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Professional movers. Reliable service. Get your instant quote in minutes.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <HomeSectionLink sectionId="quote" className={btnPrimary}>
              Get an Instant Quote
              <span aria-hidden>→</span>
            </HomeSectionLink>
            <HomeSectionLink sectionId="how-it-works" className={btnSecondary}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700" aria-hidden>
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              How it works
            </HomeSectionLink>
          </div>
        </div>
        <div className="relative min-h-[240px] sm:min-h-[320px] lg:min-h-[520px]">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${HERO_IMAGE})` }}
            role="img"
            aria-label="Professional home removals"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent lg:from-white lg:via-white/40 lg:to-transparent"
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white/30 via-transparent to-transparent lg:hidden" aria-hidden />
        </div>
      </div>
    </section>
  )
}
