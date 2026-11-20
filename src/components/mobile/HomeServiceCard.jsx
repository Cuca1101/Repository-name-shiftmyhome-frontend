import { Link, useLocation } from 'react-router-dom'
import { startFreshPublicQuote } from '../../lib/quoteSessionMode'
import { useSeoQuoteModal } from '../../context/SeoQuoteModalContext'
import { trackWebsiteClick, trackWebsiteLeadEvent } from '../../lib/websiteLeadTracker'

function OutlineIcon({ className, children }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

function HouseIcon({ className }) {
  return (
    <OutlineIcon className={className}>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </OutlineIcon>
  )
}

function VanIcon({ className }) {
  return (
    <OutlineIcon className={className}>
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </OutlineIcon>
  )
}

function SofaIcon({ className }) {
  return (
    <OutlineIcon className={className}>
      <path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3" />
      <path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0Z" />
      <path d="M4 18v2" />
      <path d="M20 18v2" />
    </OutlineIcon>
  )
}

function OfficeIcon({ className }) {
  return (
    <OutlineIcon className={className}>
      <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
      <path d="M3 21h18" />
      <path d="M10.5 21v-2.5a1.5 1.5 0 0 1 3 0V21" />
      <path
        fill="currentColor"
        stroke="none"
        d="M8.2 6.2h1.7v1.7H8.2zM11.15 6.2h1.7v1.7h-1.7zM14.1 6.2h1.7v1.7h-1.7zM8.2 9.7h1.7v1.7H8.2zM11.15 9.7h1.7v1.7h-1.7zM14.1 9.7h1.7v1.7h-1.7zM8.2 13.2h1.7v1.7H8.2zM11.15 13.2h1.7v1.7h-1.7zM14.1 13.2h1.7v1.7h-1.7z"
      />
    </OutlineIcon>
  )
}

function StudentIcon({ className }) {
  return (
    <OutlineIcon className={className}>
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6" />
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </OutlineIcon>
  )
}

function RecycleIcon({ className }) {
  return (
    <OutlineIcon className={className}>
      <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5" />
      <path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12" />
      <path d="m14 16-3 3 3 3" />
      <path d="M8.293 13.596 7.196 9.5 3.1 10.598" />
      <path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843" />
      <path d="m13.378 9.633 4.096 1.098 1.097-4.096" />
    </OutlineIcon>
  )
}

function PinIcon({ className }) {
  return (
    <OutlineIcon className={className}>
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </OutlineIcon>
  )
}

function BoltIcon({ className }) {
  return (
    <OutlineIcon className={className}>
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </OutlineIcon>
  )
}

/** Clean homepage photos. Service-page heroes stay on their own images. */
const HOMEPAGE_CARD_PHOTOS = {
  'house-removals': '/assets/services/cards/house-removals.jpg?v=3',
  'man-with-van': '/assets/services/cards/man-with-van.jpg?v=3',
  'furniture-delivery': '/assets/services/cards/furniture-delivery.jpg?v=3',
  'office-moves': '/assets/services/cards/office-moves.jpg?v=3',
  'student-moves': '/assets/services/cards/student-moves.jpg?v=3',
  clearance: '/assets/services/cards/clearance.jpg?v=3',
  'long-distance-removals': '/assets/services/cards/long-distance-removals.jpg?v=3',
  'urgent-removals': '/assets/services/cards/urgent-removals.jpg?v=3',
}

function homepageCardPhoto(card) {
  const mapped = HOMEPAGE_CARD_PHOTOS[card.slug]
  const src = String(card.imageSrc || '')
  if (!mapped) return src
  if (!src || src.startsWith('/assets/services/')) return mapped
  return src
}

const homepageIconBySlug = {
  'house-removals': HouseIcon,
  'man-with-van': VanIcon,
  'furniture-delivery': SofaIcon,
  'office-moves': OfficeIcon,
  'student-moves': StudentIcon,
  clearance: RecycleIcon,
  'long-distance-removals': PinIcon,
  'urgent-removals': BoltIcon,
}

function onServiceCardClick(card) {
  const label = `Service card: ${card.title || card.serviceType || 'Quote'}`
  startFreshPublicQuote(card.serviceType || '', card.seoPath || card.path)
  void trackWebsiteClick(label, { href: card.path, section: 'services', serviceType: card.serviceType })
  trackWebsiteLeadEvent('new_quote_from_service', {
    serviceType: card.serviceType,
    returnPath: card.seoPath || card.path,
  })
}

/** Homepage service card: photo on top, details in a white panel. */
export default function HomeServiceCard({ card }) {
  const { pathname } = useLocation()
  const { openQuote, hasModal } = useSeoQuoteModal()
  const Icon = homepageIconBySlug[card.slug] ?? HouseIcon
  const ctaLabel = card.buttonText?.trim() || 'Get a Quote'

  return (
    <Link
      to={hasModal ? { pathname, hash: '#seo-quote' } : card.path}
      onClick={(e) => {
        onServiceCardClick(card)
        if (hasModal) {
          e.preventDefault()
          openQuote(card.serviceType || undefined)
        }
      }}
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="aspect-video w-full overflow-hidden bg-slate-100">
        <img
          src={homepageCardPhoto(card)}
          alt={`${card.title} — ShiftMyHome removals Scotland`}
          title={`${card.title} | ShiftMyHome`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-center"
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3.5">
        <h3 className="flex items-center gap-2 text-base font-bold leading-tight text-navy">
          <Icon className="h-5 w-5 shrink-0" aria-hidden />
          <span className="min-w-0">{card.title}</span>
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{card.description}</p>
        {card.price ? (
          <p className="mt-3 text-base font-bold text-slate-900">From {card.price}</p>
        ) : (
          <p className="mt-3 text-sm font-medium text-slate-500">Instant online quote</p>
        )}
        <div className="mt-auto pt-4">
          <span className="flex min-h-11 w-full items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white">
            {ctaLabel}
            <span aria-hidden>→</span>
          </span>
        </div>
      </div>
    </Link>
  )
}
