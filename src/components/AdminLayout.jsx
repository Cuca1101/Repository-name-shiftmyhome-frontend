import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { showDemoAdminUi } from '../lib/adminProductionMode'
import StripeModeBanner from './admin/StripeModeBanner'

const mainSections = [
  {
    title: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', end: true, icon: 'layout' },
      { to: '/admin/analytics', label: 'Analytics', end: false, icon: 'chart' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/admin/available-jobs', label: 'Available Jobs', end: false, icon: 'document' },
      { to: '/admin/marketplace', label: 'Marketplace', end: false, icon: 'package' },
      { to: '/admin/active-jobs', label: 'Active Jobs', end: false, icon: 'truck' },
      { to: '/admin/completed-jobs', label: 'Completed Jobs', end: false, icon: 'star' },
      { to: '/admin/cancelled-jobs', label: 'Cancelled Jobs', end: false, icon: 'ban' },
      { to: '/admin/operations-map', label: 'Operations Map', end: false, icon: 'crosshair' },
      { to: '/admin/journey-planner', label: 'Journey Planner', end: false, icon: 'map' },
    ],
  },
  {
    title: 'Sales',
    items: [
      { to: '/admin/quote-requests', label: 'Quote Requests', end: false, icon: 'inbox' },
      { to: '/admin/website-leads', label: 'Website Leads / Quote Funnel', end: false, icon: 'inbox' },
    ],
  },
  {
    title: 'Fleet',
    items: [
      { to: '/admin/drivers', label: 'Drivers', end: false, icon: 'users' },
      { to: '/admin/driver-payments', label: 'Driver payments', end: false, icon: 'wallet' },
      { to: '/admin/partners', label: 'Partners', end: false, icon: 'building' },
    ],
  },
  {
    title: 'Pricing & catalog',
    items: [
      { to: '/admin/pricing', label: 'Pricing engine', end: false, icon: 'sliders' },
      { to: '/admin/items', label: 'Items library', end: false, icon: 'package' },
    ],
  },
  {
    title: 'Content',
    items: [
      { to: '/admin/website-cms', label: 'Website CMS', end: false, icon: 'globe' },
      { to: '/admin/seo', label: 'SEO Dashboard', end: false, icon: 'search' },
      { to: '/admin/reviews', label: 'Reviews', end: false, icon: 'star' },
    ],
  },
]

const legacySupportSection = {
  title: 'Legacy / Support Tools',
  helperText:
    'Old support/debug pages retained temporarily during migration to the quotes-first workflow.',
  items: [
    { to: '/admin/jobs', label: 'Job Cards', end: false, icon: 'truck' },
    { to: '/admin/bookings', label: 'Bookings', end: false, icon: 'truck' },
    { to: '/admin/job-history', label: 'Job History', end: false, icon: 'truck' },
  ],
}

/** @param {string} pathname */
function isLegacySupportPath(pathname) {
  if (pathname === '/admin/jobs' || pathname.startsWith('/admin/jobs/')) return true
  if (pathname === '/admin/bookings' || pathname.startsWith('/admin/bookings/')) return true
  if (pathname === '/admin/job-history' || pathname.startsWith('/admin/job-history/')) return true
  return false
}

function NavIcon({ name, className }) {
  const cn = className || 'h-5 w-5 shrink-0'
  switch (name) {
    case 'users':
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.433-2.054M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
          />
        </svg>
      )
    case 'wallet':
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a2.25 2.25 0 0 0-2.25 2.25v2.25a2.25 2.25 0 0 0 2.25 2.25h3.75A2.25 2.25 0 0 0 21 14.25V12Zm0 0v-1.5a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 10.5v3.75m18 0V18a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-2.25m18 0V9M3 9V6.75A2.25 2.25 0 0 1 5.25 4.5h13.5A2.25 2.25 0 0 1 21 6.75V9M3 9h18"
          />
        </svg>
      )
    case 'building':
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z"
          />
        </svg>
      )
    case 'chart':
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
          />
        </svg>
      )
    case 'layout':
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
          />
        </svg>
      )
    case 'map':
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437a.75.75 0 0 0 0-1.218L15 15.503m0 0L8.25 9.503m0 0L3.375 7.125a.75.75 0 0 0 0 1.218L8.25 9.503m0 0 6.75 6.75"
          />
        </svg>
      )
    case 'crosshair':
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.364-6.364-2.121 2.121M7.757 16.243l-2.121 2.121m12.728 0-2.121-2.121M7.757 7.757 5.636 5.636M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
          />
        </svg>
      )
    case 'document':
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.709 14.386c.236.483.646.87 1.173 1.112h4.904c1.016 0 1.875-.658 2.152-1.568l2.351-7.676c.237-.769-.14-1.568-.868-1.868l-3.19-1.19c-.466-.174-.968-.15-1.417.065M8.25 9.75h4.5m-4.5 3a3.75 3.75 0 1 0 0 7.5h9a3.75 3.75 0 0 0 0-7.5h-9Z"
          />
        </svg>
      )
    case 'inbox':
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5 0V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.5m-19.5 0V9a2.25 2.25 0 0 1 2.25-2.25h15A2.25 2.25 0 0 1 21.75 9v4.5m-19.5 0h19.5M9 12h1.5m3 0H15"
          />
        </svg>
      )
    case 'truck':
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0h3.375c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-3.375m12-6.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h2.25m-4.5 0H15M9 12V9.75A2.25 2.25 0 0 1 11.25 7.5h9A2.25 2.25 0 0 1 22.5 9.75V12m-15 0v4.5m0-4.5H6a2.25 2.25 0 0 0-2.25 2.25V18m19.5-6v4.5a2.25 2.25 0 0 1-2.25 2.25h-4.5"
          />
        </svg>
      )
    case 'sliders':
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
          />
        </svg>
      )
    case 'package':
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 7.5-9-5.25L3 7.5m18 0v9l-9 5.25m9-14.25v9m-9 5.25v-9m0 0-9-5.25m9 5.25 9-5.25"
          />
        </svg>
      )
    case 'ban':
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
      )
    case 'search':
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
      )
    case 'globe':
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.264.26-2.465.727-3.556"
          />
        </svg>
      )
    case 'star':
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
          />
        </svg>
      )
    default:
      return null
  }
}

function pathActive(pathname, item) {
  if (item.end) return pathname === item.to
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

function AdminNavItem({ item, pathname, onNavigate }) {
  const active = pathActive(pathname, item)
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
          active
            ? 'bg-white/10 text-white shadow-inner ring-1 ring-white/10'
            : 'text-slate-400 hover:bg-white/5 hover:text-white'
        }`}
      >
        <span className={active ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'}>
          <NavIcon name={item.icon} />
        </span>
        {item.label}
        {active && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden />}
      </NavLink>
    </li>
  )
}

export default function AdminLayout() {
  const navigate = useNavigate()
  const loc = useLocation()
  const pathname = loc.pathname
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [legacyOpen, setLegacyOpen] = useState(() => isLegacySupportPath(pathname))

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  useEffect(() => {
    if (isLegacySupportPath(pathname)) setLegacyOpen(true)
  }, [pathname])

  useEffect(() => {
    closeSidebar()
  }, [pathname, closeSidebar])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => {
      if (mq.matches) setSidebarOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  async function handleLogout() {
    if (supabase) await supabase.auth.signOut()
    navigate('/admin/login', { replace: true })
  }

  const allNavItems = [...mainSections.flatMap((s) => s.items), ...legacySupportSection.items]

  const currentTitle = allNavItems.find((item) => pathActive(pathname, item))?.label ?? 'Admin'

  return (
    <div className="min-h-screen min-w-0 bg-slate-100/90">
      {/* Mobile overlay */}
      <button
        type="button"
        aria-label="Close menu"
        className={`fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity lg:hidden ${
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={closeSidebar}
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,17.5rem)] flex-col border-r border-slate-800/80 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl transition-transform duration-200 ease-out lg:w-64 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4 lg:h-[4.25rem]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/30">
            <svg className="h-6 w-6 text-emerald-400" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 14l4-6 4 3 4-7 4 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-tight text-white">ShiftMyHome</p>
            <p className="truncate text-xs text-slate-400">Operations</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={closeSidebar}
            aria-label="Close sidebar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Admin navigation">
          {mainSections.map((section) => (
            <div key={section.title} className="mb-7 last:mb-0">
              <p className="mb-2.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <AdminNavItem key={item.to} item={item} pathname={pathname} onNavigate={closeSidebar} />
                ))}
              </ul>
            </div>
          ))}

          {showDemoAdminUi() ? (
          <div className="mb-6 border-t border-white/10 pt-5 last:mb-0">
            <button
              type="button"
              onClick={() => setLegacyOpen((open) => !open)}
              className="mb-2 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left transition hover:bg-white/5"
              aria-expanded={legacyOpen}
              aria-controls="admin-legacy-support-nav"
            >
              <p className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {legacySupportSection.title}
              </p>
              <svg
                className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${legacyOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {legacyOpen ? (
              <div id="admin-legacy-support-nav">
                <p className="mb-3 px-3 text-[11px] leading-relaxed text-slate-500">{legacySupportSection.helperText}</p>
                <ul className="space-y-0.5">
                  {legacySupportSection.items.map((item) => (
                    <AdminNavItem key={item.to} item={item} pathname={pathname} onNavigate={closeSidebar} />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          ) : null}
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3">
          <Link
            to="/"
            className="mb-2 flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
          >
            View site
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        {/* Top bar (mobile + desktop) */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 shadow-sm backdrop-blur-md sm:h-16 sm:px-6">
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">ShiftMyHome Admin</p>
            <h1 className="truncate text-lg font-bold leading-tight text-slate-900 sm:text-xl">{currentTitle}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 lg:hidden">
            <Link
              to="/"
              className="inline-flex min-h-[40px] items-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 sm:px-4 sm:text-sm"
            >
              View site
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-[40px] items-center whitespace-nowrap rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 sm:px-4 sm:text-sm"
            >
              Log out
            </button>
          </div>
        </header>

        <main className="admin-main-compact flex-1 px-2.5 py-4 xxs:px-3 xs:px-4 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto min-w-0 max-w-7xl space-y-4">
            <StripeModeBanner />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
