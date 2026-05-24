import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from './Logo'
import HomeSectionLink from './HomeSectionLink'
import CoverageLink from './CoverageLink'
import { CONTACT, WHATSAPP_URL } from '../config'
import { supabase } from '../lib/supabase'
import { useWebsiteCms } from '../context/WebsiteCmsContext'

const quickLinks = [
  { sectionId: 'home', label: 'Home' },
  { sectionId: 'services', label: 'Services' },
  { sectionId: 'how-it-works', label: 'How it works' },
  { sectionId: 'about', label: 'About us' },
  { sectionId: 'reviews', label: 'Reviews' },
  { sectionId: 'coverage', label: 'Coverage' },
  { sectionId: 'contact', label: 'Contact' },
  { sectionId: 'services', label: 'Get Free Quote' },
]

const linkClass = 'text-slate-400 transition hover:text-brand-300'

const serviceLinks = [
  { to: '/house-removals', label: 'House Removals' },
  { to: '/man-with-van', label: 'Man with Van' },
  { to: '/furniture-delivery', label: 'Furniture & Items' },
  { to: '/clearance', label: 'Clearance & Removal' },
  { to: '/office-moves', label: 'Office Moves' },
  { to: '/student-moves', label: 'Student Moves' },
]

import { FOOTER_SEO_LOCATION_LINKS } from '../lib/seo/locations.js'
import { SCOTLAND_HUB_LINKS } from '../lib/seoNearbyAreas.js'

const areaSeoLinks = FOOTER_SEO_LOCATION_LINKS
const hubSeoLinks = SCOTLAND_HUB_LINKS.slice(0, 4)

const legalLinks = [
  { to: '/terms', label: 'Terms & Conditions' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/cookies', label: 'Cookie Preferences' },
]

function SocialIcon({ href, label, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="footer-social-link"
    >
      {children}
    </a>
  )
}

export default function Footer() {
  const { footer: cmsFooter } = useWebsiteCms()
  const phoneDisplay = cmsFooter.phoneDisplay || CONTACT.phoneDisplay
  const phoneTel = cmsFooter.phoneTel || CONTACT.phoneTel
  const email = cmsFooter.email || CONTACT.email
  const tagline =
    cmsFooter.tagline ||
    'ShiftMyHome — house removals, man with van and moving services across Scotland.'
  const social = cmsFooter.socialLinks || {}
  const year = new Date().getFullYear()
  const [adminHref, setAdminHref] = useState('/admin/login')
  const [adminLabel, setAdminLabel] = useState('Admin Login')

  useEffect(() => {
    if (!supabase) {
      setAdminHref('/admin/login')
      setAdminLabel('Admin Login')
      return
    }
    const sync = (session) => {
      if (session) {
        setAdminHref('/admin')
        setAdminLabel('Admin')
      } else {
        setAdminHref('/admin/login')
        setAdminLabel('Admin Login')
      }
    }
    supabase.auth.getSession().then(({ data: { session } }) => sync(session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => sync(session))
    return () => subscription.unsubscribe()
  }, [])

  return (
    <footer className="site-footer-premium text-slate-300">
      <div className="mx-auto min-w-0 max-w-6xl px-4 py-8 sm:px-6 sm:py-14 lg:px-8">
        <div className="grid min-w-0 gap-6 sm:grid-cols-2 sm:gap-10 lg:grid-cols-4 lg:gap-12">
          <div className="sm:col-span-2 lg:col-span-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-white">About ShiftMyHome</p>
            <Link
              to="/"
              className="footer-logo-wrap mt-3 inline-block bg-transparent outline-none ring-offset-slate-900 focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Logo variant="dark" src={cmsFooter.logoUrl || undefined} />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">{tagline}</p>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-500">
              Scotland-wide removals and man with van services.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <SocialIcon href={social.whatsapp || WHATSAPP_URL} label="WhatsApp">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </SocialIcon>
              <SocialIcon href={social.facebook || '#'} label="Facebook">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </SocialIcon>
              <SocialIcon href={social.instagram || '#'} label="Instagram">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </SocialIcon>
            </div>
          </div>

          <div className="col-span-2 grid grid-cols-2 gap-x-4 gap-y-0 sm:contents">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wide text-white">Quick Links</p>
              <ul className="mt-3 space-y-2 text-sm sm:mt-4 sm:space-y-2.5">
                {quickLinks.map((item) => (
                <li key={item.to ?? item.sectionId}>
                  {item.to ? (
                    <Link to={item.to} className={linkClass}>
                      {item.label}
                    </Link>
                  ) : item.sectionId === 'coverage' ? (
                    <CoverageLink className={linkClass}>{item.label}</CoverageLink>
                  ) : (
                    <HomeSectionLink sectionId={item.sectionId} className={linkClass}>
                      {item.label}
                    </HomeSectionLink>
                  )}
                </li>
              ))}
            </ul>
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wide text-white">Services</p>
              <ul className="mt-3 space-y-2 text-sm sm:mt-4 sm:space-y-2.5">
                {serviceLinks.map(({ to, label }) => (
                  <li key={to}>
                    <Link to={to} className="text-slate-400 transition hover:text-brand-300">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-white">Areas we serve</p>
              <ul className="mt-3 space-y-2 text-sm sm:mt-4 sm:space-y-2.5">
                {areaSeoLinks.map(({ to, label }) => (
                  <li key={to}>
                    <Link to={to} className="text-slate-400 transition hover:text-brand-300">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-white">Guides &amp; delivery</p>
              <ul className="mt-3 space-y-2 text-sm sm:mt-4 sm:space-y-2.5">
                {hubSeoLinks.map(({ href, label }) => (
                  <li key={href}>
                    <Link to={href} className="text-slate-400 transition hover:text-brand-300">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="col-span-2 min-w-0 sm:col-span-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-white">Contact</p>
            <ul className="mt-3 space-y-2.5 text-sm sm:mt-4 sm:space-y-3">
              <li>
                <a href={`tel:${phoneTel}`} className="inline-flex items-center gap-2 text-slate-300 hover:text-white">
                  <span className="text-brand-400" aria-hidden>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </span>
                  {phoneDisplay}
                </a>
              </li>
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-[#20bd5a] sm:w-auto sm:justify-start"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  WhatsApp
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-start gap-2 break-all text-slate-300 hover:text-white"
                >
                  <span className="mt-0.5 shrink-0 text-brand-400" aria-hidden>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </span>
                  {email}
                </a>
              </li>
              <li className="flex gap-2 pt-1 text-slate-400">
                <span className="mt-0.5 shrink-0 text-brand-400" aria-hidden>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                <span>
                  Glasgow, Scotland
                  <span className="mt-2 block text-xs leading-relaxed text-slate-500">
                    Covering Glasgow, Scotland and UK-wide moves.
                  </span>
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-800 pt-6 sm:mt-12 sm:pt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
              {legalLinks.map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="hover:text-brand-300">
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to={adminHref}
                  className="text-slate-600 transition hover:text-slate-400"
                >
                  {adminLabel}
                </Link>
              </li>
            </ul>
            <p className="text-xs text-slate-500">© {year} ShiftMyHome Ltd. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
