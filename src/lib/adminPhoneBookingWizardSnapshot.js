import { initialWizardState } from './quoteWizardDefaults'
import { hydrateWizardFromDraft } from './quoteDraftStorage'

export const SNAPSHOT_START = '---SMH_PHONE_BOOKING_WIZARD_JSON---'
export const SNAPSHOT_END = '---END_SMH_PHONE_BOOKING_WIZARD_JSON---'

/**
 * @param {Record<string, unknown>} wizard
 */
export function pickPhoneBookingWizardSnapshot(wizard) {
  const base = initialWizardState()
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const key of Object.keys(base)) {
    if (wizard[key] !== undefined) out[key] = wizard[key]
  }
  return out
}

/**
 * @param {string} detailsText
 * @param {{
 *   wizard: Record<string, unknown>,
 *   serviceType?: string,
 *   useCalculatedPrice?: boolean,
 *   finalPriceOverride?: string,
 *   overrideReason?: string,
 *   adminNote?: string,
 *   quoteBy?: { name?: string, at?: string } | null,
 *   priceChanges?: Array<{ by?: string, at?: string, from?: number | null, to?: number | null, reason?: string }>,
 * }} meta
 */
export function appendWizardSnapshotToDetails(detailsText, meta) {
  const body = String(detailsText || '').trim()
  const payload = {
    v: 1,
    wizard: pickPhoneBookingWizardSnapshot(meta.wizard),
    serviceType: meta.serviceType ?? '',
    useCalculatedPrice: meta.useCalculatedPrice !== false,
    finalPriceOverride: String(meta.finalPriceOverride ?? ''),
    overrideReason: String(meta.overrideReason ?? ''),
    adminNote: String(meta.adminNote ?? ''),
    quoteBy: meta.quoteBy
      ? { name: String(meta.quoteBy.name || ''), at: String(meta.quoteBy.at || '') }
      : null,
    priceChanges: Array.isArray(meta.priceChanges) ? meta.priceChanges : [],
  }
  const block = `${SNAPSHOT_START}\n${JSON.stringify(payload)}\n${SNAPSHOT_END}`
  return body ? `${body}\n\n${block}` : block
}

/**
 * @param {string | null | undefined} details
 * @returns {{
 *   displayDetails: string,
 *   meta: {
 *     wizard: Record<string, unknown>,
 *     serviceType: string,
 *     useCalculatedPrice: boolean,
 *     finalPriceOverride: string,
 *     overrideReason: string,
 *     adminNote: string,
 *     quoteBy: { name: string, at: string } | null,
 *     priceChanges: Array<{ by?: string, at?: string, from?: number | null, to?: number | null, reason?: string }>,
 *   } | null,
 * }}
 */
export function extractWizardSnapshotFromDetails(details) {
  const text = String(details || '')
  const start = text.indexOf(SNAPSHOT_START)
  if (start < 0) {
    return { displayDetails: text.trim(), meta: null }
  }
  const end = text.indexOf(SNAPSHOT_END, start)
  const displayDetails = text.slice(0, start).trim()
  if (end < 0) return { displayDetails, meta: null }
  const jsonRaw = text.slice(start + SNAPSHOT_START.length, end).trim()
  try {
    const parsed = JSON.parse(jsonRaw)
    if (!parsed || typeof parsed !== 'object') return { displayDetails, meta: null }
    const wizard = hydrateWizardFromDraft(parsed.wizard)
    return {
      displayDetails,
      meta: {
        wizard,
        serviceType: String(parsed.serviceType || ''),
        useCalculatedPrice: parsed.useCalculatedPrice !== false,
        finalPriceOverride: String(parsed.finalPriceOverride ?? ''),
        overrideReason: String(parsed.overrideReason ?? ''),
        adminNote: String(parsed.adminNote ?? ''),
        quoteBy:
          parsed.quoteBy && typeof parsed.quoteBy === 'object'
            ? { name: String(parsed.quoteBy.name || ''), at: String(parsed.quoteBy.at || '') }
            : null,
        priceChanges: Array.isArray(parsed.priceChanges) ? parsed.priceChanges : [],
      },
    }
  } catch {
    return { displayDetails, meta: null }
  }
}
