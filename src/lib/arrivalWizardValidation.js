import {
  isFlexibleWindowValid,
  isValidHalfHourSlot,
} from './arrivalTimeSlots'

/** Unified Step 1 arrival validation (mobile + desktop). */
export function isWizardArrivalValid(wizard) {
  if (!wizard) return false
  if (wizard.arrivalWindow === 'flex_window') {
    return isFlexibleWindowValid(wizard.flexibleArrivalFrom, wizard.flexibleArrivalUntil)
  }
  if (wizard.arrivalWindow === 'exact') {
    return isValidHalfHourSlot((wizard.exactArrivalTime || '').trim())
  }
  return false
}

/** User-facing error when arrival is incomplete. */
export function wizardArrivalErrorMessage(wizard) {
  if (wizard?.arrivalWindow === 'flex_window') {
    return 'Please select both flexible from and until times (from must be earlier than until).'
  }
  if (wizard?.arrivalWindow === 'exact') {
    return 'Please select your exact arrival time.'
  }
  return 'Please choose a preferred arrival option.'
}
