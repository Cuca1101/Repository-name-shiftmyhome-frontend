const LOGO_MARK = '/logo-mark.png?v=4'

/** Brand house + van mark — true transparent PNG (no background). */
export default function LogoIcon({ className = 'h-[42px] w-auto shrink-0' }) {
  return (
    <img
      src={LOGO_MARK}
      alt=""
      aria-hidden
      draggable={false}
      className={`block object-contain object-center ${className}`}
    />
  )
}
