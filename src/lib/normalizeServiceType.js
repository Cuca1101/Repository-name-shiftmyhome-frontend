import { SERVICE_TYPES } from '../constants/serviceTypes'

/** @type {Record<string, string>} */
const LABEL_TO_KEY = {
  'House Removals': 'house-removals',
  'Man with Van': 'man-with-van',
  'Furniture Delivery': 'furniture-delivery',
  'Office Moves': 'office-moves',
  'Student Moves': 'student-moves',
  Clearance: 'clearance',
  'Storage Move': 'storage-move',
}

/** @type {Record<string, string>} */
const KEY_TO_LABEL = Object.fromEntries(
  Object.entries(LABEL_TO_KEY).map(([label, key]) => [key, label]),
)

/**
 * True for React SyntheticEvent / DOM Event (must never be treated as a service type).
 * @param {unknown} value
 */
export function isDomOrSyntheticEvent(value) {
  if (!value || typeof value !== 'object') return false
  const v = /** @type {Record<string, unknown>} */ (value)
  return (
    typeof v.preventDefault === 'function' ||
    typeof v.stopPropagation === 'function' ||
    typeof v.nativeEvent === 'object' ||
    typeof v.target === 'object'
  )
}

/**
 * Coerce any lead/wizard/CTA service value into a canonical label + key.
 * Rejects click events and "[object Object]" so they never persist or price.
 *
 * @param {unknown} raw
 * @returns {{ key: string, label: string }}
 */
export function normalizeServiceType(raw) {
  if (raw == null || raw === '') return { key: '', label: '' }
  if (isDomOrSyntheticEvent(raw)) return { key: '', label: '' }

  let candidate = ''

  if (typeof raw === 'string') {
    candidate = raw.trim()
  } else if (typeof raw === 'object') {
    const o = /** @type {Record<string, unknown>} */ (raw)
    const nested =
      o.label ?? o.serviceType ?? o.service_type ?? o.name ?? o.value ?? o.key ?? o.slug ?? ''
    if (typeof nested === 'string') candidate = nested.trim()
    else if (nested != null && typeof nested !== 'object') candidate = String(nested).trim()
  } else if (typeof raw === 'number' || typeof raw === 'boolean') {
    candidate = String(raw).trim()
  }

  if (!candidate || candidate === '[object Object]') return { key: '', label: '' }

  const lower = candidate.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  const compact = lower.replace(/\s+/g, '')

  for (const label of SERVICE_TYPES) {
    const labelLower = label.toLowerCase()
    if (labelLower === lower || labelLower.replace(/\s+/g, '') === compact) {
      return { key: LABEL_TO_KEY[label] || '', label }
    }
  }

  const asKey = candidate.toLowerCase().replace(/\s+/g, '-').replace(/_+/g, '-')
  if (KEY_TO_LABEL[asKey]) {
    return { key: asKey, label: KEY_TO_LABEL[asKey] }
  }

  // Unknown free-text (e.g. homepage contact form) — keep as label only, never "[object Object]"
  return { key: '', label: candidate }
}

/**
 * Canonical service label for pricing / DB columns (`service`, `service_type`).
 * @param {unknown} raw
 * @returns {string}
 */
export function resolveServiceLabel(raw) {
  return normalizeServiceType(raw).label
}

/**
 * Canonical service key/slug when known (e.g. `house-removals`).
 * @param {unknown} raw
 * @returns {string}
 */
export function resolveServiceKey(raw) {
  return normalizeServiceType(raw).key
}
