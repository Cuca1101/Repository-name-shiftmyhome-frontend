import { Link } from 'react-router-dom'
import { SERVICE_PAGES } from '../constants/servicePages'
import { HouseIcon, iconBySlug } from './serviceIcons'

export default function HeroServiceGrid() {
  return (
    <div id="services" className="scroll-mt-24 w-full pt-4 sm:pt-6">
      <ul className="mx-auto grid w-full min-w-0 max-w-6xl grid-cols-2 items-stretch gap-2 xxs:gap-2.5 xs:gap-3 ph:gap-3.5 sm:gap-5 lg:grid-cols-3 lg:gap-6">
        {SERVICE_PAGES.map((service) => {
          const Icon = iconBySlug[service.slug] ?? HouseIcon
          return (
            <li key={service.path} className="min-w-0 w-full">
              <Link
                to={service.path}
                className="group relative flex h-[148px] w-full min-w-0 flex-col overflow-hidden rounded-xl shadow-lg shadow-black/30 ring-1 ring-white/10 transition-[transform,box-shadow] duration-200 ease-out xxs:h-[158px] xs:h-[168px] ph:h-[178px] mb:h-[195px] sm:h-[230px] sm:rounded-2xl sm:hover:scale-[1.02] sm:hover:shadow-2xl sm:hover:shadow-brand-500/25 lg:h-[275px] lg:rounded-[1.25rem] lg:hover:scale-[1.03] focus-visible:outline focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950"
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
                <div className="relative z-10 flex h-full min-h-0 flex-col p-2.5 xxs:p-3 xs:p-3.5 sm:p-6 md:p-7">
                  <div className="flex shrink-0 justify-start">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/20 p-1.5 text-white shadow-sm backdrop-blur-md xxs:h-9 xxs:w-9 sm:h-12 sm:w-12">
                      <Icon className="h-4 w-4 xxs:h-5 xxs:w-5 sm:h-7 sm:w-7" />
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-0.5 text-center">
                    <h3 className="line-clamp-2 text-balance text-[0.7rem] font-bold leading-snug text-white drop-shadow-md xxs:text-xs xs:text-sm sm:text-lg md:text-[1.125rem]">
                      {service.title}
                    </h3>
                    <p className="mt-1 line-clamp-1 text-[0.625rem] leading-tight text-white/90 xxs:text-[0.65rem] xs:text-xs sm:mt-2 sm:text-sm">
                      {service.heroTeaser}
                    </p>
                  </div>
                  <div className="shrink-0 pt-2">
                    <span className="flex min-h-[32px] w-full items-center justify-center rounded-full bg-gradient-to-r from-brand-600 via-brand-500 to-cyan-500 px-2 text-center text-[0.625rem] font-bold tracking-wide text-white shadow-md transition duration-200 group-hover:shadow-lg group-hover:shadow-brand-400/40 xxs:min-h-[34px] xxs:text-[0.65rem] xs:min-h-[36px] xs:text-xs sm:min-h-[48px] sm:px-3 sm:text-sm">
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
