import { Link } from 'react-router-dom'
import { HouseIcon, iconBySlug } from '../serviceIcons'
import { useWebsiteCms } from '../../context/WebsiteCmsContext'
import { DEFAULT_HOMEPAGE } from '../../lib/websiteCmsDefaults'
import { useServiceGridCards } from '../../hooks/useServiceGridCards'
import { markNewQuoteFromServiceCard } from '../../lib/quoteSessionMode'
import { trackWebsiteClick, trackWebsiteLeadEvent } from '../../lib/websiteLeadTracker'

function onServiceCardClick(card) {
  const label = `Service card: ${card.title || card.serviceType || 'Quote'}`
  markNewQuoteFromServiceCard(card.serviceType || '', card.path)
  void trackWebsiteClick(label, { href: card.path, section: 'services', serviceType: card.serviceType })
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
                  className="group service-card-shell flex h-[300px] flex-col sm:h-[320px] lg:h-[340px]"
                >
                  <div className="relative flex min-h-0 flex-1 flex-col">
                    <img
                      src={card.imageSrc}
                      alt={card.title}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 ease-premium group-hover:scale-[1.05]"
                    />
                    <div
                      className="service-card-media-overlay service-card-media-overlay--desktop pointer-events-none absolute inset-0"
                      aria-hidden
                    />
                    <div className="relative z-10 flex min-h-0 flex-1 flex-col p-4 pb-3 sm:p-5 sm:pb-4">
                      <div className="service-card-icon-badge h-10 w-10 shrink-0 sm:h-11 sm:w-11">
                        <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" aria-hidden />
                      </div>
                      <div className="mt-3 flex min-h-[7.5rem] flex-1 flex-col justify-end gap-2 pb-1 sm:min-h-[8rem]">
                        <div className="space-y-1.5">
                          <h3 className="text-lg font-bold leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] sm:text-xl">
                            {card.title}
                          </h3>
                          <p className="line-clamp-3 text-sm leading-snug text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                            {card.description}
                          </p>
                          {card.price ? (
                            <p className="text-sm font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]">
                              From <span className="font-bold text-sky-100">{card.price}</span>
                            </p>
                          ) : (
                            <p className="text-sm font-medium text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
                              Instant online quote
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 p-3 pt-0 sm:p-4 sm:pt-0">
                    <span className="service-card-cta min-h-[42px] text-xs sm:min-h-[44px] sm:text-sm">
                      {ctaLabel}
                      <span className="opacity-90" aria-hidden>
                        →
                      </span>
                    </span>
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
