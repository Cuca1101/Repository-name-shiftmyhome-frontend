import {
  effectivePlatformReductionPctOfCustomer,
  journeyPlatformProfitGbp,
} from './journeyFinance'
import { extractUkPostcode } from './journeySummary'
import { quoteOperationalStatusLower } from './adminJobListRules'

/** @typedef {'all' | 'draft' | 'marketplace' | 'active' | 'completed'} JourneyPlannerTab */
/** @typedef {'newest' | 'created' | 'marketplace'} JourneyPlannerSort */

export const JOURNEY_PLANNER_TABS = [
  { key: 'all', label: 'All journeys' },
  { key: 'draft', label: 'Draft' },
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
]

/**
 * Workflow bucket for list filters (no DB changes).
 * @param {Record<string, unknown>} j
 * @returns {Exclude<JourneyPlannerTab, 'all'>}
 */
export function journeyWorkflowBucket(j) {
  const vis = String(j.marketplace_visibility || '')
  const st = String(j.status || '').toLowerCase()
  if (st === 'completed' || vis === 'completed') return 'completed'
  if (st === 'cancelled' || vis === 'cancelled') return 'completed'
  if (vis === 'assigned' || (j.assigned_partner_id != null && String(j.assigned_partner_id).trim() !== '')) {
    return 'active'
  }
  if (vis === 'visible_in_marketplace') return 'marketplace'
  return 'draft'
}

/**
 * @param {Record<string, unknown>} j
 */
export function journeyIsListedOnMarketplace(j) {
  return String(j.marketplace_visibility || '') === 'visible_in_marketplace'
}

/** @param {Record<string, unknown> | null | undefined} q */
export function quoteIsJobCompleted(q) {
  if (!q || typeof q !== 'object') return false
  const st = String(q.status ?? '').trim()
  if (st === 'Completed' || st === 'Cancelled') return st === 'Completed'
  if (q.completed_at) return true
  const op = quoteOperationalStatusLower(q)
  return op === 'completed'
}

/**
 * Operational dispatch label for journey view and cards.
 * @param {Record<string, unknown>} j
 * @param {Record<string, unknown>[]} [quotes]
 * @returns {{ label: string, tone: 'slate' | 'amber' | 'emerald' | 'sky' | 'violet' | 'rose', key: string }}
 */
export function journeyDispatchStatus(j, quotes = []) {
  const vis = String(j.marketplace_visibility || '')
  const st = String(j.status || '').toLowerCase()
  const jobs = j.jobs_count != null && Number.isFinite(Number(j.jobs_count)) ? Number(j.jobs_count) : 0
  const hasDriver = j.assigned_driver_id != null && String(j.assigned_driver_id).trim() !== ''
  const hasRef = j.journey_ref != null && String(j.journey_ref).trim() !== ''

  if (st === 'completed' || vis === 'completed' || st === 'cancelled' || vis === 'cancelled') {
    return { label: 'Completed', tone: 'violet', key: 'completed' }
  }

  const quoteList = Array.isArray(quotes) ? quotes : []
  if (quoteList.length > 0 && quoteList.every(quoteIsJobCompleted)) {
    return { label: 'Completed', tone: 'violet', key: 'completed' }
  }

  if (hasDriver || vis === 'assigned') {
    const driverName = journeyAssignedDriverLabel(j, quoteList)
    if (quoteList.some((q) => !quoteIsJobCompleted(q))) {
      return {
        label: driverName ? `Active · ${driverName}` : 'Active',
        tone: 'sky',
        key: 'active',
      }
    }
    return {
      label: driverName ? `Driver assigned · ${driverName}` : 'Driver assigned',
      tone: 'sky',
      key: 'driver_assigned',
    }
  }

  if (vis === 'visible_in_marketplace') {
    return { label: 'Marketplace live', tone: 'emerald', key: 'marketplace' }
  }

  if (hasRef && jobs > 0) {
    return { label: 'Ready for dispatch', tone: 'slate', key: 'ready' }
  }

  return { label: 'Draft', tone: 'amber', key: 'draft' }
}

/**
 * @param {Record<string, unknown>} j
 * @param {Record<string, unknown>[]} [quotes]
 */
export function journeyAssignedDriverLabel(j, quotes = []) {
  const jid = j?.assigned_driver_id != null ? String(j.assigned_driver_id).trim() : ''
  if (jid) {
    const match = (quotes || []).find((q) => String(q?.assigned_driver_id || '').trim() === jid)
    const name = String(match?.assigned_driver_name || '').trim()
    if (name) return name
  }
  const named = (quotes || []).find((q) => String(q?.assigned_driver_name || '').trim())
  return named ? String(named.assigned_driver_name).trim() : ''
}

/**
 * @param {Record<string, unknown>} j
 * @returns {{ label: string, tone: 'slate' | 'amber' | 'emerald' | 'sky' | 'violet' | 'rose' }}
 */
export function journeyStatusBadge(j, quotes = []) {
  const d = journeyDispatchStatus(j, quotes)
  return { label: d.label, tone: d.tone }
}

const BADGE_CLASS = {
  slate: 'bg-slate-700 text-white',
  amber: 'bg-amber-500 text-amber-950',
  emerald: 'bg-emerald-600 text-white',
  sky: 'bg-sky-600 text-white',
  violet: 'bg-violet-600 text-white',
  rose: 'bg-rose-600 text-white',
}

/**
 * @param {'slate' | 'amber' | 'emerald' | 'sky' | 'violet' | 'rose'} tone
 */
export function journeyBadgeClassName(tone) {
  return BADGE_CLASS[tone] || BADGE_CLASS.slate
}

/**
 * @param {unknown} n
 */
export function formatJourneyMoney(n) {
  if (n == null || n === '') return '—'
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return `£${x.toFixed(2)}`
}

/**
 * @param {Record<string, unknown>} j
 */
export function journeyFinanceFromRow(j) {
  const cust =
    j.admin_customer_total_gbp != null && Number.isFinite(Number(j.admin_customer_total_gbp))
      ? Number(j.admin_customer_total_gbp)
      : null
  const payout =
    j.marketplace_payout_price != null && Number.isFinite(Number(j.marketplace_payout_price))
      ? Number(j.marketplace_payout_price)
      : null
  const profit = journeyPlatformProfitGbp(cust, payout)
  const marginPct = effectivePlatformReductionPctOfCustomer(cust, payout)
  return { customerTotal: cust, payout, platformProfit: profit, marginPct }
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {JourneyPlannerTab} tab
 */
export function filterJourneysByTab(rows, tab) {
  if (tab === 'all') return rows
  return rows.filter((j) => journeyWorkflowBucket(j) === tab)
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {JourneyPlannerSort} sortKey
 */
export function sortJourneys(rows, sortKey) {
  const list = [...rows]
  if (sortKey === 'created') {
    list.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    return list
  }
  if (sortKey === 'marketplace') {
    list.sort((a, b) => {
      const ma = journeyIsListedOnMarketplace(a) ? 1 : 0
      const mb = journeyIsListedOnMarketplace(b) ? 1 : 0
      if (mb !== ma) return mb - ma
      return String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
    })
    return list
  }
  list.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
  return list
}

/**
 * @param {Record<string, unknown>} j
 * @param {{ jobRefs?: string[] }} meta
 * @param {string} term
 */
export function journeyMatchesSearch(j, meta, term) {
  const q = String(term || '')
    .trim()
    .toLowerCase()
  if (!q) return true
  const blob = [
    j.journey_ref,
    j.title,
    j.summary_title,
    j.from_postcode,
    j.to_postcode,
    ...(meta.jobRefs || []),
  ]
    .map((x) => (x != null ? String(x).toLowerCase() : ''))
    .join(' ')
  return blob.includes(q)
}

/** @param {unknown} address */
export function cityFromAddress(address) {
  const s = String(address || '').trim()
  if (!s) return ''
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2]
    if (candidate && !/^[A-Z]{1,2}\d/i.test(candidate)) return candidate
  }
  return parts[0] || ''
}

/**
 * @param {unknown} address
 * @returns {{ city: string, postcode: string, label: string }}
 */
export function locationChipFromAddress(address) {
  const city = cityFromAddress(address)
  const postcode = extractUkPostcode(address)
  if (city && postcode) return { city, postcode, label: `${city} · ${postcode}` }
  if (postcode) return { city: '', postcode, label: postcode }
  if (city) return { city, postcode: '', label: city }
  return { city: '', postcode: '', label: '' }
}

/**
 * @param {Record<string, unknown> | null | undefined} q
 */
export function quoteAccessSummary(q) {
  if (!q || typeof q !== 'object') return ''
  const details = String(q.details || '')
  const bits = []
  const floor = details.match(/(?:pickup|delivery|from|to)[^\n]*floor[:\s]*([^\n,]+)/i)
  const lift = /no lift|with lift|lift access/i.test(details)
    ? details.match(/(no lift|with lift|lift[^,\n]{0,20})/i)?.[1]
    : null
  if (floor?.[1]) bits.push(floor[1].trim())
  if (lift) bits.push(String(lift).trim())
  if (/\bstairs\b/i.test(details)) bits.push('Stairs')
  return bits.filter(Boolean).join(' · ')
}

/**
 * Max crew from quotes for journey view summary.
 * @param {Record<string, unknown>[]} quotes
 */
export function maxCrewFromQuotes(quotes) {
  let max = 0
  for (const q of quotes || []) {
    const c = Number(q?.crew_size)
    if (Number.isFinite(c) && c > 0) max = Math.max(max, Math.round(c))
  }
  return max > 0 ? max : null
}
