import { Link } from 'react-router-dom'

/**
 * Navigates to the dedicated quote page (not a homepage anchor).
 *
 * @param {{ className?: string, children: import('react').ReactNode, onClick?: () => void }} props
 */
export default function QuotePageLink({ className, children, onClick }) {
  return (
    <Link to="/quote" className={className} onClick={onClick}>
      {children}
    </Link>
  )
}
