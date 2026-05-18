import { Link } from 'react-router-dom'
import { HouseIcon, iconBySlug } from '../serviceIcons'
import { useWebsiteCms } from '../../context/WebsiteCmsContext'
import { DEFAULT_HOMEPAGE } from '../../lib/websiteCmsDefaults'
import { useServiceGridCards } from '../../hooks/useServiceGridCards'
import { markNewQuoteFromServiceCard } from '../../lib/quoteSessionMode'
import { trackWebsiteLeadEvent } from '../../lib/websiteLeadTracker'

function onServiceCardClick(card) {
  markNewQuoteFromServiceCard(card.serviceType || '', card.path)
  trackWebsiteLeadEvent('new_quote_from_service', {
    serviceType: card.serviceType,
    returnPath: card.path,
  })
}

/** Desktop service cards — grid (md+). */
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
            const ctaLabel = card.buttonText?.trim() || 'Get a Quote'
            return (
              <li key={card.key} className="flex min-w-0">
                <Link
                  to={card.path}
                  onClick={() => onServiceCardClick(card)}
                  className="group service-card-shell relative h-[300px] sm:h-[320px] lg:h-[340px]"
                >
                  <img
                    src={card.imageSrc}
                    alt={card.title}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 ease-premium group-hover:scale-[1.05]"
                  />
                  <div className="service-card-media-overlay pointer-events-none absolute inset-0" aria-hidden />
                  <div className="relative z-10 flex h-full w-full flex-col p-4 sm:p-5">
                    <div className="service-card-icon-badge h-10 w-10 sm:h-11 sm:w-11">
                      <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" aria-hidden />
                    </div>
                    <div className="mt-auto space-y-2">
                      <div>
                        <h3 className="text-lg font-bold leading-tight text-white sm:text-xl">{card.title}</h3>
                        <p className="mt-1 line-clamp-2 text-sm leading-snug text-white/88">{card.description}</p>
                        {card.price ? (
                          <p className="mt-1.5 text-sm font-semibold text-sky-200">
                            From <span className="font-bold text-white">{card.price}</span>
                          </p>
                        ) : (
                          <p className="mt-1.5 text-sm font-medium text-white/75">Instant online quote</p>
                        )}
                      </div>
                      <span className="service-card-cta min-h-[42px] text-xs sm:min-h-[44px] sm:text-sm">
                        {ctaLabel}
                        <span className="opacity-90" aria-hidden>
                          →
                        </span>
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
