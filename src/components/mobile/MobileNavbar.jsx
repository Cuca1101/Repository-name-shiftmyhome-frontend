import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Logo from '../Logo'
import HomeSectionLink from '../HomeSectionLink'
import { CONTACT } from '../../config'
import { useWebsiteCms } from '../../context/WebsiteCmsContext'

const navItems = [
  { sectionId: 'home', label: 'Home' },
  { sectionId: 'services', label: 'Services' },
  { sectionId: 'how-it-works', label: 'How it works' },
  { sectionId: 'about', label: 'About' },
  { sectionId: 'reviews', label: 'Reviews' },
  { sectionId: 'coverage', label: 'Coverage' },
  { sectionId: 'contact', label: 'Contact' },
]

/** Compact mobile/tablet navbar (&lt; lg) — logo, phone icon, hamburger only; CTA in drawer. */
export default function MobileNavbar() {
  const { navbar } = useWebsiteCms()
  const phoneTel = navbar.phoneTel || CONTACT.phoneTel
  const ctaText = navbar.ctaText || 'Get a Quote'
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  const closeMenu = () => setOpen(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <header className="sticky top-0 z-50 w-full max-w-full overflow-x-hidden bg-navy shadow-nav">
      <nav className="flex min-h-[56px] min-w-0 max-w-full items-center justify-between gap-2 px-3">
        <HomeSectionLink
          sectionId="home"
          className="nav-logo-slab relative z-10 -ml-1 flex min-w-0 max-w-[min(58vw,12.5rem)] shrink items-center overflow-hidden bg-white py-1.5 pl-2 pr-4"
          onNavigate={closeMenu}
        >
          <Logo asImage className="max-w-full" src={navbar.logoUrl || undefined} />
        </HomeSectionLink>

        <div className="flex shrink-0 items-center gap-1.5">
          <a
            href={`tel:${phoneTel}`}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/15"
            aria-label="Call us"
          >
            <svg className="h-4 w-4 text-brand-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
              />
            </svg>
          </a>
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
            aria-expanded={open}
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {open ? (
        <div className="border-t border-white/10 bg-navy-800">
          <div className="flex max-h-[min(70vh,420px)] flex-col gap-0.5 overflow-y-auto px-3 py-2">
            {navItems.map((item) => (
              <HomeSectionLink
                key={item.sectionId}
                sectionId={item.sectionId}
                className="rounded-lg px-2 py-3 text-[15px] font-medium text-white/90 active:bg-white/10"
                onNavigate={closeMenu}
              >
                {item.label}
              </HomeSectionLink>
            ))}
            <HomeSectionLink
              sectionId="services"
              className="btn-premium-primary mt-2 min-h-[48px] w-full text-sm"
              onNavigate={closeMenu}
            >
              {ctaText}
            </HomeSectionLink>
          </div>
        </div>
      ) : null}
    </header>
  )
}
