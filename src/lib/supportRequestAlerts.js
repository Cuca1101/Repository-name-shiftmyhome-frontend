/**
 * Admin browser alerts for new driver support requests.
 * Uses local WAV assets; unlock after a user gesture (autoplay policy).
 */

const STORAGE_UNLOCKED = 'shiftmyhome.supportRequests.soundUnlocked'
const NORMAL_SOUND_URL = '/sounds/notify_modern.wav'
const URGENT_SOUND_URL = '/sounds/notify_urgent.wav'

/** @returns {boolean} */
export function readSupportRequestSoundUnlocked() {
  try {
    return localStorage.getItem(STORAGE_UNLOCKED) === '1'
  } catch {
    return false
  }
}

function writeSupportRequestSoundUnlocked() {
  try {
    localStorage.setItem(STORAGE_UNLOCKED, '1')
  } catch {
    /* ignore */
  }
}

/** @type {HTMLAudioElement | null} */
let normalAudio = null
/** @type {HTMLAudioElement | null} */
let urgentAudio = null

function getNormalAudio() {
  if (typeof window === 'undefined') return null
  if (!normalAudio) {
    normalAudio = new Audio(NORMAL_SOUND_URL)
    normalAudio.preload = 'auto'
  }
  return normalAudio
}

function getUrgentAudio() {
  if (typeof window === 'undefined') return null
  if (!urgentAudio) {
    urgentAudio = new Audio(URGENT_SOUND_URL)
    urgentAudio.preload = 'auto'
  }
  return urgentAudio
}

function playBeepFallback(urgent = false) {
  if (typeof window === 'undefined') return
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = urgent ? 660 : 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(urgent ? 0.32 : 0.22, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (urgent ? 0.45 : 0.2))
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + (urgent ? 0.5 : 0.22))
    osc.onended = () => void ctx.close()
  } catch {
    /* ignore */
  }
}

/**
 * Call once after admin gesture to satisfy autoplay policy.
 * @returns {Promise<boolean>}
 */
export async function unlockSupportRequestSound() {
  const audio = getNormalAudio()
  if (!audio) return false
  try {
    audio.volume = 0.4
    await audio.play()
    audio.pause()
    audio.currentTime = 0
    writeSupportRequestSoundUnlocked()
    return true
  } catch {
    playBeepFallback(false)
    writeSupportRequestSoundUnlocked()
    return true
  }
}

/**
 * @param {{ urgent?: boolean }} [opts]
 * @returns {Promise<void>}
 */
export async function playSupportRequestAlertSound(opts = {}) {
  if (!readSupportRequestSoundUnlocked()) return
  const urgent = Boolean(opts.urgent)
  const audio = urgent ? getUrgentAudio() : getNormalAudio()
  if (!audio) return
  try {
    audio.currentTime = 0
    audio.volume = urgent ? 0.7 : 0.5
    await audio.play()
  } catch {
    playBeepFallback(urgent)
  }
}

/**
 * Browser Notification API when permitted.
 * @param {{ title: string, body: string, urgent?: boolean, onClick?: () => void }} opts
 */
export function showSupportRequestBrowserNotification(opts) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  try {
    const n = new Notification(opts.title, {
      body: opts.body,
      tag: opts.urgent ? 'smh-support-urgent' : 'smh-support',
      requireInteraction: Boolean(opts.urgent),
    })
    if (opts.onClick) {
      n.onclick = () => {
        window.focus()
        opts.onClick()
        n.close()
      }
    }
  } catch {
    /* ignore */
  }
}

/** Request notification permission once (no-op if already decided). */
export function ensureSupportRequestNotificationPermission() {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return
  if (Notification.permission === 'default') {
    void Notification.requestPermission()
  }
}
