import { CONTACT, WHATSAPP_ME_URL } from '../config'
import { SERVICE_PAGES } from '../constants/servicePages'
import { HOME_SERVICE_CARD_IMAGES } from '../constants/homeServiceCardImages'

/** @typedef {'christmas'|'blue'|'green'|'warning'} AnnouncementStyle */

export const DEFAULT_HOMEPAGE = {
  homepageSeoTitle: 'ShiftMyHome | House Removals, Man With Van & Moving Services Scotland',
  homepageSeoDescription:
    'ShiftMyHome — Professional removals, house moves, office relocations, and man with van across the UK.',
  heroTitlePart1: 'Moving made',
  heroTitleHighlight1: 'simple.',
  heroTitlePart2: 'Stress-free',
  heroTitleHighlight2: 'from start to finish.',
  heroSubtitle: 'Professional movers. Reliable service. Get your instant quote in minutes.',
  heroImageUrl:
    'https://images.unsplash.com/photo-1600585152915-d208bec867a1?auto=format&fit=crop&w=1800&h=1200&q=85',
  ctaPrimaryText: 'Get an Instant Quote',
  ctaSecondaryText: 'How it works',
  trustpilotText: 'Excellent 4.8 out of 5 Trustpilot',
  servicesHeading: 'Our removal services',
  servicesSubheading: 'Choose a service and get an instant quote in minutes.',
  galleryHeading: 'Recent moves across Scotland',
  gallerySubheading:
    'Real completed jobs from our crews — house moves, office relocations, and furniture deliveries.',
}

export const DEFAULT_ABOUT = {
  heading: 'About ShiftMyHome',
  paragraph1:
    'ShiftMyHome is a UK removals and transport platform helping customers book reliable moves with professional drivers, transparent pricing, and simple online quotes.',
  paragraph2:
    'From house removals and man with van jobs to office relocations and clearances, Shift My Home connects you with experienced movers across Scotland — a trusted removals platform that keeps you informed from quote to completion.',
  imageUrl: '/assets/about/about.png',
  trustCards: [
    {
      title: 'Fully insured moves',
      description: 'Goods-in-transit cover and careful handling on every job.',
    },
    {
      title: 'Professional drivers',
      description: 'Experienced crews who communicate clearly on move day.',
    },
    {
      title: 'Transparent pricing',
      description: 'Upfront online quotes — no hidden fees when scope is agreed.',
    },
  ],
}

export const DEFAULT_COVERAGE = {
  heading: 'Coverage across Scotland & the UK',
  subheading: 'Regular routes from Glasgow — get a quote for your postcode.',
  bodyText: '',
  seoText: '',
  imageUrl: '',
  cities: ['Glasgow', 'Edinburgh', 'Stirling', 'Aberdeen', 'Manchester', 'London'],
}

export const DEFAULT_NAVBAR = {
  ctaText: 'Get an Instant Quote',
  phoneDisplay: CONTACT.phoneDisplay,
  phoneTel: CONTACT.phoneTel,
  logoUrl: '/logo.png',
}

export const DEFAULT_FOOTER = {
  phoneDisplay: CONTACT.phoneDisplay,
  phoneTel: CONTACT.phoneTel,
  email: CONTACT.email,
  ctaText: 'Get Free Quote',
  tagline:
    'ShiftMyHome — house removals, man with van and moving services across Scotland.',
  logoUrl: '/logo-footer.png',
  socialLinks: {
    whatsapp: WHATSAPP_ME_URL,
    facebook: '',
    instagram: '',
  },
}

export const DEFAULT_ANNOUNCEMENT = {
  enabled: false,
  messageText: '',
  buttonText: '',
  buttonLink: '',
  startDate: '',
  endDate: '',
  backgroundStyle: 'blue',
  showCloseButton: true,
}

const CARD_TITLES = { 'office-moves': 'Office Move' }
const CARD_DESCRIPTIONS = {
  'house-removals': 'Full or partial moves of any size.',
  'man-with-van': 'Van & crew for smaller loads and quick jobs.',
  'furniture-delivery': 'Bulky furniture moved safely with care.',
  'office-moves': 'Office relocations planned around your business.',
  'student-moves': 'Student & flat moves across Glasgow & beyond.',
  clearance: 'Clearances with upfront pricing & disposal.',
}

/** Default service cards from existing constants (fallback when CMS empty). */
export function getDefaultServiceCards() {
  return SERVICE_PAGES.map((s, i) => ({
    id: `default-${s.slug}`,
    slug: s.slug,
    title: CARD_TITLES[s.slug] ?? s.title,
    description: CARD_DESCRIPTIONS[s.slug] ?? s.heroTeaser,
    starting_price: null,
    image_url: HOME_SERVICE_CARD_IMAGES[s.slug] ?? s.heroImage,
    route_path: s.path,
    button_text: 'Get a Quote',
    sort_order: i,
    is_active: true,
  }))
}

export const DEFAULT_REVIEWS = [
  {
    id: 'default-1',
    author_name: 'James',
    body: 'Brilliant service from start to finish. Arrived on time, nothing scratched, and the price matched the quote.',
    stars: 5,
    avatar_url: null,
    sort_order: 0,
    is_active: true,
  },
  {
    id: 'default-2',
    author_name: 'Sarah',
    body: 'Needed a sofa and beds moved at short notice. ShiftMyHome sorted same-week slots and were really careful.',
    stars: 5,
    avatar_url: null,
    sort_order: 1,
    is_active: true,
  },
  {
    id: 'default-3',
    author_name: 'David',
    body: 'Clear communication on WhatsApp, fair price for a full flat move. Crew were friendly and worked fast.',
    stars: 5,
    avatar_url: null,
    sort_order: 2,
    is_active: true,
  },
]

export function mergeSection(defaults, saved) {
  if (!saved || typeof saved !== 'object') return { ...defaults }
  return { ...defaults, ...saved }
}
