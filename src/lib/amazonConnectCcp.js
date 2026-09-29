import 'amazon-connect-streams'
import { publishCallUi, readCallUi } from './callUiBus'

/** Public CCP URL. Agent sign-in happens in Amazon's own popup. This app does not store Connect credentials. */
export const AMAZON_CONNECT_CCP_URL = 'https://shiftmyhome.my.connect.aws/ccp-v2/'

const HOST_ID = 'smh-amazon-connect-ccp-host'
const PARK_ID = 'smh-amazon-connect-ccp-park'

/** Survives React Strict Mode remounts and in-app navigation. */
let initStarted = false
/** Set when Connect asks the agent to authenticate, so the banner can return with the route. */
let loginRequiredSeen = false
const callEndedListeners = new Set()
let callEndedBound = false
let callEndedTimer = 0
let dialLock = false

const CCP_INIT_OPTIONS = {
  ccpUrl: AMAZON_CONNECT_CCP_URL,
  loginPopup: true,
  loginPopupAutoClose: true,
  loginOptions: {
    autoClose: true,
    height: 600,
    width: 400,
    top: 0,
    left: 0,
  },
  region: 'eu-west-2',
  softphone: {
    allowFramedSoftphone: true,
    allowFramedVideoCall: false,
    disableRingtone: false,
    allowEarlyGum: true,
  },
  pageOptions: {
    enableAudioDeviceSettings: true,
    enablePhoneTypeSettings: true,
  },
  storageAccess: {
    canRequest: true,
  },
}

function getConnect() {
  return globalThis.connect
}

function getCcpHostElement() {
  let host = document.getElementById(HOST_ID)
  if (!host) {
    host = document.createElement('div')
    host.id = HOST_ID
    host.setAttribute('data-amazon-connect-ccp', '')
  }
  host.style.width = '100%'
  host.style.height = '100%'
  return host
}

function getParkElement() {
  let park = document.getElementById(PARK_ID)
  if (!park) {
    park = document.createElement('div')
    park.id = PARK_ID
    park.setAttribute('aria-hidden', 'true')
    park.style.position = 'fixed'
    park.style.left = '-10000px'
    park.style.top = '0'
    park.style.width = '400px'
    park.style.height = '600px'
    park.style.overflow = 'hidden'
    park.style.opacity = '0'
    park.style.pointerEvents = 'none'
    document.body.appendChild(park)
  }
  return park
}

/**
 * Keep the CCP iframe in the document when the route unmounts.
 * Removing it would tear down the softphone, and initCCP will not create a second one.
 */
export function parkAmazonConnectCcp() {
  const host = document.getElementById(HOST_ID)
  if (!host) return
  getParkElement().appendChild(host)
}

function allowCcpMedia(host) {
  const iframe = host.querySelector('iframe')
  if (!iframe) return
  const current = new Set(
    (iframe.getAttribute('allow') || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean),
  )
  current.delete('camera')
  for (const item of ['microphone', 'autoplay', 'speaker-selection', 'clipboard-write', 'identity-credentials-get']) {
    current.add(item)
  }
  const next = [...current].join('; ')
  if (iframe.getAttribute('allow') !== next) iframe.setAttribute('allow', next)
}

function watchCcpAllow(host) {
  allowCcpMedia(host)
  if (host.dataset.smhAllowWatch === '1') return
  host.dataset.smhAllowWatch = '1'
  const observer = new MutationObserver(() => allowCcpMedia(host))
  observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['allow'] })
}

function notifyCallEnded() {
  window.clearTimeout(callEndedTimer)
  callEndedTimer = window.setTimeout(() => {
    for (const listener of callEndedListeners) listener()
  }, 1500)
}

function safeConnectError(error) {
  const raw = String(error?.message || error?.type || error || 'The call could not be started.')
  if (/akia|secret|password|aws_access|token|arn:aws/i.test(raw)) return 'Amazon Connect rejected the call.'
  return raw.slice(0, 240)
}

function voiceContacts(agent) {
  const list = typeof agent?.getContacts === 'function' ? agent.getContacts() : []
  return list.filter((contact) => String(contact?.getType?.() || '').toLowerCase() === 'voice')
}

function contactIsActive(contact) {
  const status = String(contact?.getStatus?.().type || '').toLowerCase()
  return status && status !== 'ended' && status !== 'error' && status !== 'missed' && status !== 'rejected'
}

/** Place a normal agent-initiated voice call on the signed-in Connect session. */
export async function placeOutboundCall({ name, phone }) {
  if (dialLock) return { ok: false, code: 'busy', message: 'A call is already being started.' }
  dialLock = true
  publishCallUi({ phase: 'preparing', name: name || '', phone, startedAt: null, message: '' })
  try {
    const connect = getConnect()
    if (!connect?.core?.initialized || !connect.agent || !connect.Endpoint?.byPhoneNumber) {
      openAmazonConnectLoginPopup()
      const message = 'Sign in to Amazon Connect before calling.'
      publishCallUi({ phase: 'failed', message })
      return { ok: false, code: 'auth', message }
    }
    const agent = await new Promise((resolve) => connect.agent(resolve))
    if (!agent) {
      const message = 'The Amazon Connect agent session is not ready.'
      publishCallUi({ phase: 'failed', message })
      return { ok: false, message }
    }
    const stateName = String(agent.getState?.().type || agent.getState?.().name || '').toLowerCase()
    if (stateName === 'offline') {
      const message = 'Change your status to Available before calling.'
      publishCallUi({ phase: 'failed', message })
      return { ok: false, code: 'offline', message }
    }
    if (voiceContacts(agent).some(contactIsActive)) {
      const message = 'Finish the current voice call before starting another.'
      publishCallUi({ phase: 'failed', message })
      return { ok: false, message }
    }
    const endpoint = connect.Endpoint.byPhoneNumber(phone)
    await new Promise((resolve, reject) => {
      agent.connect(endpoint, {
        success: () => resolve(),
        failure: (error) => reject(error),
      })
    })
    publishCallUi({ phase: 'calling', name: name || '', phone, message: '' })
    return { ok: true }
  } catch (error) {
    const message = safeConnectError(error)
    publishCallUi({ phase: 'failed', message })
    return { ok: false, message }
  } finally {
    dialLock = false
  }
}

function bindCallEndedOnce() {
  if (callEndedBound) return
  const connect = getConnect()
  if (typeof connect?.contact !== 'function') return
  callEndedBound = true
  connect.contact((contact) => {
    const notify = () => notifyCallEnded()
    for (const name of ['onEnded', 'onACW', 'onMissed']) {
      if (typeof contact?.[name] === 'function') contact[name](notify)
    }
    const type = String(contact?.getType?.() || '').toLowerCase()
    if (type && type !== 'voice') return
    if (typeof contact?.onConnecting === 'function') contact.onConnecting(() => publishCallUi({ phase: 'ringing' }))
    if (typeof contact?.onConnected === 'function') {
      contact.onConnected(() => publishCallUi({ phase: 'connected', startedAt: readCallUi().startedAt || Date.now() }))
    }
    if (typeof contact?.onEnded === 'function') contact.onEnded(() => publishCallUi({ phase: 'ended', startedAt: null }))
  })
}

/** Refresh Call History once a live call finishes. Does not start a second CCP. */
export function subscribeAmazonConnectCallEnded(listener) {
  bindCallEndedOnce()
  callEndedListeners.add(listener)
  return () => {
    callEndedListeners.delete(listener)
  }
}

function ensureCcpInitialized(host) {
  const connect = getConnect()
  if (!connect?.core?.initCCP) {
    throw new Error('Amazon Connect Streams did not load.')
  }
  if (initStarted || connect.core.initialized || host.querySelector('iframe')) {
    initStarted = true
    return
  }
  initStarted = true
  try {
    connect.core.initCCP(host, {
      ...CCP_INIT_OPTIONS,
      loginOptions: { ...CCP_INIT_OPTIONS.loginOptions },
      softphone: { ...CCP_INIT_OPTIONS.softphone },
      pageOptions: { ...CCP_INIT_OPTIONS.pageOptions },
      storageAccess: { ...CCP_INIT_OPTIONS.storageAccess },
    })
  } catch (error) {
    initStarted = false
    throw error
  }
  watchCcpAllow(host)
}

export function amazonConnectNeedsLogin() {
  return loginRequiredSeen && !getConnect()?.agent?.initialized
}

function unsubscribeAll(subs) {
  for (const sub of subs) {
    if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe()
  }
}

/**
 * @param {HTMLElement} slot
 * @param {{ onSignedIn?: () => void, onLoginRequired?: () => void }} handlers
 * @returns {() => void}
 */
export function mountAmazonConnectCcp(slot, handlers = {}) {
  const host = getCcpHostElement()
  if (host.parentElement !== slot) slot.appendChild(host)
  ensureCcpInitialized(host)
  watchCcpAllow(host)
  bindCallEndedOnce()

  const connect = getConnect()
  const subs = []
  const markSignedIn = () => {
    loginRequiredSeen = false
    handlers.onSignedIn?.()
  }
  const markLoginRequired = () => {
    loginRequiredSeen = true
    handlers.onLoginRequired?.()
  }
  if (connect?.agent) subs.push(connect.agent(markSignedIn))
  if (connect?.core?.onAuthFail) subs.push(connect.core.onAuthFail(markLoginRequired))
  if (connect?.core?.getEventBus && connect.EventType) {
    subs.push(connect.core.getEventBus().subscribe(connect.EventType.ACK_TIMEOUT, markLoginRequired))
  }
  if (typeof connect?.storageAccess?.onRequest === 'function') {
    const storageSub = connect.storageAccess.onRequest({
      onDeny() {
        handlers.onStorageBlocked?.()
      },
    })
    if (storageSub) subs.push(storageSub)
  }

  return () => {
    unsubscribeAll(subs)
    if (host.parentElement === slot) parkAmazonConnectCcp()
  }
}

/** Try the embedded CCP again without starting a second one while it is already signed in. */
export function retryAmazonConnectCcp(slot) {
  const connect = getConnect()
  const host = getCcpHostElement()
  if (host.parentElement !== slot) slot.appendChild(host)
  if (!connect?.core?.initialized) {
    host.querySelector('iframe')?.remove()
    initStarted = false
    ensureCcpInitialized(host)
  }
  watchCcpAllow(host)
  bindCallEndedOnce()
  if (!connect?.agent?.initialized) return openAmazonConnectLoginPopup()
  return true
}

/** Focus the Connect login popup, or open it after a click if the browser blocked the first one. */
export function openAmazonConnectLoginPopup() {
  const connect = getConnect()
  const existing = connect?.core?.loginWindow
  if (existing && !existing.closed) {
    existing.focus()
    return true
  }
  const popup = window.open(
    AMAZON_CONNECT_CCP_URL,
    'AmazonConnectLogin',
    'popup=yes,width=400,height=600,left=80,top=80',
  )
  if (!popup) return false
  if (connect?.core) connect.core.loginWindow = popup
  return true
}
