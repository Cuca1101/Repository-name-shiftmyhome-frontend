import { Link } from 'react-router-dom'

export const COVERAGE_SCOTLAND_SECTION_ID = 'scotland-coverage'
export const COVERAGE_DIRECTORY_PATH = `/coverage#${COVERAGE_SCOTLAND_SECTION_ID}`

/**
 * Coverage nav — opens the coverage page at the Scotland locations directory.
 * @param {{ children: import('react').ReactNode, className?: string, onNavigate?: () => void }} props
 */
export default function CoverageLink({ children, className, onNavigate }) {
  return (
    <Link to={COVERAGE_DIRECTORY_PATH} className={className} onClick={onNavigate}>
      {children}
    </Link>
  )
}
