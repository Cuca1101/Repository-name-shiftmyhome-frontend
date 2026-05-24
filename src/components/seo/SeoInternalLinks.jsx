import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { buildSeoInternalLinks, buildSeoInternalLinksFromPath } from '../../lib/seo/seoInternalLinks.js'

/**
 * @param {{ title: string, links: { href: string, label: string }[] }} props
 */
function LinkColumn({ title, links }) {
  if (!links.length) return null

  return (
    <div className="seo-internal-links__column">
      <h3 className="seo-internal-links__column-title">{title}</h3>
      <ul className="seo-internal-links__list">
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link to={href} className="seo-internal-links__link">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Contextual internal links for SEO, service, and coverage pages.
 * @param {{
 *   currentPath: string,
 *   cityName?: string,
 *   regionKey?: string,
 *   sections?: { relatedServices: object[], nearbyAreas: object[], popularGuides: object[] },
 *   className?: string,
 * }} props
 */
export default function SeoInternalLinks({ currentPath, cityName, regionKey, sections, className = '' }) {
  const data = useMemo(() => {
    if (sections) return sections
    if (cityName) {
      return buildSeoInternalLinks({ path: currentPath, cityName, regionKey })
    }
    return buildSeoInternalLinksFromPath(currentPath)
  }, [currentPath, cityName, regionKey, sections])

  if (!data) return null

  const { relatedServices, nearbyAreas, popularGuides } = data
  const hasLinks = relatedServices.length + nearbyAreas.length + popularGuides.length > 0
  if (!hasLinks) return null

  return (
    <section
      className={`seo-internal-links ${className}`.trim()}
      aria-labelledby="seo-internal-links-heading"
    >
      <div className="seo-internal-links__inner">
        <div className="seo-internal-links__header">
          <h2 id="seo-internal-links-heading" className="seo-internal-links__title">
            Helpful moving links
          </h2>
          <p className="seo-internal-links__intro">
            Related services, nearby areas, and popular guides to help you plan your move with ShiftMyHome.
          </p>
        </div>
        <div className="seo-internal-links__grid">
          <LinkColumn title="Related services" links={relatedServices} />
          <LinkColumn title="Nearby areas" links={nearbyAreas} />
          <LinkColumn title="Popular moving guides" links={popularGuides} />
        </div>
      </div>
    </section>
  )
}
