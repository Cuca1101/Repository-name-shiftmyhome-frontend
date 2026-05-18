import { Link } from 'react-router-dom'
import { HouseIcon, iconBySlug } from '../serviceIcons'
import { useWebsiteCms } from '../../context/WebsiteCmsContext'
import { DEFAULT_HOMEPAGE } from '../../lib/websiteCmsDefaults'
import { useServiceGridCards } from '../../hooks/useServiceGridCards'

/** Desktop service cards — unchanged grid (md+). */
export default function DesktopServiceGrid() {
  const { homepage } = useWebsiteCms()
  const h = homepage ?? DEFAULT_HOMEPAGE
  const cards = useServiceGridCards()

  return (
    <section id="services" className="home-section scroll-mt-[76px] bg-white pb-2">
      <div className="home-container">
        <div className="mb-5 flex flex-col gap-1 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-navy sm:text-2xl lg:text-[1.65rem]">
              {h.servicesHeading}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-slate-600">{h.servicesSubheading}</p>
          </div>
        </div>

        <ul className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-5">
          {cards.map((card) => {
            const Icon = iconBySlug[card.slug] ?? HouseIcon
            return (
              <li key={card.key} className="flex min-w-0">
                <Link
                  to={card.path}
                  className="group relative flex h-[300px] w-full min-w-0 overflow-hidden rounded-2xl shadow-premium ring-1 ring-slate-900/10 transition-all duration-300 ease-premium hover:-translate-y-1.5 hover:shadow-card-hover sm:h-[320px] lg:h-[340px]"
                >
                  <img
                    src={card.imageSrc}
                    alt={card.title}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 ease-premium group-hover:scale-[1.06]"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/70 to-slate-900/25"
                    aria-hidden
                  />
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-900/20 via-transparent to-transparent opacity-80"
                    aria-hidden
                  />
                  <div className="relative z-10 flex h-full w-full flex-col p-4 sm:p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-white/15 text-white shadow-lg backdrop-blur-md sm:h-11 sm:w-11">
                      <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" aria-hidden />
                    </div>
                    <div className="mt-auto">
                      <h3 className="text-lg font-bold leading-tight text-white sm:text-xl">{card.title}</h3>
                      <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-white/85">{card.description}</p>
                      {card.price ? (
                        <p className="mt-2 text-base font-bold text-white">
                          From <span className="text-brand-300">{card.price}</span>
                        </p>
                      ) : (
                        <p className="mt-2 text-sm font-semibold text-white/70">Instant online quote</p>
                      )}
                      <span className="btn-premium-primary mt-3 w-full min-h-[40px] px-4 py-2.5 text-xs shadow-lg shadow-brand-900/40 transition-shadow group-hover:shadow-xl group-hover:shadow-brand-600/40 sm:min-h-[42px] sm:text-sm">
                        {card.buttonText}
                        <span aria-hidden>→</span>
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
