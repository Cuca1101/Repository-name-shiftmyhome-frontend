import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { SEO_SITE_ORIGIN } from '../../data/seoPages'
import { useWebsiteCms } from '../../context/WebsiteCmsContext'
import { useSeoSettings } from '../../context/SeoSettingsContext'
import { mergeHomepageCmsWithSeo } from '../../lib/seoSettingsMerge'
import { DEFAULT_HOMEPAGE } from '../../lib/websiteCmsDefaults'
import { buildMovingCompanyJsonLd, buildWebSiteJsonLd } from '../../lib/schemaOrgBusiness'
import { applySiteBrandHeadTags } from '../../lib/siteBrandMeta'

const SITE_ORIGIN = SEO_SITE_ORIGIN

export const HOME_PAGE_TITLE = DEFAULT_HOMEPAGE.homepageSeoTitle
export const HOME_PAGE_DESCRIPTION = DEFAULT_HOMEPAGE.homepageSeoDescription

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

/**
 * Homepage-only document head: title, meta, canonical, OG/Twitter, JSON-LD.
 * Does not render visible UI — no homepage layout changes.
 */
export default function HomePageSeo() {
  const { pathname } = useLocation()
  const { homepage } = useWebsiteCms()
  const { getForSlug } = useSeoSettings()
  const isHome = pathname === '/'

  const mergedHome = mergeHomepageCmsWithSeo(homepage, getForSlug('home'))
  const pageTitle =
    String(mergedHome.homepageSeoTitle || '').trim() || HOME_PAGE_TITLE
  const pageDescription =
    String(mergedHome.homepageSeoDescription || '').trim() || HOME_PAGE_DESCRIPTION
  const ogTitle = String(mergedHome.seoOgTitle || pageTitle).trim()
  const ogDescription = String(mergedHome.seoOgDescription || pageDescription).trim()
  const canonical = String(mergedHome.seoCanonicalUrl || `${SITE_ORIGIN}/`).trim()

  useEffect(() => {
    if (!isHome) return undefined

    applySiteBrandHeadTags()

    const prevTitle = document.title
    document.title = pageTitle

    const metas = [
      setMeta('name', 'description', pageDescription),
      setMeta('property', 'og:title', ogTitle),
      setMeta('property', 'og:description', ogDescription),
      setMeta('property', 'og:url', canonical),
      setMeta('property', 'og:type', 'website'),
      setMeta('name', 'twitter:card', 'summary_large_image'),
      setMeta('name', 'twitter:title', ogTitle),
      setMeta('name', 'twitter:description', ogDescription),
    ]

    const canonicalLink = setLink('canonical', canonical)

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
    const organizationLd = buildMovingCompanyJsonLd(SITE_ORIGIN, { description: pageDescription })
    const websiteLd = buildWebSiteJsonLd(SITE_ORIGIN, pageDescription)
    script.textContent = JSON.stringify([organizationLd, websiteLd])

    return () => {
      document.title = prevTitle
      metas.forEach(({ el, prev, created }) => {
        if (created && el.parentNode) el.parentNode.removeChild(el)
        else if (prev != null) el.setAttribute('content', prev)
      })
      if (canonicalLink.created && canonicalLink.el.parentNode) canonicalLink.el.parentNode.removeChild(canonicalLink.el)
      else if (canonicalLink.prev != null) canonicalLink.el.setAttribute('href', canonicalLink.prev)
      if (!hadScript && script?.parentNode) script.parentNode.removeChild(script)
      else if (hadScript) script.textContent = prevJson
    }
  }, [isHome, pageTitle, pageDescription, ogTitle, ogDescription, canonical])

  return null
}
