import { SEO_SITE_ORIGIN } from '../data/seoPages'
import { applySiteBrandHeadTags } from './siteBrandMeta'

/** @param {string} attr @param {string} key @param {string} content */
export function setMeta(attr, key, content) {
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

/** @param {string} rel @param {string} href */
export function setLink(rel, href) {
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

/** @param {string} [imageUrl] */
export function resolveAbsoluteSeoImage(imageUrl) {
  const raw = String(imageUrl || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  const path = raw.startsWith('/') ? raw : `/${raw}`
  return `${SEO_SITE_ORIGIN}${path}`
}

/**
 * @param {{
 *   title: string,
 *   description: string,
 *   path: string,
 *   ogTitle?: string,
 *   ogDescription?: string,
 *   ogImage?: string,
 *   ogType?: string,
 *   includeSocial?: boolean,
 *   robots?: string,
 * }} options
 */
export function applySeoHeadTags(options) {
  const {
    title,
    description,
    path,
    ogTitle = title,
    ogDescription = description,
    ogImage = '',
    ogType = 'website',
    includeSocial = false,
    robots = '',
  } = options

  const canonicalHref = `${SEO_SITE_ORIGIN}${path}`
  const absoluteImage = resolveAbsoluteSeoImage(ogImage)

  applySiteBrandHeadTags()

  document.title = title

  const metas = [setMeta('name', 'description', description)]
  if (robots) metas.push(setMeta('name', 'robots', robots))
  const links = [setLink('canonical', canonicalHref)]

  if (includeSocial) {
    metas.push(
      setMeta('property', 'og:title', ogTitle),
      setMeta('property', 'og:description', ogDescription),
      setMeta('property', 'og:url', canonicalHref),
      setMeta('property', 'og:type', ogType),
      setMeta('name', 'twitter:card', absoluteImage ? 'summary_large_image' : 'summary'),
      setMeta('name', 'twitter:title', ogTitle),
      setMeta('name', 'twitter:description', ogDescription),
    )
    if (absoluteImage) {
      metas.push(setMeta('property', 'og:image', absoluteImage))
    }
  }

  return { metas, links }
}

/** @param {{ el: Element, prev: string|null, created: boolean }[]} entries */
export function restoreSeoHeadTags(prevTitle, entries) {
  document.title = prevTitle
  entries.forEach(({ el, prev, created }) => {
    if (created && el.parentNode) el.parentNode.removeChild(el)
    else if (prev != null) {
      if (el.tagName === 'LINK') el.setAttribute('href', prev)
      else el.setAttribute('content', prev)
    }
  })
}
