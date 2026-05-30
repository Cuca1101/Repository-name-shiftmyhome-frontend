import { useEffect } from 'react'
import { applySeoHeadTags, restoreSeoHeadTags } from '../../lib/seoHeadTags'

/**
 * Sets document title, meta description, canonical, and optional OG/Twitter tags.
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
}) {
  useEffect(() => {
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
