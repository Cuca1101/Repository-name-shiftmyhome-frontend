import { useLocation, useNavigate } from 'react-router-dom'

/**
 * In-app anchor for homepage sections. Smooth-scrolls when already on `/`,
 * otherwise navigates to `/#sectionId` so the hash scroll effect can run.
 *
 * @param {{ sectionId: string, children: import('react').ReactNode, className?: string, onNavigate?: () => void }} props
 */
export default function HomeSectionLink({ sectionId, children, className, onNavigate }) {
  const navigate = useNavigate()
  const location = useLocation()

  function scrollToSection() {
    const el = document.getElementById(sectionId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.history.replaceState(null, '', `#${sectionId}`)
  }

  function handleClick(e) {
    e.preventDefault()
    onNavigate?.()

    if (location.pathname !== '/') {
      navigate({ pathname: '/', hash: `#${sectionId}` })
      return
    }
    scrollToSection()
  }

  return (
    <a href={`/#${sectionId}`} onClick={handleClick} className={className}>
      {children}
    </a>
  )
}
