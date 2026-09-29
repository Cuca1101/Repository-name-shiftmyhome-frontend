import { useLayoutEffect, useRef, useState } from 'react'
import CallHistoryPanel from '../components/admin/CallHistoryPanel'
import {
  amazonConnectNeedsLogin,
  mountAmazonConnectCcp,
  openAmazonConnectLoginPopup,
} from '../lib/amazonConnectCcp'

function LiveCallsPanel({ active }) {
  const slotRef = useRef(null)
  const signedInRef = useRef(false)
  const [phase, setPhase] = useState('loading')
  const [loginRequired, setLoginRequired] = useState(false)
  const [popupBlocked, setPopupBlocked] = useState(false)
  const [error, setError] = useState('')

  useLayoutEffect(() => {
    const slot = slotRef.current
    if (!slot) return undefined

    signedInRef.current = false
    let release = () => {}

    try {
      release = mountAmazonConnectCcp(slot, {
        onSignedIn() {
          signedInRef.current = true
          setLoginRequired(false)
          setPopupBlocked(false)
          setError('')
        },
        onLoginRequired() {
          if (!signedInRef.current) setLoginRequired(true)
        },
      })
      setError('')
      if (!signedInRef.current && amazonConnectNeedsLogin()) setLoginRequired(true)

      const iframe = slot.querySelector('iframe')
      const reveal = () => setPhase('ready')
      if (!iframe || iframe.dataset.smhCcpLoaded === 'true') {
        reveal()
      } else {
        const onLoad = () => {
          iframe.dataset.smhCcpLoaded = 'true'
          reveal()
        }
        iframe.addEventListener('load', onLoad)
        const timer = window.setTimeout(onLoad, 12000)
        const stop = release
        release = () => {
          iframe.removeEventListener('load', onLoad)
          window.clearTimeout(timer)
          stop()
        }
      }
    } catch (err) {
      console.error('Amazon Connect CCP initialisation failed', err)
      setPhase('error')
      setError('Amazon Connect could not be loaded. Refresh the page and try again.')
    }

    return () => {
      release()
    }
  }, [])

  function handleOpenLogin() {
    const opened = openAmazonConnectLoginPopup()
    setPopupBlocked(!opened)
    if (opened) setLoginRequired(true)
  }

  return (
    <div
      className={
        active
          ? undefined
          : 'pointer-events-none fixed top-0 -z-10 w-[32rem] -translate-x-[120vw] opacity-0'
      }
      inert={active ? undefined : true}
      aria-hidden={active ? undefined : true}
    >
      <div className="space-y-4">
        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        {loginRequired && !error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
            <p>Complete the Amazon Connect login popup to sign in.</p>
            {popupBlocked ? (
              <p className="mt-2">Your browser blocked the sign-in window. Allow pop-ups for this site, then try again.</p>
            ) : (
              <p className="mt-2 text-amber-900/80">
                If you do not see the window, allow pop-ups for this site and open it again.
              </p>
            )}
            <button
              type="button"
              onClick={handleOpenLogin}
              className="mt-3 inline-flex min-h-[40px] items-center rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Open sign-in window
            </button>
          </div>
        ) : null}

        <div className="mx-auto w-full max-w-xl">
          <div className="relative h-[min(820px,calc(100dvh-12.5rem))] min-h-[32rem] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            {phase === 'loading' ? (
              <div className="absolute inset-0 z-10 flex items-center gap-3 bg-white p-8 text-slate-500">
                <span
                  className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600"
                  aria-hidden
                />
                Loading Amazon Connect…
              </div>
            ) : null}
            <div ref={slotRef} className="h-full w-full" aria-busy={phase === 'loading'} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminCallCentrePage() {
  const [tab, setTab] = useState('live')

  return (
    <div className="space-y-4">
      <div className="admin-surface">
        <h2 className="text-base font-bold tracking-tight text-slate-900 xxs:text-lg sm:text-2xl">Call Centre</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Amazon Connect phone panel for authorised agents. Sign in, choose Available or Offline, and answer calls
          in the browser. Allow the microphone and speakers when prompted. Amazon Connect passwords stay in the
          Amazon login window and are not stored by ShiftMyHome. Use Call History to review earlier calls.
        </p>
        <div className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Call Centre">
          <button
            type="button"
            role="tab"
            id="call-centre-tab-live"
            aria-selected={tab === 'live'}
            aria-controls="call-centre-panel-live"
            onClick={() => setTab('live')}
            className={`min-h-[40px] flex-1 rounded-lg px-3 text-sm font-semibold transition ${
              tab === 'live' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Live Calls
          </button>
          <button
            type="button"
            role="tab"
            id="call-centre-tab-history"
            aria-selected={tab === 'history'}
            aria-controls="call-centre-panel-history"
            onClick={() => setTab('history')}
            className={`min-h-[40px] flex-1 rounded-lg px-3 text-sm font-semibold transition ${
              tab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Call History
          </button>
        </div>
      </div>

      <div
        id="call-centre-panel-live"
        role="tabpanel"
        aria-labelledby="call-centre-tab-live"
        aria-hidden={tab === 'live' ? undefined : true}
      >
        <LiveCallsPanel active={tab === 'live'} />
      </div>
      {tab === 'history' ? (
        <div id="call-centre-panel-history" role="tabpanel" aria-labelledby="call-centre-tab-history">
          <CallHistoryPanel />
        </div>
      ) : null}
    </div>
  )
}
