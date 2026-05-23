/** Dispatched after admin pricing settings are saved successfully. */
export const PRICING_SETTINGS_UPDATED_EVENT = 'pricing-settings-updated'

export function dispatchPricingSettingsUpdated() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PRICING_SETTINGS_UPDATED_EVENT))
}

/**
 * @param {() => void | Promise<void>} handler
 * @returns {() => void}
 */
export function onPricingSettingsUpdated(handler) {
  if (typeof window === 'undefined') return () => {}
  const wrapped = () => {
    void handler()
  }
  window.addEventListener(PRICING_SETTINGS_UPDATED_EVENT, wrapped)
  return () => window.removeEventListener(PRICING_SETTINGS_UPDATED_EVENT, wrapped)
}
