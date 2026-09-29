import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import CallHistoryPanel from '../components/admin/CallHistoryPanel'
import ContactsPanel from '../components/admin/ContactsPanel'
import {
  amazonConnectNeedsLogin,
  mountAmazonConnectCcp,
  openAmazonConnectLoginPopup,
  placeOutboundCall,
  retryAmazonConnectCcp,
} from '../lib/amazonConnectCcp'
import { subscribeCallUi } from '../lib/callUiBus'
import { subscribeOutboundCall, takeOutboundCall } from '../lib/outboundCall'

const CALL_PHASE_LABEL = {
  preparing: 'Preparing call',
  calling: 'Calling',
  ringing: 'Ringing',
  connected: 'Connected',
  ended: 'Call ended',
  failed: 'Call failed',
}

function formatElapsed(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

function LiveCallsPanel({ active }) {
  const slotRef = useRef(null)
  const signedInRef = useRef(false)
  const [phase, setPhase] = useState('loading')
  const [loginRequired, setLoginRequired] = useState(false)
  const [popupBlocked, setPopupBlocked] = useState(false)
  const [storageBlocked, setStorageBlocked] = useState(false)
  const [microphoneRequired, setMicrophoneRequired] = useState(false)
  const [error, setError] = useState('')
  const [callUi, setCallUi] = useState({ phase: 'idle', name: '', phone: '', startedAt: null, message: '' })
  const [elapsed, setElapsed] = useState(0)

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
          setPhase('ready')
        },
        onLoginRequired() {
          if (!signedInRef.current) setLoginRequired(true)
        },
        onStorageBlocked() {
          setStorageBlocked(true)
        },
      })
      setError('')
      if (!signedInRef.current && amazonConnectNeedsLogin()) setLoginRequired(true)

      const iframe = slot.querySelector('iframe')
      const reveal = () => {
        if (iframe) iframe.dataset.smhCcpLoaded = 'true'
        setPhase('ready')
        setError('')
      }
      const fail = () => {
        setPhase('error')
        setError('Amazon Connect could not be loaded in this page.')
      }
      if (!iframe) {
        fail()
      } else if (iframe.dataset.smhCcpLoaded === 'true') {
        reveal()
      } else {
        iframe.addEventListener('load', reveal)
        iframe.addEventListener('error', fail)
        const timer = window.setTimeout(() => {
          if (iframe.dataset.smhCcpLoaded === 'true') return
          fail()
        }, 12000)
        const stop = release
        release = () => {
          iframe.removeEventListener('load', reveal)
          iframe.removeEventListener('error', fail)
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

  useEffect(() => subscribeCallUi(setCallUi), [])

  useEffect(() => {
    if (callUi.phase !== 'connected' || !callUi.startedAt) {
      setElapsed(0)
      return undefined
    }
    const tick = () => setElapsed(Math.floor((Date.now() - callUi.startedAt) / 1000))
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [callUi.phase, callUi.startedAt])

  useEffect(() => {
    let cancelled = false
    const permissions = navigator.permissions
    if (!permissions?.query) return undefined
    permissions
      .query({ name: 'microphone' })
      .then((status) => {
        if (cancelled) return
        const apply = () => setMicrophoneRequired(status.state === 'denied')
        apply()
        status.onchange = apply
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  function handleOpenLogin() {
    const opened = openAmazonConnectLoginPopup()
    setPopupBlocked(!opened)
    if (opened) setLoginRequired(true)
  }

  function handleRetry() {
    const slot = slotRef.current
    if (!slot) return
    setPhase('loading')
    setError('')
    const opened = retryAmazonConnectCcp(slot)
    setPopupBlocked(!opened)
    const iframe = slot.querySelector('iframe')
    if (!iframe) {
      setPhase('error')
      setError('Amazon Connect could not be loaded in this page.')
      return
    }
    if (iframe.dataset.smhCcpLoaded === 'true') {
      setPhase('ready')
      return
    }
    const reveal = () => {
      iframe.dataset.smhCcpLoaded = 'true'
      setPhase('ready')
      setError('')
    }
    iframe.addEventListener('load', reveal, { once: true })
    window.setTimeout(() => {
      if (iframe.dataset.smhCcpLoaded === 'true') return
      setPhase('error')
      setError('Amazon Connect could not be loaded in this page.')
    }, 12000)
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
        <p className="text-sm font-semibold text-slate-700" role="status">
          {phase === 'loading'
            ? 'Loading Amazon Connect'
            : phase === 'error'
              ? 'Connection failed'
              : loginRequired
                ? popupBlocked
                  ? 'Pop-up blocked'
                  : 'Complete login in the Amazon popup'
                : 'Connected'}
        </p>
        {callUi.phase !== 'idle' ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm" role="status">
            <p className="font-semibold">{CALL_PHASE_LABEL[callUi.phase] || 'Calling'}</p>
            {callUi.name ? <p className="mt-1">{callUi.name}</p> : null}
            {callUi.phone ? <p className="font-mono text-xs">{callUi.phone}</p> : null}
            {callUi.phase === 'connected' ? <p className="mt-1">Duration {formatElapsed(elapsed)}</p> : null}
            {callUi.phase === 'failed' && callUi.message ? <p className="mt-1 text-red-800">{callUi.message}</p> : null}
            {callUi.phase === 'connected' || callUi.phase === 'ringing' || callUi.phase === 'calling' ? (
              <p className="mt-2 text-xs text-slate-500">End the call from the Amazon phone panel.</p>
            ) : null}
          </div>
        ) : null}
        {microphoneRequired ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
            Microphone permission required. Allow the microphone for this site in your browser settings, then choose Retry connection.
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            <p>Connection failed. {error}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={handleOpenLogin} className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900">
                Open sign-in window
              </button>
              <button type="button" onClick={handleRetry} className="inline-flex min-h-[40px] items-center rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white">
                Retry connection
              </button>
            </div>
          </div>
        ) : null}

        {loginRequired && !error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
            <p className="font-semibold">{popupBlocked ? 'Pop-up blocked' : 'Sign in required'}</p>
            <p className="mt-1">
              {popupBlocked
                ? 'Your browser blocked the Amazon sign-in window. Allow pop-ups for this site, then open the sign-in window again.'
                : 'Complete login in the Amazon popup. After Amazon signs you in, the window closes and the phone stays on this page.'}
            </p>
            {storageBlocked ? (
              <p className="mt-2">
                Third-party cookies are blocking the embedded phone. In your browser settings, allow third-party cookies for this site, or allow cookies from shiftmyhome.my.connect.aws, then choose Retry connection. ShiftMyHome cannot bypass this browser protection.
              </p>
            ) : (
              <p className="mt-2">
                If the popup signs you in and this phone still asks you to sign in, third-party cookies are blocked. Allow cookies from shiftmyhome.my.connect.aws for this site, then choose Retry connection.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={handleOpenLogin} className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900">
                Open sign-in window
              </button>
              <button type="button" onClick={handleRetry} className="inline-flex min-h-[40px] items-center rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white">
                Retry connection
              </button>
            </div>
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
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab = requested === 'history' || requested === 'contacts' ? requested : 'live'
  const [dialNote, setDialNote] = useState('')

  function selectTab(next) {
    const nextParams = new URLSearchParams(params)
    if (next === 'live') nextParams.delete('tab')
    else nextParams.set('tab', next)
    setParams(nextParams, { replace: true })
  }

  useEffect(() => {
    let cancelled = false
    async function dial(request) {
      if (!request?.e164) return
      selectTab('live')
      setDialNote('')
      const result = await placeOutboundCall({ name: request.name, phone: request.e164 })
      if (!cancelled && !result.ok && result.code !== 'busy') setDialNote(result.message || 'Call failed')
    }
    const pending = takeOutboundCall()
    if (pending) dial(pending)
    const unsubscribe = subscribeOutboundCall(dial)
    return () => {
      cancelled = true
      unsubscribe()
    }
    // The dialler is registered once for this page. Tab changes do not create another CCP.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      <div className="admin-surface">
        <h2 className="text-base font-bold tracking-tight text-slate-900 xxs:text-lg sm:text-2xl">Call Centre</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Amazon Connect phone panel for authorised agents. Sign in, choose Available, and answer or place calls
          in the browser. Allow the microphone and speakers when prompted. A camera is not required. Amazon Connect
          passwords stay in the Amazon login window and are not stored by ShiftMyHome.
        </p>
        {dialNote ? <p className="mt-3 text-sm text-red-800">{dialNote}</p> : null}
        <div className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Call Centre">
          <button
            type="button"
            role="tab"
            id="call-centre-tab-live"
            aria-selected={tab === 'live'}
            aria-controls="call-centre-panel-live"
            onClick={() => selectTab('live')}
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
            onClick={() => selectTab('history')}
            className={`min-h-[40px] flex-1 rounded-lg px-3 text-sm font-semibold transition ${
              tab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Call History
          </button>
          <button
            type="button"
            role="tab"
            id="call-centre-tab-contacts"
            aria-selected={tab === 'contacts'}
            aria-controls="call-centre-panel-contacts"
            onClick={() => selectTab('contacts')}
            className={`min-h-[40px] flex-1 rounded-lg px-3 text-sm font-semibold transition ${
              tab === 'contacts' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Contacts
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
      {tab === 'contacts' ? (
        <div id="call-centre-panel-contacts" role="tabpanel" aria-labelledby="call-centre-tab-contacts">
          <ContactsPanel onCall={() => selectTab('live')} />
        </div>
      ) : null}
    </div>
  )
}
