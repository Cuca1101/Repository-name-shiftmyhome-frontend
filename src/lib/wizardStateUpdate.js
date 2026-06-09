/**
 * Safe wizard state updates — always merge onto latest state (avoids stale closure overwrites).
 *
 * @param {(
 *   next: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)
 * ) => void} onChange
 * @param {Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)} patch
 */
export function applyWizardPatch(onChange, patch) {
  if (typeof patch === 'function') {
    onChange(patch)
    return
  }
  onChange((prev) => ({ ...prev, ...patch }))
}
