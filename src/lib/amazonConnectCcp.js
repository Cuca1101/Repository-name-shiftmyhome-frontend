import 'amazon-connect-streams'

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
    disableRingtone: false,
    allowEarlyGum: true,
  },
  pageOptions: {
    enableAudioDeviceSettings: true,
    enablePhoneTypeSettings: true,
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
  for (const item of ['microphone', 'autoplay', 'speaker-selection']) current.add(item)
  iframe.setAttribute('allow', [...current].join('; '))
}

function notifyCallEnded() {
  window.clearTimeout(callEndedTimer)
  callEndedTimer = window.setTimeout(() => {
    for (const listener of callEndedListeners) listener()
  }, 1500)
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
    connect.core.initCCP(host, CCP_INIT_OPTIONS)
  } catch (error) {
    initStarted = false
    throw error
  }
  allowCcpMedia(host)
  window.requestAnimationFrame(() => allowCcpMedia(host))
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
  allowCcpMedia(host)
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

  return () => {
    unsubscribeAll(subs)
    if (host.parentElement === slot) parkAmazonConnectCcp()
  }
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
