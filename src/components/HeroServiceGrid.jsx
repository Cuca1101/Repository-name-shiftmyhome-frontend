import { Link } from 'react-router-dom'
import { SERVICE_PAGES } from '../constants/servicePages'
import { HouseIcon, iconBySlug } from './serviceIcons'

export default function HeroServiceGrid() {
  return (
    <div id="services" className="scroll-mt-24 w-full pt-2 pb-16 xxs:pt-2.5 xxs:pb-[4.25rem] sm:pt-6 sm:pb-0">
      <ul className="service-card-grid mx-auto grid w-full min-w-0 max-w-6xl grid-cols-3 items-stretch gap-2 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-6">
        {SERVICE_PAGES.map((service) => {
          const Icon = iconBySlug[service.slug] ?? HouseIcon
          return (
            <li key={service.path} className="min-w-0 w-full">
              <Link
                to={service.path}
                className="group relative flex h-[145px] w-full min-w-0 flex-col overflow-hidden rounded-2xl shadow-lg shadow-black/30 ring-1 ring-white/10 transition-[transform,box-shadow] duration-200 ease-out xxs:h-[150px] xs:h-[158px] ph:h-[165px] mb:h-[170px] sm:h-[250px] sm:rounded-2xl sm:hover:scale-[1.02] sm:hover:shadow-2xl sm:hover:shadow-brand-500/25 lg:h-[275px] lg:rounded-[1.25rem] lg:hover:scale-[1.03] focus-visible:outline focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950"
              >
                <div
                  className="absolute inset-0 scale-100 bg-cover bg-center transition duration-500 ease-out sm:group-hover:scale-105"
                  style={{ backgroundImage: `url(${service.heroImage})` }}
                  role="presentation"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-b from-slate-950/75 via-slate-900/45 to-slate-950/90"
                  aria-hidden
                />
                <div className="relative z-10 flex h-full min-h-0 flex-col p-2 sm:p-6 md:p-7">
                  <div className="flex shrink-0 justify-start">
                    <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/40 bg-white/20 p-1 text-white shadow-sm backdrop-blur-md xxs:h-9 xxs:w-9 xs:h-[38px] xs:w-[38px] sm:h-12 sm:w-12">
                      <Icon className="h-3.5 w-3.5 xxs:h-4 xxs:w-4 xs:h-[18px] xs:w-[18px] sm:h-7 sm:w-7" />
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-0.5 text-center">
                    <h3 className="line-clamp-2 text-balance text-[11px] font-bold leading-tight text-white drop-shadow-md xxs:text-xs ph:text-[13px] sm:text-lg md:text-[1.125rem]">
                      {service.title}
                    </h3>
                    <p className="mt-0.5 line-clamp-1 text-[9px] leading-tight text-white/90 xxs:text-[10px] sm:mt-2 sm:text-sm">
                      {service.heroTeaser}
                    </p>
                  </div>
                  <div className="shrink-0 pt-1 sm:pt-2">
                    <span className="flex min-h-[30px] w-full items-center justify-center rounded-full bg-gradient-to-r from-brand-600 via-brand-500 to-cyan-500 px-1.5 text-center text-[10px] font-bold tracking-wide text-white shadow-md transition duration-200 group-hover:shadow-lg group-hover:shadow-brand-400/40 xxs:min-h-[32px] xxs:text-[11px] sm:min-h-[48px] sm:px-3 sm:text-sm">
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
