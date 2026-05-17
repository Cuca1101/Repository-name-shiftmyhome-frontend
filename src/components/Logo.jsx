import { useState } from 'react'

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
    </svg>
  )
}

function TextMark({ className = '', dark = false }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <span
        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 ${
          dark ? 'border-slate-600 bg-slate-800' : 'border-brand-600 bg-white'
        }`}
        aria-hidden
      >
        <HouseIcon className={dark ? 'h-6 w-6 text-brand-400' : 'h-6 w-6 text-brand-600'} />
      </span>
      <span className={`font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>
        ShiftMy<span className={dark ? 'text-brand-400' : 'text-brand-600'}>Home</span>
      </span>
    </span>
  )
}

/** Navbar / light areas — white background logo. */
const LOGO_LIGHT = '/logo.png?v=2'
/** Footer — dark background logo (white text). */
const LOGO_FOOTER = '/logo-footer.png?v=1'

/**
 * @param {object} props
 * @param {boolean} [props.asImage] — navbar on white slab
 * @param {'default'|'dark'} [props.variant]
 * @param {string} [props.className]
 * @param {string} [props.src] — optional CMS override URL
 */
export default function Logo({ asImage = false, variant = 'default', className = '', src: srcOverride }) {
  const [imageFailed, setImageFailed] = useState(false)
  const footerOnDark = variant === 'dark'

  const src = srcOverride || (footerOnDark ? LOGO_FOOTER : LOGO_LIGHT)

  const imgClass = asImage
    ? 'block h-11 w-auto max-w-[min(100%,17rem)] object-contain object-left sm:h-12 sm:max-w-[min(100%,19rem)] lg:h-[3.35rem] lg:max-w-[min(100%,21rem)]'
    : footerOnDark
      ? 'h-11 w-auto max-w-[min(100%,18rem)] object-contain object-left sm:h-12 sm:max-w-[min(100%,20rem)]'
      : 'h-10 w-auto max-w-[min(100%,17rem)] object-contain object-left sm:h-11 sm:max-w-[min(100%,19rem)]'

  if (!imageFailed) {
    return (
      <span className={`inline-flex min-w-0 max-w-full shrink-0 items-center ${className}`}>
        <img
          src={src}
          alt="ShiftMyHome — Your Move Made Simple"
          className={imgClass}
          onError={() => setImageFailed(true)}
        />
      </span>
    )
  }

  return <TextMark className={className} dark={footerOnDark} />
}
