import { useEffect } from 'react'
import { SEO_SITE_ORIGIN } from '../../data/seoPages'

/**
 * Sets document title, meta description, and canonical link for SEO landing pages.
 * @param {{ title: string, description: string, path: string }} props
 */
export default function SeoHead({ title, description, path }) {
  useEffect(() => {
    const prevTitle = document.title
    document.title = title

    let meta = document.querySelector('meta[name="description"]')
    const hadMeta = Boolean(meta)
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    const prevDescription = meta.getAttribute('content')
    meta.setAttribute('content', description)

    const canonicalHref = `${SEO_SITE_ORIGIN}${path}`
    let link = document.querySelector('link[rel="canonical"]')
    const hadCanonical = Boolean(link)
    if (!link) {
      link = document.createElement('link')
      link.setAttribute('rel', 'canonical')
      document.head.appendChild(link)
    }
    const prevCanonical = link.getAttribute('href')
    link.setAttribute('href', canonicalHref)

    return () => {
      document.title = prevTitle
      if (hadMeta && prevDescription != null) meta.setAttribute('content', prevDescription)
      else if (meta?.parentNode) meta.parentNode.removeChild(meta)
      if (hadCanonical && prevCanonical != null) link.setAttribute('href', prevCanonical)
      else if (link?.parentNode) link.parentNode.removeChild(link)
    }
  }, [title, description, path])

  return null
}
