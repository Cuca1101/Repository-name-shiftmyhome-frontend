/** 30-minute slots from 08:00 through 20:00 inclusive. */
export const HALF_HOUR_SLOTS_TO_20 = (() => {
  const slots = []
  for (let hour = 8; hour <= 20; hour++) {
    for (const minute of [0, 30]) {
      if (hour === 20 && minute === 30) break
      const hh = String(hour).padStart(2, '0')
      const mm = String(minute).padStart(2, '0')
      slots.push(`${hh}:${mm}`)
    }
  }
  return slots
})()

/** @param {string} time HH:mm */
export function timeSlotToMinutes(time) {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10))
  return h * 60 + m
}

/** @param {string} time */
export function isValidHalfHourSlot(time) {
  return HALF_HOUR_SLOTS_TO_20.includes(time)
}

export function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
}

/** @param {string} from HH:mm @param {string} until HH:mm */
export function isFlexibleWindowValid(from, until) {
  if (!from || !until || !isValidHalfHourSlot(from) || !isValidHalfHourSlot(until)) return false
  return timeSlotToMinutes(from) < timeSlotToMinutes(until)
}

/** Slots strictly after `from` (for Flexible until dropdown). */
export function halfHourSlotsAfter(from) {
  if (!from || !isValidHalfHourSlot(from)) return HALF_HOUR_SLOTS_TO_20
  const min = timeSlotToMinutes(from)
  return HALF_HOUR_SLOTS_TO_20.filter((t) => timeSlotToMinutes(t) > min)
}
