import { useState } from 'react'
import Logo from './Logo'
import HomeSectionLink from './HomeSectionLink'
import { CONTACT } from '../config'

const navItems = [
  { sectionId: 'home', label: 'Home' },
  { sectionId: 'services', label: 'Services' },
  { sectionId: 'how-it-works', label: 'How it works' },
  { sectionId: 'why-us', label: 'About us' },
  { sectionId: 'reviews', label: 'Reviews' },
  { sectionId: 'contact', label: 'Contact' },
]

const navLinkClass =
  'text-sm font-medium text-white/90 transition-colors hover:text-white border-b-2 border-transparent pb-0.5 hover:border-brand-400'

export default function Navbar() {
  const [open, setOpen] = useState(false)

  const closeMenu = () => setOpen(false)

  return (
    <header className="sticky top-0 z-50 bg-navy shadow-lg shadow-navy/30">
      <nav className="mx-auto flex w-full min-w-0 max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-6 lg:px-8">
        <HomeSectionLink
          sectionId="home"
          className="inline-flex shrink-0 items-center rounded-lg bg-white px-2 py-1.5 outline-none ring-brand-400 focus-visible:ring-2 sm:px-3 sm:py-2"
          onNavigate={closeMenu}
        >
          <Logo asImage className="[&_img]:h-8 sm:[&_img]:h-9" />
        </HomeSectionLink>

        <div className="hidden min-w-0 flex-1 items-center justify-center gap-5 lg:flex xl:gap-7">
          {navItems.map((item) => (
            <HomeSectionLink
              key={item.sectionId}
              sectionId={item.sectionId}
              className={navLinkClass}
              onNavigate={closeMenu}
            >
              {item.label}
            </HomeSectionLink>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <a
            href={`tel:${CONTACT.phoneTel}`}
            className="hidden items-center gap-2 text-sm font-medium text-white/95 transition hover:text-white md:inline-flex"
          >
            <svg className="h-4 w-4 shrink-0 text-brand-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
            </svg>
            {CONTACT.phoneDisplay}
          </a>
          <HomeSectionLink
            sectionId="quote"
            className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-600/30 transition hover:from-brand-700 hover:to-brand-600 sm:min-h-[44px] sm:px-5"
            onNavigate={closeMenu}
          >
            Get a Quote
          </HomeSectionLink>

          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-white lg:hidden"
            aria-expanded={open}
            aria-label="Toggle menu"
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

      {open && (
        <div className="border-t border-white/10 bg-navy-800 px-4 py-4 lg:hidden">
          <div className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto">
            {navItems.map((item) => (
              <HomeSectionLink
                key={item.sectionId}
                sectionId={item.sectionId}
                className="rounded-lg py-2.5 text-base font-medium text-white/95 hover:bg-white/5"
                onNavigate={closeMenu}
              >
                {item.label}
              </HomeSectionLink>
            ))}
            <a
              href={`tel:${CONTACT.phoneTel}`}
              className="mt-2 inline-flex min-h-[48px] items-center gap-2 rounded-lg px-2 text-base font-medium text-white"
            >
              <svg className="h-5 w-5 text-brand-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
              {CONTACT.phoneDisplay}
            </a>
            <HomeSectionLink
              sectionId="quote"
              className="mt-2 inline-flex min-h-[48px] items-center justify-center rounded-full bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-3 text-center text-sm font-semibold text-white"
              onNavigate={closeMenu}
            >
              Get a Quote
            </HomeSectionLink>
          </div>
        </div>
      )}
    </header>
  )
}
