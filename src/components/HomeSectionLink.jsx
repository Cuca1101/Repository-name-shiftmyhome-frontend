import { useLocation, useNavigate } from 'react-router-dom'

/**
 * In-app anchor for homepage sections. Smooth-scrolls when already on `/`,
 * otherwise navigates to `/#sectionId` so HomeHashScroll can run after mount.
 *
 * @param {{ sectionId: string, children: import('react').ReactNode, className?: string, onNavigate?: () => void }} props
 */
export default function HomeSectionLink({ sectionId, children, className, onNavigate }) {
  const navigate = useNavigate()
  const location = useLocation()

  function scrollToSection() {
    const matches = document.querySelectorAll(`#${CSS.escape(sectionId)}`)
    const el =
      matches.length > 0
        ? Array.from(matches).find((node) => {
            const rect = node.getBoundingClientRect()
            return rect.width > 0 && rect.height > 0
          }) ?? matches[0]
        : null
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
