import { useState } from 'react'

/** Icon: casă (contur), nu pachet — potrivește „Home” din brand. */
function HouseIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M10 21v-5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V21"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <rect x="8" y="12" width="2" height="2" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="12" width="2" height="2" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/** Casetă brand — chenar alb + contur brand (variantă nouă față de gradientul anterior). */
function BrandIconBox({ size = 'nav', dark = false }) {
  if (size === 'mark') {
    return (
      <span
        className={
          dark
            ? 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-slate-600 bg-slate-800 shadow-md ring-2 ring-slate-700/80'
            : 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-brand-600 bg-white shadow-md shadow-slate-300/70 ring-2 ring-brand-100'
        }
        aria-hidden
      >
        <HouseIcon className={dark ? 'h-6 w-6 text-brand-400' : 'h-6 w-6 text-brand-600'} />
      </span>
    )
  }

  return (
    <span
      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-brand-600 bg-white shadow-lg shadow-slate-400/40 ring-4 ring-brand-100/90 sm:h-14 sm:w-14 lg:h-16 lg:w-16"
      aria-hidden
    >
      <HouseIcon className="h-7 w-7 text-brand-600 sm:h-8 sm:w-8 lg:h-9 lg:w-9" />
    </span>
  )
}

function TextMark({ className = '', dark = false }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 sm:gap-3 ${className}`}>
      <BrandIconBox size="mark" dark={dark} />
      <span
        className={`truncate text-base font-bold tracking-tight sm:text-lg ${dark ? 'text-white' : 'text-slate-900'}`}
      >
        ShiftMy<span className={dark ? 'text-brand-400' : 'text-brand-600'}>Home</span>
      </span>
    </span>
  )
}

/**
 * @param {object} props
 * @param {boolean} [props.asImage] — navbar: icon box + `/logo.png` with text fallback
 * @param {'default'|'dark'} [props.variant] — dark: light text for navy footer
 * @param {string} [props.className]
 */
export default function Logo({ asImage = false, variant = 'default', className = '' }) {
  const [imageFailed, setImageFailed] = useState(false)
  const dark = variant === 'dark'

  if (asImage) {
    if (imageFailed) {
      return (
        <span className={`inline-flex min-w-0 max-w-full items-center gap-2 sm:gap-3 ${className}`}>
          <BrandIconBox size="nav" dark={dark} />
          <span
            className={`truncate text-base font-bold tracking-tight sm:text-xl ${dark ? 'text-white' : 'text-slate-900'}`}
          >
            ShiftMy<span className={dark ? 'text-brand-400' : 'text-brand-600'}>Home</span>
          </span>
        </span>
      )
    }
    return (
      <span className={`inline-flex min-w-0 max-w-full items-center gap-2 sm:gap-3 ${className}`}>
        <BrandIconBox size="nav" dark={dark} />
        <img
          src="/logo.png"
          alt="ShiftMyHome logo"
          className={`h-9 w-auto max-w-[min(100%,9rem)] object-contain object-left sm:h-11 sm:max-w-[min(100%,16rem)] lg:h-12 ${dark ? 'brightness-0 invert' : ''}`}
          onError={() => setImageFailed(true)}
        />
      </span>
    )
  }

  return <TextMark className={className} dark={dark} />
}
