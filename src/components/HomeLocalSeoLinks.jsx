import { Link } from 'react-router-dom'
import { cityToSlug } from '../lib/citySlug'
import { FOOTER_PRIMARY_CITIES } from '../lib/seo/locations'

const EXTRA_HOME_CITIES = ['Perth', 'Stirling', 'Falkirk', 'Motherwell', 'Hamilton']

/** Homepage internal links targeting generic city removal keywords. */
const LOCAL_SEO_LINKS = [
  ...FOOTER_PRIMARY_CITIES,
  ...EXTRA_HOME_CITIES,
]
  .filter((city, index, arr) => arr.indexOf(city) === index)
  .flatMap((city) => {
    const slug = cityToSlug(city)
    const links = [{ to: `/${slug}-removals`, label: `${city} removals` }]
    if (city === 'Glasgow') {
      links.push(
        { to: '/man-with-van-glasgow', label: 'Man with van Glasgow' },
        { to: '/furniture-delivery-glasgow', label: 'Furniture delivery Glasgow' },
      )
    }
    return links
  })
  .concat([{ to: '/coverage', label: 'All Scotland locations' }])

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
            <span key={`${link.to}-${link.label}`}>
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
