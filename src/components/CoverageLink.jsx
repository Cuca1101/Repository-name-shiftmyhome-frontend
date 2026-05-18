import { Link, useLocation } from 'react-router-dom'
import HomeSectionLink from './HomeSectionLink'

/**
 * Coverage nav: on homepage scrolls to #coverage; elsewhere opens /coverage map page.
 * @param {{ children: import('react').ReactNode, className?: string, onNavigate?: () => void }} props
 */
export default function CoverageLink({ children, className, onNavigate }) {
  const { pathname } = useLocation()

  if (pathname === '/') {
    return (
      <HomeSectionLink sectionId="coverage" className={className} onNavigate={onNavigate}>
        {children}
      </HomeSectionLink>
    )
  }

  return (
    <Link to="/coverage" className={className} onClick={onNavigate}>
      {children}
    </Link>
  )
}
