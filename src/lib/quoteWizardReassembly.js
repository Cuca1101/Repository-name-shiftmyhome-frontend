/**
 * Effective reassembly item count for quote wizard (pricing, summary, validation).
 * When same as dismantling, uses dismantlingItemCount; otherwise reassemblyItemCount.
 */

/** @param {Record<string, unknown> | null | undefined} wizard */
export function getEffectiveReassemblyItemCount(wizard) {
  if (!wizard?.reassembly) return 0
  if (wizard.reassemblySameAsDismantling) {
    return Math.max(0, Number(wizard.dismantlingItemCount) || 0)
  }
  return Math.max(0, Number(wizard.reassemblyItemCount) || 0)
}

/**
 * State patch to keep reassembly fields aligned when "same as dismantling" is selected.
 * @param {Record<string, unknown>} wizard
 */
export function reassemblySameAsDismantlingPatch(wizard) {
  if (!wizard.reassembly || !wizard.reassemblySameAsDismantling) return {}
  return {
    reassemblyItemCount: Math.max(0, Number(wizard.dismantlingItemCount) || 0),
    reassemblyWhat: wizard.dismantlingWhat ?? '',
  }
}
