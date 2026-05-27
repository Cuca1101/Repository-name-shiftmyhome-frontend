import { Link } from 'react-router-dom'

/** Homepage internal links for priority local SEO pages — minimal, non-intrusive. */
const LOCAL_SEO_LINKS = [
  { to: '/glasgow-removals', label: 'Glasgow House Removals' },
  { to: '/edinburgh-removals', label: 'Edinburgh Removals' },
  { to: '/man-with-van-glasgow', label: 'Man with Van Glasgow' },
  { to: '/furniture-delivery-glasgow', label: 'Furniture Delivery Glasgow' },
]

export default function HomeLocalSeoLinks() {
  return (
    <nav
      className="border-b border-slate-100 bg-white py-3"
      aria-label="Popular Scotland removal services"
    >
      <div className="home-container">
        <p className="text-center text-xs leading-relaxed text-slate-500 sm:text-sm">
          <span className="text-slate-600">Scotland removals:</span>{' '}
          {LOCAL_SEO_LINKS.map((link, index) => (
            <span key={link.to}>
              {index > 0 ? (
                <span className="mx-1 text-slate-300" aria-hidden>
                  ·
                </span>
              ) : null}
              <Link to={link.to} className="font-medium text-brand-700 underline-offset-2 hover:underline">
                {link.label}
              </Link>
            </span>
          ))}
        </p>
      </div>
    </nav>
  )
}
