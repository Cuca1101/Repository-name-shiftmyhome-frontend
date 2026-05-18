import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Logo from '../Logo'
import HomeSectionLink from '../HomeSectionLink'
import CoverageLink from '../CoverageLink'
import { CONTACT } from '../../config'
import { useWebsiteCms } from '../../context/WebsiteCmsContext'

const navItems = [
  { sectionId: 'home', label: 'Home' },
  { sectionId: 'services', label: 'Services' },
  { sectionId: 'how-it-works', label: 'How it works' },
  { sectionId: 'about', label: 'About us' },
  { sectionId: 'reviews', label: 'Reviews' },
  { sectionId: 'coverage', label: 'Coverage' },
  { sectionId: 'contact', label: 'Contact' },
]

function navLinkClass(isActive) {
  const base =
    'relative px-1 py-1 text-[13px] font-medium tracking-wide text-white/85 transition-colors duration-200 hover:text-white xl:text-sm'
  if (!isActive) return base
  return `${base} text-white after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-brand-400`
}

/** Full desktop navbar (md+) — unchanged. */
export default function DesktopNavbar() {
  const { navbar } = useWebsiteCms()
  const phoneDisplay = navbar.phoneDisplay || CONTACT.phoneDisplay
  const phoneTel = navbar.phoneTel || CONTACT.phoneTel
  const ctaText = navbar.ctaText || 'Get a Quote'
  const { pathname, hash } = useLocation()
  const [activeSection, setActiveSection] = useState('home')

  useEffect(() => {
    if (pathname !== '/') {
      setActiveSection('')
      return
    }
    const fromHash = hash?.replace('#', '')
    if (fromHash) {
      setActiveSection(fromHash)
      return
    }
    setActiveSection('home')
  }, [pathname, hash])

  useEffect(() => {
    if (pathname !== '/') return undefined

    const ids = navItems.map((n) => n.sectionId)
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target?.id) {
          setActiveSection(visible[0].target.id)
        }
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: [0, 0.15, 0.4] }
    )

    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [pathname])

  const isHome = pathname === '/'

  return (
    <header className="sticky top-0 z-50 bg-navy shadow-nav">
      <nav className="home-container flex min-h-[68px] min-w-0 items-stretch justify-between gap-2 sm:min-h-[72px] lg:min-h-[76px]">
        <HomeSectionLink
          sectionId="home"
          className="nav-logo-slab relative z-10 -ml-4 flex shrink-0 items-center self-stretch bg-white py-2 pl-4 pr-8 sm:-ml-6 sm:pl-5 sm:pr-10 lg:pr-11"
        >
          <Logo asImage src={navbar.logoUrl || undefined} />
        </HomeSectionLink>

        <div className="hidden min-w-0 flex-1 items-center justify-center gap-4 md:flex xl:gap-6">
          {navItems.map((item) => {
            const linkClassName = navLinkClass(isHome && activeSection === item.sectionId)
            const label = (
              <span className="inline-flex items-center gap-0.5">
                {item.label}
                {item.sectionId === 'services' && (
                  <svg className="mt-0.5 h-3.5 w-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19 9-7 7-7-7" />
                  </svg>
                )}
              </span>
            )
            if (item.sectionId === 'coverage') {
              return (
                <CoverageLink
                  key={item.sectionId}
                  className={linkClassName}
                  onNavigate={() => setActiveSection(item.sectionId)}
                >
                  {label}
                </CoverageLink>
              )
            }
            return (
              <HomeSectionLink
                key={item.sectionId}
                sectionId={item.sectionId}
                className={linkClassName}
                onNavigate={() => setActiveSection(item.sectionId)}
              >
                {label}
              </HomeSectionLink>
            )
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <a
            href={`tel:${phoneTel}`}
            className="hidden items-center gap-2 text-sm font-medium text-white/95 transition hover:text-white md:inline-flex"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-brand-300">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
                />
              </svg>
            </span>
            <span className="whitespace-nowrap">{phoneDisplay}</span>
          </a>
          <HomeSectionLink
            sectionId="services"
            className="btn-premium-primary min-h-[40px] px-4 py-2 text-sm sm:min-h-[42px] sm:px-5"
            onNavigate={() => {}}
          >
            {ctaText}
          </HomeSectionLink>
        </div>
      </nav>
    </header>
  )
}
