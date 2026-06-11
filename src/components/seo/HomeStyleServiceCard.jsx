import { Link } from 'react-router-dom'
import { HouseIcon, iconBySlug } from '../serviceIcons'
import { HOME_SERVICE_CARD_IMAGES } from '../../constants/homeServiceCardImages'

/**
 * Homepage-style service card (image, icon, gradient CTA) — shared by homepage grids and SEO pages.
 *
 * @param {{
 *   slug?: string,
 *   title: string,
 *   description: string,
 *   imageSrc: string,
 *   price?: string|null,
 *   buttonText?: string,
 *   href: string,
 *   onClick?: () => void,
 *   className?: string,
 *   imageAlt?: string,
 * }} props
 */
export default function HomeStyleServiceCard({
  slug = 'house-removals',
  title,
  description,
  imageSrc,
  price = null,
  buttonText = 'Get a Quote',
  href,
  onClick,
  className = '',
  imageAlt,
}) {
  const Icon = iconBySlug[slug] ?? HouseIcon
  const ctaLabel = buttonText?.trim() || 'Get a Quote'
  const isHashLink = href.startsWith('#')
  const resolvedImageAlt =
    imageAlt?.trim() || `${title} — ShiftMyHome removals and man with van Scotland`

  const shellClassName = [
    'group service-card-shell flex h-[300px] w-full flex-col sm:h-[320px] lg:h-[340px]',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <img
          src={imageSrc}
          alt={resolvedImageAlt}
          title={resolvedImageAlt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 ease-premium group-hover:scale-[1.05]"
        />
        <div
          className="service-card-media-overlay service-card-media-overlay--mobile service-card-media-overlay--desktop pointer-events-none absolute inset-0"
          aria-hidden
        />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col p-4 pb-3 sm:p-5 sm:pb-4">
          <div className="service-card-icon-badge h-10 w-10 shrink-0 sm:h-11 sm:w-11">
            <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" aria-hidden />
          </div>
          <div className="mt-3 flex min-h-[7.5rem] flex-1 flex-col justify-end gap-2 pb-1 sm:min-h-[8rem]">
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] sm:text-xl">
                {title}
              </h3>
              <p className="line-clamp-3 text-sm leading-snug text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                {description}
              </p>
              {price ? (
                <p className="text-sm font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]">
                  From <span className="font-bold text-sky-100">{price}</span>
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
    </>
  )

  if (isHashLink) {
    return (
      <a href={href} onClick={onClick} className={shellClassName}>
        {content}
      </a>
    )
  }

  return (
    <Link to={href} onClick={onClick} className={shellClassName}>
      {content}
    </Link>
  )
}

/** @param {string} heading */
export function slugForServiceHeading(heading) {
  const h = heading.toLowerCase()
  if (h.includes('man with van')) return 'man-with-van'
  if (h.includes('furniture')) return 'furniture-delivery'
  if (h.includes('office')) return 'office-moves'
  if (h.includes('student')) return 'student-moves'
  if (h.includes('clearance') || h.includes('packing')) return 'clearance'
  return 'house-removals'
}

/** @param {string} slug */
export function imageForServiceSlug(slug) {
  return HOME_SERVICE_CARD_IMAGES[slug] ?? HOME_SERVICE_CARD_IMAGES['house-removals']
}
