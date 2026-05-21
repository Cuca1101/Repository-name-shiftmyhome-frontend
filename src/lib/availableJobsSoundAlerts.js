const STORAGE_ENABLED = 'shiftmyhome.availableJobs.soundEnabled'
const STORAGE_UNLOCKED = 'shiftmyhome.availableJobs.soundUnlocked'
const SOUND_URL = '/sounds/available-job-alert.wav'

/** @returns {boolean} */
export function readAvailableJobsSoundEnabled() {
  try {
    return localStorage.getItem(STORAGE_ENABLED) === '1'
  } catch {
    return false
  }
}

/** @param {boolean} on */
export function writeAvailableJobsSoundEnabled(on) {
  try {
    localStorage.setItem(STORAGE_ENABLED, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/** @returns {boolean} */
export function readAvailableJobsSoundUnlocked() {
  try {
    return localStorage.getItem(STORAGE_UNLOCKED) === '1'
  } catch {
    return false
  }
}

function writeAvailableJobsSoundUnlocked() {
  try {
    localStorage.setItem(STORAGE_UNLOCKED, '1')
  } catch {
    /* ignore */
  }
}

/** @type {HTMLAudioElement | null} */
let audioEl = null

function getAudio() {
  if (typeof window === 'undefined') return null
  if (!audioEl) {
    audioEl = new Audio(SOUND_URL)
    audioEl.preload = 'auto'
  }
  return audioEl
}

/** Web Audio fallback when file missing or blocked. */
function playBeepFallback() {
  if (typeof window === 'undefined') return
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.18)
    osc.onended = () => void ctx.close()
  } catch {
    /* ignore */
  }
}

/**
 * Call once after admin gesture to satisfy autoplay policy.
 * @returns {Promise<boolean>}
 */
export async function unlockAvailableJobsSound() {
  const audio = getAudio()
  if (!audio) return false
  try {
    audio.volume = 0.5
    await audio.play()
    audio.pause()
    audio.currentTime = 0
    writeAvailableJobsSoundUnlocked()
    writeAvailableJobsSoundEnabled(true)
    return true
  } catch {
    playBeepFallback()
    writeAvailableJobsSoundUnlocked()
    writeAvailableJobsSoundEnabled(true)
    return true
  }
}

/** @returns {Promise<void>} */
export async function playAvailableJobsAlertSound() {
  if (!readAvailableJobsSoundEnabled() || !readAvailableJobsSoundUnlocked()) return
  const audio = getAudio()
  if (!audio) return
  try {
    audio.currentTime = 0
    audio.volume = 0.55
    await audio.play()
  } catch {
    playBeepFallback()
  }
}
