import { Link } from 'react-router-dom'
import { HouseIcon, iconBySlug } from '../serviceIcons'
import { useWebsiteCms } from '../../context/WebsiteCmsContext'
import { DEFAULT_HOMEPAGE } from '../../lib/websiteCmsDefaults'
import { useServiceGridCards } from '../../hooks/useServiceGridCards'

/** Mobile service cards — 2-column grid (&lt; md). */
export default function MobileServiceGrid() {
  const { homepage } = useWebsiteCms()
  const h = homepage ?? DEFAULT_HOMEPAGE
  const cards = useServiceGridCards()

  return (
    <section id="services" className="scroll-mt-[60px] bg-white pb-3 pt-0">
      <div className="home-container min-w-0 px-4">
        <div className="mb-2.5 min-w-0">
          <h2 className="text-lg font-extrabold tracking-tight text-navy">{h.servicesHeading}</h2>
          <p className="mt-0.5 text-xs leading-snug text-slate-600">{h.servicesSubheading}</p>
        </div>

        <ul className="grid grid-cols-2 gap-2.5">
          {cards.map((card) => {
            const Icon = iconBySlug[card.slug] ?? HouseIcon
            return (
              <li key={card.key} className="flex min-w-0">
                <Link
                  to={card.path}
                  className="group flex h-full w-full min-w-0 flex-col overflow-hidden rounded-xl shadow-card ring-1 ring-slate-900/10"
                >
                  <div className="relative aspect-[4/5] w-full min-h-[128px]">
                    <img
                      src={card.imageSrc}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div
                      className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/55 to-transparent"
                      aria-hidden
                    />
                    <div className="relative flex h-full flex-col p-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/25 bg-white/15 text-white backdrop-blur-sm">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </div>
                      <div className="mt-auto min-w-0">
                        <h3 className="text-[13px] font-bold leading-tight text-white">{card.title}</h3>
                        <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-white/85">
                          {card.description}
                        </p>
                        {card.price ? (
                          <p className="mt-1 text-[11px] font-bold text-white">
                            From <span className="text-brand-300">{card.price}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <span className="flex min-h-[40px] items-center justify-center bg-brand-600 px-1 text-center text-[11px] font-bold leading-tight text-white">
                    {card.buttonText}
                    <span className="ml-0.5 shrink-0" aria-hidden>
                      →
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
