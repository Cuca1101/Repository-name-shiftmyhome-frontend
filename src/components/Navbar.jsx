import { useState } from 'react'
import Logo from './Logo'
import HomeSectionLink from './HomeSectionLink'
import { WHATSAPP_URL } from '../config'

const navItems = [
  { sectionId: 'home', label: 'Home' },
  { sectionId: 'services', label: 'Services' },
  { sectionId: 'pricing', label: 'Pricing' },
  { sectionId: 'coverage', label: 'Coverage' },
  { sectionId: 'why-us', label: 'Why us' },
  { sectionId: 'reviews', label: 'Reviews' },
  { sectionId: 'contact', label: 'Contact' },
]

const navLinkClass = 'text-sm font-medium text-slate-600 transition-colors hover:text-brand-700'

export default function Navbar() {
  const [open, setOpen] = useState(false)

  const closeMenu = () => setOpen(false)

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <nav className="mx-auto flex w-full min-w-0 max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6 lg:px-8">
        <HomeSectionLink
          sectionId="home"
          className="mr-3 inline-flex shrink-0 items-center rounded-lg outline-none ring-brand-600 focus-visible:ring-2 lg:mr-4"
          onNavigate={closeMenu}
        >
          <Logo />
        </HomeSectionLink>

        <div className="hidden min-w-0 items-center gap-4 xl:flex xl:gap-5">
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

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">
          <HomeSectionLink
            sectionId="quote"
            className="hidden min-h-[44px] items-center justify-center rounded-full bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 sm:inline-flex sm:px-4"
            onNavigate={closeMenu}
          >
            Free quote
          </HomeSectionLink>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden min-h-[44px] items-center justify-center rounded-full bg-[#25D366] px-3 py-2.5 text-sm font-semibold text-white shadow-md ring-1 ring-[#1fa855]/30 transition-all hover:bg-[#20bd5a] hover:shadow-lg md:inline-flex md:px-4"
          >
            WhatsApp
          </a>

          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-slate-600 xl:hidden"
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
        <div className="border-t border-slate-100 bg-white px-4 py-4 xl:hidden">
          <div className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto">
            {navItems.map((item) => (
              <HomeSectionLink
                key={item.sectionId}
                sectionId={item.sectionId}
                className="rounded-lg py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50"
                onNavigate={closeMenu}
              >
                {item.label}
              </HomeSectionLink>
            ))}
            <HomeSectionLink
              sectionId="quote"
              className="mt-2 inline-flex min-h-[48px] items-center justify-center rounded-full bg-brand-600 px-4 py-3 text-center text-sm font-semibold text-white"
              onNavigate={closeMenu}
            >
              Free quote
            </HomeSectionLink>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#25D366] px-4 py-3 text-center text-sm font-semibold text-white shadow-md"
              onClick={closeMenu}
            >
              WhatsApp
            </a>
          </div>
        </div>
      )}
    </header>
  )
}
