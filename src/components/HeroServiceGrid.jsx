import { Link } from 'react-router-dom'
import { SERVICE_PAGES } from '../constants/servicePages'
import { HouseIcon, iconBySlug } from './serviceIcons'

export default function HeroServiceGrid() {
  return (
    <div id="services" className="scroll-mt-24 w-full pt-4 sm:pt-6">
      <ul className="mx-auto grid w-full max-w-7xl grid-cols-1 items-stretch gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-6 xl:max-w-[90rem]">
        {SERVICE_PAGES.map((service) => {
          const Icon = iconBySlug[service.slug] ?? HouseIcon
          return (
            <li key={service.path} className="min-w-0 w-full">
              <Link
                to={service.path}
                className="group relative flex h-[250px] w-full flex-col overflow-hidden rounded-2xl shadow-lg shadow-black/30 ring-1 ring-white/10 transition-[transform,box-shadow] duration-200 ease-out will-change-transform hover:scale-[1.03] hover:shadow-2xl hover:shadow-brand-500/25 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950 sm:h-[265px] lg:h-[275px] lg:rounded-[1.25rem]"
              >
                <div
                  className="absolute inset-0 scale-100 bg-cover bg-center transition duration-500 ease-out group-hover:scale-105"
                  style={{ backgroundImage: `url(${service.heroImage})` }}
                  role="presentation"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-b from-slate-950/75 via-slate-900/45 to-slate-950/90"
                  aria-hidden
                />
                <div className="relative z-10 flex h-full min-h-0 flex-col p-5 sm:p-6 md:p-7">
                  <div className="flex shrink-0 justify-start">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-white/20 p-2 text-white shadow-sm backdrop-blur-md sm:h-12 sm:w-12">
                      <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-0.5 text-center">
                    <h3 className="line-clamp-2 text-balance text-base font-bold leading-snug text-white drop-shadow-md sm:text-lg md:text-[1.125rem]">
                      {service.title}
                    </h3>
                    <p className="mt-2 line-clamp-1 text-xs leading-tight text-white/90 sm:text-sm">
                      {service.heroTeaser}
                    </p>
                  </div>
                  <div className="shrink-0 pt-2">
                    <span className="flex min-h-[44px] w-full items-center justify-center rounded-full bg-gradient-to-r from-brand-600 via-brand-500 to-cyan-500 px-3 text-center text-xs font-bold tracking-wide text-white shadow-md transition duration-200 group-hover:shadow-lg group-hover:shadow-brand-400/40 sm:min-h-[48px] sm:text-sm">
                      Get a Quote
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
