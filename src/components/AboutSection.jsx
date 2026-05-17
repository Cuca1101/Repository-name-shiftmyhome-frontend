import HomeBenefitBar from './HomeBenefitBar'
import { useWebsiteCms } from '../context/WebsiteCmsContext'
import { DEFAULT_ABOUT } from '../lib/websiteCmsDefaults'

const TRUST_ICONS = [
  (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  ),
  (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  ),
  (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 7.756a4.5 4.5 0 1 0 0 8.488M7.5 10.5h5.25m-5.25 3h5.25M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
]

export default function AboutSection() {
  const { about } = useWebsiteCms()
  const a = about ?? DEFAULT_ABOUT
  const trustCards = a.trustCards?.length ? a.trustCards : DEFAULT_ABOUT.trustCards
  const imageUrl = a.imageUrl || DEFAULT_ABOUT.imageUrl

  return (
    <section id="about" className="scroll-mt-[76px] bg-slate-50/80 py-8 sm:py-10 lg:py-12">
      <div className="home-container">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="overflow-hidden rounded-2xl bg-white shadow-premium ring-1 ring-slate-200/70 lg:grid lg:grid-cols-2 lg:items-stretch">
            <div className="relative min-h-[240px] w-full sm:min-h-[280px] lg:min-h-[420px]">
              <img
                src={imageUrl}
                alt="ShiftMyHome removals van with professional movers loading boxes"
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
            </div>

            <div className="flex flex-col justify-center px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
              <h2 className="text-2xl font-extrabold tracking-tight text-navy sm:text-[1.75rem] lg:text-[1.85rem]">
                {a.heading}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-[15px]">{a.paragraph1}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">{a.paragraph2}</p>

              <ul className="mt-7 grid gap-3 sm:grid-cols-3 sm:gap-2.5">
                {trustCards.map((card, index) => (
                  <li
                    key={card.title}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/90 p-3.5 shadow-sm sm:p-4"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      {TRUST_ICONS[index % TRUST_ICONS.length]}
                    </div>
                    <h3 className="mt-2.5 text-xs font-bold leading-snug text-navy sm:text-sm">{card.title}</h3>
                    <p className="mt-1 text-[11px] leading-snug text-slate-600 sm:text-xs">{card.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <HomeBenefitBar embedded />
        </div>
      </div>
    </section>
  )
}
