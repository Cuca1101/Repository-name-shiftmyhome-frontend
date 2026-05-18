import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { SEO_SITE_ORIGIN } from '../../data/seoPages'

const SITE_ORIGIN = SEO_SITE_ORIGIN

export const HOME_PAGE_TITLE =
  'ShiftMyHome | House Removals, Man With Van & Moving Services Scotland'

export const HOME_PAGE_DESCRIPTION =
  'ShiftMyHome (Shift My Home) offers house removals, man with van, removal van and moving services across Scotland. Instant online quotes for Glasgow, Edinburgh and UK-wide moves.'

const OG_TITLE = 'ShiftMyHome — Removals & Man With Van Scotland'
const OG_DESCRIPTION =
  'Trusted removals platform for house moves, man with van, and furniture delivery. Scotland-wide coverage with instant quotes from Shift My Home.'

function setMeta(attr, key, content) {
  let el = document.querySelector(`meta[${attr}="${key}"]`)
  const created = !el
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  const prev = el.getAttribute('content')
  el.setAttribute('content', content)
  return { el, prev, created }
}

function setLink(rel, href) {
  let el = document.querySelector(`link[rel="${rel}"]`)
  const created = !el
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  const prev = el.getAttribute('href')
  el.setAttribute('href', href)
  return { el, prev, created }
}

const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'MovingCompany',
  '@id': `${SITE_ORIGIN}/#organization`,
  name: 'ShiftMyHome',
  alternateName: ['Shift My Home', 'Shift My Home Removals'],
  url: SITE_ORIGIN,
  description:
    'ShiftMyHome is a trusted removals platform for house removals, man with van, furniture delivery, office moves, and student moves across Scotland and the UK.',
  areaServed: {
    '@type': 'Country',
    name: 'Scotland',
  },
  knowsAbout: [
    'House removals',
    'Man with van',
    'Furniture delivery',
    'Office moves',
    'Student moves',
    'Removal van',
    'Moving services',
  ],
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Moving services',
    itemListElement: [
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'House removals' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Man with van' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Furniture delivery' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Office moves' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Student moves' } },
    ],
  },
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+44-7466-510975',
    contactType: 'customer service',
    areaServed: 'GB',
    availableLanguage: 'English',
  },
}

const WEBSITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_ORIGIN}/#website`,
  name: 'ShiftMyHome',
  alternateName: 'Shift My Home',
  url: SITE_ORIGIN,
  description: HOME_PAGE_DESCRIPTION,
  publisher: { '@id': `${SITE_ORIGIN}/#organization` },
  inLanguage: 'en-GB',
}

/**
 * Homepage-only document head: title, meta, canonical, OG/Twitter, JSON-LD.
 * Does not render visible UI — no homepage layout changes.
 */
export default function HomePageSeo() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'

  useEffect(() => {
    if (!isHome) return undefined

    const prevTitle = document.title
    document.title = HOME_PAGE_TITLE

    const metas = [
      setMeta('name', 'description', HOME_PAGE_DESCRIPTION),
      setMeta('property', 'og:title', OG_TITLE),
      setMeta('property', 'og:description', OG_DESCRIPTION),
      setMeta('property', 'og:url', SITE_ORIGIN),
      setMeta('property', 'og:type', 'website'),
      setMeta('property', 'og:site_name', 'ShiftMyHome'),
      setMeta('name', 'twitter:card', 'summary_large_image'),
      setMeta('name', 'twitter:title', OG_TITLE),
      setMeta('name', 'twitter:description', OG_DESCRIPTION),
    ]

    const canonical = setLink('canonical', `${SITE_ORIGIN}/`)

    const scriptId = 'shiftmyhome-home-jsonld'
    let script = document.getElementById(scriptId)
    const hadScript = Boolean(script)
    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    const prevJson = script.textContent
    script.textContent = JSON.stringify([ORGANIZATION_JSON_LD, WEBSITE_JSON_LD])

    return () => {
      document.title = prevTitle
      metas.forEach(({ el, prev, created }) => {
        if (created && el.parentNode) el.parentNode.removeChild(el)
        else if (prev != null) el.setAttribute('content', prev)
      })
      if (canonical.created && canonical.el.parentNode) canonical.el.parentNode.removeChild(canonical.el)
      else if (canonical.prev != null) canonical.el.setAttribute('href', canonical.prev)
      if (!hadScript && script?.parentNode) script.parentNode.removeChild(script)
      else if (hadScript) script.textContent = prevJson
    }
  }, [isHome])

  return null
}
