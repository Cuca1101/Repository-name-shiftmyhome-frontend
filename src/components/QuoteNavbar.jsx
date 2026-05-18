import { Link } from 'react-router-dom'
import Logo from './Logo'
import MobileNavbar from './mobile/MobileNavbar'
import { CONTACT } from '../config'
import { useWebsiteCms } from '../context/WebsiteCmsContext'

/** Desktop quote header (md+) — unchanged from original QuoteNavbar. */
function DesktopQuoteNavbar() {
  const { navbar } = useWebsiteCms()
  const phoneDisplay = navbar.phoneDisplay || CONTACT.phoneDisplay
  const phoneTel = navbar.phoneTel || CONTACT.phoneTel

  return (
    <header className="sticky top-0 z-50 bg-navy shadow-nav">
      <nav className="home-container flex min-h-[56px] min-w-0 items-center justify-between gap-2 sm:min-h-[60px] sm:gap-4">
        <Link
          to="/"
          className="nav-logo-slab relative z-10 -ml-3 flex shrink-0 items-center self-stretch bg-white py-1.5 pl-3 pr-6 sm:-ml-4 sm:pl-4 sm:pr-8"
        >
          <Logo asImage src={navbar.logoUrl || undefined} />
        </Link>

        <span className="hidden min-w-0 truncate text-xs font-medium tracking-wide text-white/75 sm:inline sm:text-[13px]">
          Secure quote
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
          <Link
            to="/#services"
            className="hidden min-h-[40px] items-center text-xs font-semibold text-white/90 transition hover:text-white sm:inline-flex sm:text-sm"
          >
            <span aria-hidden className="mr-1">
              ←
            </span>
            Back to services
          </Link>
          <a
            href={`tel:${phoneTel}`}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15 sm:px-3 sm:text-sm"
          >
            <svg className="h-4 w-4 shrink-0 text-brand-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
              />
            </svg>
            <span className="whitespace-nowrap">{phoneDisplay}</span>
          </a>
        </div>
      </nav>
    </header>
  )
}

/**
 * Service quote pages — mobile matches homepage MobileNavbar; desktop header unchanged.
 */
export default function QuoteNavbar() {
  return (
    <>
      <div className="block lg:hidden">
        <MobileNavbar />
      </div>
      <div className="hidden lg:block">
        <DesktopQuoteNavbar />
      </div>
    </>
  )
}
