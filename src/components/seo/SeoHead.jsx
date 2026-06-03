import { useLayoutEffect } from 'react'
import {
  applySeoHeadTags,
  applySeoLandingPageJsonLd,
  restoreSeoHeadTags,
  restoreSeoLandingPageJsonLd,
} from '../../lib/seoHeadTags'

/**
 * Sets document title, meta description, canonical, optional OG/Twitter tags,
 * and SEO landing JSON-LD (FAQ, breadcrumb, local business) in head only.
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
 *   faqs?: { q: string, a: string }[],
 *   breadcrumbItems?: { name: string, path: string }[],
 *   localBusiness?: { path: string, pageTitle: string, description: string },
 * }} props
 */
export default function SeoHead({
  title,
  description,
  path,
  ogTitle,
  ogDescription,
  ogImage,
  ogType = 'website',
  includeSocial = false,
  robots = '',
  faqs,
  breadcrumbItems,
  localBusiness,
}) {
  const landingJsonLdKey = [
    Array.isArray(faqs) ? JSON.stringify(faqs) : '',
    breadcrumbItems ? JSON.stringify(breadcrumbItems) : '',
    localBusiness ? JSON.stringify(localBusiness) : '',
  ].join('|')

  const hasLandingJsonLd =
    Array.isArray(faqs) || (Array.isArray(breadcrumbItems) && breadcrumbItems.length >= 2) || localBusiness

  const landingJsonLdOptions = hasLandingJsonLd
    ? {
        path,
        faqs: Array.isArray(faqs) ? faqs : undefined,
        breadcrumbItems,
        localBusiness,
      }
    : null

  // Run before paint so crawlers/testing tools see a single FAQPage (Google: one per page).
  useLayoutEffect(() => {
    if (!landingJsonLdOptions) return undefined
    applySeoLandingPageJsonLd(landingJsonLdOptions)
    return () => restoreSeoLandingPageJsonLd(true)
  }, [landingJsonLdKey, path, hasLandingJsonLd])

  useLayoutEffect(() => {
    const prevTitle = document.title
    const { metas, links } = applySeoHeadTags({
      title,
      description,
      path,
      ogTitle,
      ogDescription,
      ogImage,
      ogType,
      includeSocial,
      robots,
    })

    return () => {
      restoreSeoHeadTags(prevTitle, [...metas, ...links])
    }
  }, [title, description, path, ogTitle, ogDescription, ogImage, ogType, includeSocial, robots])

  return null
}
