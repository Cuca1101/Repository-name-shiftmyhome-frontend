import { useState } from 'react'
import LogoIcon from './LogoIcon'

const LOGO_NAV = '/logo-transparent.png?v=3'
const LOGO_LIGHT = '/logo.png?v=2'
const LOGO_FOOTER = '/logo-footer.png?v=1'

const DEFAULT_BRAND_LOGOS = new Set(['/logo.png', '/logo-transparent.png', '/logo-footer.png'])

/** CMS default paths — use wordmark unless admin uploaded a custom logo. */
function isCustomBrandLogo(src) {
  if (!src) return false
  const base = String(src).split('?')[0]
  return !DEFAULT_BRAND_LOGOS.has(base)
}

function BrandWordmark({ className = '', compact = false }) {
  const isNav = compact === 'nav'
  const isFooter = compact === 'footer'
  const isCompact = compact === true || isNav || isFooter

  const iconClass = isNav || isFooter
    ? 'h-[40px] w-auto max-w-[2.15rem] shrink-0 object-contain'
    : isCompact
      ? 'h-[30px] w-auto max-w-[1.65rem] shrink-0 object-contain'
      : 'h-[42px] w-auto shrink-0 sm:h-[46px] lg:h-[50px]'

  const textClass = isCompact
    ? 'text-[16px] leading-none'
    : 'text-[18px] sm:text-[21px] lg:text-[24px]'

  const taglineClass = isCompact
    ? 'text-[6px] tracking-[0.13em] sm:text-[7px]'
    : 'text-[7px] tracking-[0.16em] sm:text-[8px]'

  return (
    <span
      className={`inline-flex min-w-0 max-w-full items-center ${isCompact ? 'gap-2' : 'gap-2.5 sm:gap-3'} ${className}`}
    >
      <LogoIcon className={iconClass} />
      <span
        className={`flex min-w-0 flex-col items-center justify-center text-center leading-tight ${
          isCompact ? 'translate-y-1.5' : 'translate-y-2 sm:translate-y-2.5'
        }`}
      >
        <span className={`truncate whitespace-nowrap font-bold tracking-tight text-white ${textClass}`}>
          Shift<span className="text-brand-400">My</span>Home
        </span>
        <span className={`mt-0.5 truncate font-medium uppercase text-white/55 ${taglineClass}`}>
          your move made simple
        </span>
      </span>
    </span>
  )
}

/**
 * @param {object} props
 * @param {boolean} [props.asImage] — navbar: icon + wordmark on dark navy
 * @param {'default'|'dark'} [props.variant]
 * @param {string} [props.className]
 * @param {boolean | 'nav' | 'footer'} [props.compact] — balanced mobile wordmark (navbar + footer)
 * @param {string} [props.src] — optional CMS override URL
 */
export default function Logo({ asImage = false, variant = 'default', className = '', src: srcOverride, compact = false }) {
  const [imageFailed, setImageFailed] = useState(false)
  const footerOnDark = variant === 'dark'

  const navSrc = isCustomBrandLogo(srcOverride) ? srcOverride : LOGO_NAV
  const src = srcOverride || (footerOnDark ? LOGO_FOOTER : LOGO_LIGHT)

  const navImgClass =
    'block h-10 w-auto max-w-[min(100%,14rem)] object-contain object-left sm:h-11 sm:max-w-[min(100%,15.5rem)] lg:h-12 lg:max-w-[min(100%,17rem)]'

  const imgClass = asImage
    ? navImgClass
    : footerOnDark
      ? 'h-11 w-auto max-w-[min(100%,18rem)] object-contain object-left sm:h-12 sm:max-w-[min(100%,20rem)]'
      : 'h-10 w-auto max-w-[min(100%,17rem)] object-contain object-left sm:h-11 sm:max-w-[min(100%,19rem)]'

  const useBrandWordmark = footerOnDark && !isCustomBrandLogo(srcOverride) && (asImage || !srcOverride)
  const useNavTransparent = asImage && footerOnDark && !isCustomBrandLogo(srcOverride)

  if (useBrandWordmark) {
    return <BrandWordmark className={className} compact={compact} />
  }

  if (!imageFailed) {
    return (
      <span className={`inline-flex min-w-0 max-w-full shrink-0 items-center ${className}`}>
        <img
          src={useNavTransparent ? navSrc : src}
          alt="ShiftMyHome — your move made simple"
          className={imgClass}
          onError={() => setImageFailed(true)}
        />
      </span>
    )
  }

  if (asImage && footerOnDark) {
    return <BrandWordmark className={className} compact={compact} />
  }

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 font-bold tracking-tight ${className}`}>
      <span className={footerOnDark ? 'text-white' : 'text-slate-900'}>
        Shift<span className={footerOnDark ? 'text-brand-400' : 'text-brand-600'}>my</span>Home
      </span>
    </span>
  )
}
