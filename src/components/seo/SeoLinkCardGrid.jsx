import { Link } from 'react-router-dom'

/**
 * Grid of location / service links using the shared seo-service-card style.
 * @param {{ links: { href: string, label: string }[] }} props
 */
export default function SeoLinkCardGrid({ links }) {
  if (!links?.length) return null

  return (
    <ul className="mt-4 grid gap-2.5 sm:mt-5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
      {links.map(({ href, label }) => (
        <li key={href}>
          <Link to={href} className="seo-service-card">
            <span className="min-w-0 truncate">{label}</span>
            <span className="shrink-0 text-brand-500" aria-hidden>
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
