import { buildSprinterVanElement } from '../tracking/sprinterVanMarker'

/**
 * Driver pin on Operations Map — same Sprinter photo as the customer portal.
 * @param {{
 *   driverId: string,
 *   name: string,
 *   initials?: string,
 *   bearing?: number,
 *   moving?: boolean,
 *   status?: string,
 *   etaLabel?: string,
 *   online?: boolean,
 *   isFocused?: boolean,
 *   stale?: boolean,
 *   jobRef?: string,
 *   waitingGps?: boolean,
 * }} opts
 */
export function buildDriverMarkerElement(opts) {
  const live = Boolean(opts.online) && !opts.stale && !opts.waitingGps
  const el = buildSprinterVanElement({
    name: opts.name,
    quoteRef: opts.jobRef || '',
    live,
    stale: Boolean(opts.stale),
    waitingGps: Boolean(opts.waitingGps),
  })
  el.dataset.driverId = opts.driverId
  el.dataset.markerSig = `${opts.jobRef || ''}|${opts.waitingGps ? 1 : 0}|${opts.stale ? 1 : 0}|${opts.isFocused ? 1 : 0}|${live ? 1 : 0}`
  if (opts.isFocused) el.style.outline = '3px solid #fbbf24'
  return el
}
