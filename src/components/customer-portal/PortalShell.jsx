import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import SeoHead from '../seo/SeoHead'
import Logo from '../Logo'
import { canEnterCustomerPortal, sessionKindFromUser, withCustomerQuery } from '../../lib/accountRole'
import { customerPortalClient } from '../../lib/customerPortalClient'
import { getPortalContact } from '../../lib/customerPortalApi'
import { supabase } from '../../lib/supabase'

const PortalAccessContext = createContext({
  ready: false,
  mode: 'anonymous',
  customerId: '',
  portalSession: null,
  notice: '',
  portalTo: (path) => path,
})

export function usePortalAccess() {
  return useContext(PortalAccessContext)
}

export function usePortalSession() {
  const access = usePortalAccess()
  return {
    ready: access.ready,
    session: access.mode === 'customer' ? access.portalSession : null,
    notice: access.notice,
  }
}

export function useAppSession() {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState(null)

  useEffect(() => {
    if (!supabase) {
      setReady(true)
      return undefined
    }
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session || null)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      setSession(next || null)
      setReady(true)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return { ready, session }
}

export function PortalSessionProvider() {
  const [params] = useSearchParams()
  const customerId = String(params.get('customer') || '').trim()
  const { ready: appReady, session: appSession } = useAppSession()
  const [portalReady, setPortalReady] = useState(false)
  const [portalSession, setPortalSession] = useState(null)
  const [notice, setNotice] = useState('')
  const adminUser = appSession?.user || null
  const adminView = Boolean(customerId) && sessionKindFromUser(adminUser) === 'admin'
  const customerMode = canEnterCustomerPortal(portalSession?.user)
  const ready = portalReady && appReady

  useEffect(() => {
    if (!customerPortalClient) {
      setPortalReady(true)
      return undefined
    }
    let active = true
    async function accept(next) {
      if (!active) return
      if (next && !canEnterCustomerPortal(next.user)) {
        const kind = sessionKindFromUser(next.user)
        await customerPortalClient.auth.signOut()
        if (!active) return
        setPortalSession(null)
        setNotice(kind === 'driver' ? 'driver' : 'admin')
        setPortalReady(true)
        return
      }
      if (next) {
        const { data, error } = await customerPortalClient.rpc('account_session_kind')
        const serverKind = !error && typeof data === 'string' ? data : sessionKindFromUser(next.user)
        if (serverKind === 'admin' || serverKind === 'driver') {
          await customerPortalClient.auth.signOut()
          if (!active) return
          setPortalSession(null)
          setNotice(serverKind)
          setPortalReady(true)
          return
        }
      }
      if (!active) return
      setPortalSession(next || null)
      if (next) setNotice('')
      setPortalReady(true)
    }
    customerPortalClient.auth.getSession().then(({ data }) => accept(data.session || null))
    const { data } = customerPortalClient.auth.onAuthStateChange((_event, next) => {
      accept(next || null)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const portalTo = (path) => {
    if (!adminView || String(path).startsWith('/quote')) return path
    return withCustomerQuery(path, customerId)
  }
  const access = useMemo(() => ({
    ready,
    mode: adminView ? 'admin' : customerMode ? 'customer' : 'anonymous',
    customerId: adminView ? customerId : '',
    portalSession: customerMode ? portalSession : null,
    notice,
    portalTo,
  }), [ready, adminView, customerMode, customerId, portalSession, notice])

  return (
    <PortalAccessContext.Provider value={access}>
      <Outlet />
    </PortalAccessContext.Provider>
  )
}

const NAV = [
  { to: '/portal/bookings', label: 'My bookings', icon: 'bookings', end: false },
  { to: '/quote?from=account', label: 'New booking', icon: 'plus' },
  { to: '/portal/account', label: 'Account settings', icon: 'settings' },
  { to: '/portal/help', label: 'Help & support', icon: 'help' },
]

export default function PortalShell({ title, description, path, requireSession = true, children }) {
  const navigate = useNavigate()
  const access = usePortalAccess()
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const adminView = access.mode === 'admin'
  const customerId = access.customerId
  const ready = access.ready
  const signedIn = adminView || access.mode === 'customer'
  const portalTo = access.portalTo

  useEffect(() => {
    if (!signedIn) {
      setCustomerName('')
      setCustomerEmail('')
      return undefined
    }
    let cancelled = false
    setCustomerName('')
    setCustomerEmail('')
    getPortalContact(adminView ? { mode: 'admin', customerId } : { mode: 'customer' })
      .then((contact) => {
        if (cancelled) return
        setCustomerName(String(contact?.fullName || '').trim())
        setCustomerEmail(String(contact?.email || '').trim())
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [signedIn, adminView, customerId, access.mode])

  useEffect(() => {
    if (!signedIn) return undefined
    const refresh = () => {
      getPortalContact(adminView ? { mode: 'admin', customerId } : { mode: 'customer' })
        .then((contact) => {
          setCustomerName(String(contact?.fullName || '').trim())
          setCustomerEmail(String(contact?.email || '').trim())
        })
        .catch(() => {})
    }
    window.addEventListener('smh-portal-profile', refresh)
    return () => window.removeEventListener('smh-portal-profile', refresh)
  }, [signedIn, adminView, customerId])

  useEffect(() => {
    if (requireSession && ready && !signedIn) navigate('/portal', { replace: true })
  }, [requireSession, ready, signedIn, navigate])

  useEffect(() => {
    setMenuOpen(false)
  }, [path])

  async function signOut() {
    if (customerPortalClient) await customerPortalClient.auth.signOut()
    navigate('/portal', { replace: true })
  }

  if (!ready) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-[#eef3f8] text-slate-900">
        <SeoHead title={title} description={description} path={path} robots="noindex, nofollow" />
        <main className="mx-auto w-full max-w-lg px-4 py-8 text-sm text-slate-500">Loading…</main>
      </div>
    )
  }

  if (!signedIn) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-[#eef3f8] text-slate-900">
        <SeoHead title={title} description={description} path={path} robots="noindex, nofollow" />
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-lg items-center px-4 py-3">
            <Link to="/portal" aria-label="ShiftMyHome">
              <Logo />
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-lg px-4 py-5">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#eef3f8] text-slate-900">
      <SeoHead title={title} description={description} path={path} robots="noindex, nofollow" />
      {adminView ? (
        <div className="sticky top-0 z-40 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p className="font-semibold">Admin view — {customerName || '…'} · {customerEmail || '…'}</p>
            <Link to="/admin/customers" className="font-bold text-amber-950 underline">Back to Customers</Link>
          </div>
        </div>
      ) : null}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between gap-2 px-3 sm:gap-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-700 xl:hidden"
            aria-expanded={menuOpen}
            aria-label="Account menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MenuIcon />
          </button>
          <Link to={portalTo('/portal/bookings')} className="block min-w-0 max-w-[8.5rem] sm:max-w-[15rem] [&_img]:!h-9 [&_img]:!max-w-full [&_img]:sm:!h-11" aria-label="ShiftMyHome">
            <Logo />
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          {customerName ? (
            <span className="max-w-[8.5rem] truncate text-sm font-semibold text-slate-900 sm:max-w-[16rem]">{customerName}</span>
          ) : null}
          <Link to="/" className="hidden items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 sm:inline-flex">
            Back to website
            <ExternalIcon />
          </Link>
          <div className="relative">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500"
              aria-label="Account"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((open) => !open)}
            >
              <PersonIcon />
            </button>
            {accountOpen ? (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                <Link to={portalTo('/portal/account')} className="block px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => setAccountOpen(false)}>
                  Account settings
                </Link>
                {adminView ? null : (
                  <button type="button" className="block w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={signOut}>
                    Sign out
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
        </div>
        <div className="border-t border-slate-100 px-3 sm:px-5">
          <Link to={portalTo('/portal/bookings')} className="inline-flex min-h-11 items-center text-sm font-bold text-sky-700">
            My account
          </Link>
        </div>
        <div className="border-t border-slate-100 px-3 py-1 sm:hidden">
          <Link to="/" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-slate-700">
            Back to website
            <ExternalIcon />
          </Link>
        </div>
      </header>

      <nav className="border-b border-slate-200 bg-white px-3 py-3 xl:hidden" aria-label="Account">
        {customerName ? <p className="pb-1 text-sm font-bold text-slate-900">{customerName}</p> : null}
        <p className="pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">My account</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {NAV.map((item) => (
            <NavLink
              key={item.label}
              to={portalTo(item.to)}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-12 min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold leading-tight ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'bg-slate-50 text-slate-700'
                }`
              }
            >
              <NavIcon name={item.icon} />
              <span className="min-w-0 break-words">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="xl:flex xl:items-stretch">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white xl:flex xl:min-h-[calc(100vh-4rem)]">
            <SideNav onSignOut={adminView ? null : signOut} customerName={customerName} portalTo={portalTo} />
        </aside>
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 xl:px-8 xl:py-7">
          {requireSession && !ready ? <p className="text-sm text-slate-500">Loading your bookings…</p> : children}
        </main>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 xl:hidden">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[min(100%,18rem)] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <Logo />
              <button type="button" className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-600" onClick={() => setMenuOpen(false)}>
                Close
              </button>
            </div>
            <SideNav onSignOut={adminView ? null : signOut} customerName={customerName} portalTo={portalTo} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      ) : null}
    </div>
  )
}

function SideNav({ onSignOut, onNavigate, customerName = '', portalTo = (path) => path }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {customerName ? <p className="px-5 pb-1 pt-5 text-sm font-bold text-slate-900">{customerName}</p> : null}
      <p className={`px-5 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 ${customerName ? 'pt-1' : 'pt-5'}`}>My account</p>
      <nav className="flex flex-col gap-1 px-3" aria-label="Account">
        {NAV.map((item) => (
          <NavLink
            key={item.label}
            to={portalTo(item.to)}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
              }`
            }
          >
            <NavIcon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      {onSignOut ? (
        <button
          type="button"
          onClick={onSignOut}
          className="mx-3 mb-4 mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          <NavIcon name="signout" />
          Sign out
        </button>
      ) : (
        <div className="mt-auto" />
      )}
    </div>
  )
}

function NavIcon({ name }) {
  const common = 'h-5 w-5 shrink-0'
  if (name === 'plus') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v8M8 12h8" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'settings') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'help') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="12" cy="12" r="8" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.7.3-1.2.9-1.2 1.6V14" strokeLinecap="round" />
        <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  if (name === 'signout') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M10 7V5a1 1 0 0 1 1-1h7v16h-7a1 1 0 0 1-1-1v-2" strokeLinecap="round" />
        <path d="M4 12h10M11 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M7 4h8a2 2 0 0 1 2 2v14l-6-3-6 3V6a2 2 0 0 1 2-2Z" strokeLinejoin="round" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="8" r="3" />
      <path d="M6 19c1.2-2.5 3.2-3.8 6-3.8S16.8 16.5 18 19" strokeLinecap="round" />
    </svg>
  )
}

function ExternalIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M14 5h5v5M19 5l-8 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5" strokeLinecap="round" />
    </svg>
  )
}
