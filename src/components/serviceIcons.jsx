/**
 * Shared service card icons — bold, semi-filled style (24px viewBox).
 * Used by hero service grid and any future compact service UI.
 */
export function HouseIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        d="M12 3L4 9.5V21h16V9.5L12 3z"
      />
      <path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M9 21v-6h6v6" />
    </svg>
  )
}

export function VanIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="currentColor"
        fillOpacity="0.35"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        d="M3 8h11v9H3V8zm11 0h2.5l3.5 3.5V17h-6"
      />
      <circle cx="7.5" cy="18.5" r="2" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="18.5" r="2" fill="currentColor" stroke="none" />
      <path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M4 12h7" />
    </svg>
  )
}

export function SofaIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        d="M5 14h14v5H5v-5z"
      />
      <path
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 14V11a2 2 0 012-2h6a2 2 0 012 2v3"
      />
    </svg>
  )
}

export function OfficeIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="currentColor"
        fillOpacity="0.28"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        d="M4 20h16M4 18V9l8-3.5 8 3.5v9"
      />
      <path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M10 14h4M10 11h4" />
    </svg>
  )
}

export function StudentIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="currentColor"
        fillOpacity="0.32"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        d="M2.5 8.5L12 4l9.5 4.5L12 13 2.5 8.5z"
      />
      <path
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        d="M5.5 10.2V17c0 1.2 2.8 2.2 6.5 2.2s6.5-1 6.5-2.2v-6.8"
      />
      <circle cx="18" cy="16" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function WasteIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        d="M9 5h6l1 3h5v2H3V8h5l1-3z"
      />
      <path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M6 10l1.2 12h9.6L18 10M10 14v5M14 14v5" />
    </svg>
  )
}

export const iconBySlug = {
  'house-removals': HouseIcon,
  'man-with-van': VanIcon,
  'furniture-delivery': SofaIcon,
  'office-moves': OfficeIcon,
  'student-moves': StudentIcon,
  clearance: WasteIcon,
}
