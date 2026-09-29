const CONTACT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** @param {string} dateStr */
function validDate(dateStr) {
  if (!DATE_ONLY.test(dateStr)) return false
  const [year, month, day] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(year, month - 1, day))
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day
}
const BUCKET_NAME = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/
const DAY_SECONDS = 86400
const MAX_RANGE_SECONDS = 92 * DAY_SECONDS

export const PAGE_SIZE = 20
export const MAX_SCAN = 100

const FAILED_REASONS = new Set(['TELECOM_PROBLEM', 'TELECOM_BUSY', 'EXPIRED'])

const DIRECTION_LABELS = {
  INBOUND: 'Inbound',
  OUTBOUND: 'Outbound',
  EXTERNAL_OUTBOUND: 'Outbound',
  CALLBACK: 'Callback',
  TRANSFER: 'Transfer',
  QUEUE_TRANSFER: 'Transfer',
}

export const STATUS_LABELS = {
  in_progress: 'In progress',
  answered: 'Answered',
  missed: 'Missed',
  abandoned: 'Abandoned',
  rejected: 'Rejected',
  failed: 'Failed',
}

const REJECT_REASONS = new Set(['REJECTED', 'AGENT_REJECTED', 'AGENT_REJECT', 'CONTACT_REJECTED'])

/** @param {unknown} value */
export function isContactId(value) {
  return typeof value === 'string' && CONTACT_ID.test(value)
}

/** @param {unknown} value */
export function epochSeconds(value) {
  if (value == null || value === '') return null
  if (typeof value === 'string' && value.includes('T')) {
    const ms = Date.parse(value)
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null
  }
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n > 10_000_000_000 ? Math.floor(n / 1000) : Math.floor(n)
}

/**
 * UTC epoch for a London civil time.
 * @param {string} dateStr YYYY-MM-DD
 * @param {string} timeStr HH:MM:SS
 */
export function londonEpoch(dateStr, timeStr) {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, mi, s] = timeStr.split(':').map(Number)
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi, s)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/London',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(utcGuess))
      .map((part) => [part.type, part.value]),
  )
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  const offset = asUtc - utcGuess
  return Math.floor((utcGuess - offset) / 1000)
}

/** @param {string} phone */
export function phoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '')
}

/** @param {string} digits */
function phoneVariants(digits) {
  const variants = new Set()
  if (!digits) return variants
  variants.add(digits)
  if (digits.startsWith('44')) variants.add(`0${digits.slice(2)}`)
  if (digits.startsWith('0')) variants.add(`44${digits.slice(1)}`)
  return variants
}

/**
 * @param {string | null | undefined} stored
 * @param {string} queryDigits
 */
export function phonesMatch(stored, queryDigits) {
  if (!queryDigits) return true
  const storedDigits = phoneDigits(stored)
  if (!storedDigits) return false
  const storedVars = phoneVariants(storedDigits)
  const queryVars = phoneVariants(queryDigits)
  for (const query of queryVars) {
    for (const candidate of storedVars) {
      if (candidate === query) return true
      if (query.length >= 6 && candidate.endsWith(query)) return true
      if (candidate.length >= 6 && query.endsWith(candidate)) return true
    }
  }
  return false
}

/** @param {string | null | undefined} method */
export function directionOf(method) {
  const name = String(method || '').toUpperCase()
  if (name === 'INBOUND') return 'inbound'
  if (name === 'OUTBOUND' || name === 'EXTERNAL_OUTBOUND' || name === 'CALLBACK') return 'outbound'
  return 'other'
}

/** @param {string | null | undefined} method */
export function directionLabel(method) {
  const name = String(method || '').toUpperCase()
  return DIRECTION_LABELS[name] || 'Other'
}

/** @param {string} direction */
export function initiationMethodsFor(direction) {
  if (direction === 'inbound') return ['INBOUND']
  if (direction === 'outbound') return ['OUTBOUND', 'EXTERNAL_OUTBOUND', 'CALLBACK']
  return null
}

/**
 * @param {Record<string, any>} contact
 */
/** @param {unknown} value @param {string[]} found */
function collectStrings(value, found) {
  if (found.length > 40 || value == null) return
  if (typeof value === 'string') {
    found.push(value.toUpperCase())
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, found))
    return
  }
  if (typeof value === 'object') {
    for (const child of Object.values(value)) collectStrings(child, found)
  }
}

/** @param {unknown} value @param {string[]} found */
function collectStatusText(value, found) {
  if (!value || typeof value !== 'object') return
  const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item]) : Object.entries(value)
  for (const [key, child] of entries) {
    if (/status|reason|state/i.test(key)) collectStrings(child, found)
    else if (child && typeof child === 'object') collectStatusText(child, found)
  }
}

/** @param {Record<string, any>} contact */
function isRejected(contact) {
  const reason = String(contact?.DisconnectReason || '').toUpperCase()
  if (REJECT_REASONS.has(reason) || reason.includes('REJECT')) return true
  const found = []
  collectStatusText(contact?.SegmentAttributes, found)
  collectStatusText(contact?.RoutingCriteria, found)
  collectStatusText(contact?.Tags, found)
  return found.some((text) => REJECT_REASONS.has(text) || text.includes('AGENT_REJECT'))
}

export function deriveStatus(contact) {
  const ended = Boolean(epochSeconds(contact?.DisconnectTimestamp))
  const agentConnected = Boolean(epochSeconds(contact?.AgentInfo?.ConnectedToAgentTimestamp))
  const queued = Boolean(epochSeconds(contact?.QueueInfo?.EnqueueTimestamp))
  const reason = String(contact?.DisconnectReason || '').toUpperCase()
  if (!ended) return 'in_progress'
  if (!agentConnected && isRejected(contact)) return 'rejected'
  if (agentConnected) return 'answered'
  if (FAILED_REASONS.has(reason)) return 'failed'
  if (queued) return 'abandoned'
  return 'missed'
}

/**
 * @param {Record<string, any>} contact
 * @param {number} nowSec
 */
export function waitingSeconds(contact, nowSec) {
  const enqueue = epochSeconds(contact?.QueueInfo?.EnqueueTimestamp)
  if (!enqueue) return null
  const connected = epochSeconds(contact?.AgentInfo?.ConnectedToAgentTimestamp)
  const end = epochSeconds(contact?.DisconnectTimestamp)
  const stop = connected || end || nowSec
  if (stop < enqueue) return null
  return stop - enqueue
}

/**
 * @param {Record<string, any>} contact
 * @param {number} nowSec
 */
export function talkSeconds(contact, nowSec) {
  const connected = epochSeconds(contact?.AgentInfo?.ConnectedToAgentTimestamp)
  if (!connected) return null
  const end = epochSeconds(contact?.DisconnectTimestamp) || nowSec
  if (end < connected) return null
  return end - connected
}

/**
 * @param {Record<string, any>} contact
 * @param {number} nowSec
 */
export function totalSeconds(contact, nowSec) {
  const start = epochSeconds(contact?.InitiationTimestamp)
  if (!start) return null
  const end = epochSeconds(contact?.DisconnectTimestamp) || nowSec
  if (end < start) return null
  return end - start
}

/** @param {Record<string, any>} contact */
export function pickRecording(contact) {
  const list = Array.isArray(contact?.Recordings) ? contact.Recordings : []
  const audio = list.filter((item) => {
    const storage = String(item?.StorageType || '').toUpperCase()
    const status = String(item?.Status || '').toUpperCase()
    const media = String(item?.MediaStreamType || 'AUDIO').toUpperCase()
    return storage === 'S3' && status === 'AVAILABLE' && item?.Location && media === 'AUDIO'
  })
  return audio.find((item) => String(item?.ParticipantType || '').toUpperCase() === 'ALL') || audio[0] || null
}

/** @param {Record<string, any>} contact */
export function recordingState(contact) {
  const list = Array.isArray(contact?.Recordings) ? contact.Recordings : []
  const audio = list.filter((item) => String(item?.MediaStreamType || 'AUDIO').toUpperCase() === 'AUDIO')
  const source = audio.length ? audio : list
  const available = source.some((item) => {
    const status = String(item?.Status || '').toUpperCase()
    const media = String(item?.MediaStreamType || 'AUDIO').toUpperCase()
    return (
      status === 'AVAILABLE' &&
      item?.Location &&
      String(item?.StorageType || '').toUpperCase() === 'S3' &&
      media === 'AUDIO'
    )
  })
  if (available) return 'available'
  const processing = source.some((item) => {
    const status = String(item?.Status || '').toUpperCase()
    return status !== 'AVAILABLE' && status !== 'DELETED'
  })
  if (processing) return 'processing'
  return 'none'
}

/**
 * @param {string} location
 */
export function parseS3Location(location) {
  const raw = String(location || '').trim()
  if (raw.startsWith('s3://')) {
    const rest = raw.slice('s3://'.length)
    const slash = rest.indexOf('/')
    if (slash < 1) return null
    return { bucket: rest.slice(0, slash), key: rest.slice(slash + 1) }
  }
  try {
    const url = new URL(raw)
    const virtual = url.hostname.match(/^(.+)\.s3[.-]([a-z0-9-]+)\.amazonaws\.com$/)
    if (virtual) {
      return { bucket: virtual[1], key: decodeURIComponent(url.pathname.replace(/^\//, '')) }
    }
    const pathStyle = url.hostname.match(/^s3[.-]([a-z0-9-]+)\.amazonaws\.com$/)
    if (pathStyle) {
      const parts = url.pathname.replace(/^\//, '').split('/')
      const bucket = parts.shift() || ''
      return { bucket, key: parts.map((part) => decodeURIComponent(part)).join('/') }
    }
  } catch {
    return null
  }
  return null
}

/**
 * Turn the configured recording prefix into an exact folder prefix.
 * Empty, absolute, or path-traversal values are rejected.
 * @param {string} value
 */
export function normaliseRecordingPrefix(value) {
  let prefix = String(value || '').trim().replace(/\\/g, '/')
  if (!prefix || /[\u0000-\u001f\u007f]/.test(prefix)) return null
  if (prefix.includes('..') || prefix.includes('://') || prefix.includes('?') || prefix.includes('#')) return null
  prefix = prefix.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\/{2,}/g, '/')
  if (!prefix) return null
  const parts = prefix.split('/')
  if (parts.some((part) => !part || part === '.' || part === '..')) return null
  return `${prefix}/`
}

/**
 * Sign only the S3 object DescribeContact returned, and only when its bucket
 * and key match the server bucket and prefix exactly. A missing or different
 * bucket or prefix fails closed.
 * @param {string} location
 * @param {string} bucketAllow
 * @param {string} prefixAllow
 */
export function allowedRecordingTarget(location, bucketAllow, prefixAllow) {
  const bucketExpected = String(bucketAllow || '').trim()
  const prefix = normaliseRecordingPrefix(prefixAllow)
  if (!bucketExpected || !BUCKET_NAME.test(bucketExpected) || !prefix) return null
  const parsed = parseS3Location(location)
  if (!parsed) return null
  const bucket = parsed.bucket.trim()
  const key = parsed.key.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/')
  if (!key || key.includes('..') || key.includes('\0') || key.split('/').includes('.')) return null
  if (bucket !== bucketExpected) return null
  if (!key.startsWith(prefix)) return null
  return { bucket, key }
}

/**
 * @param {unknown} body
 */
export function parseHistoryRequest(body) {
  const source = body && typeof body === 'object' ? body : {}
  const startDate = String(source.startDate || '').trim()
  const endDate = String(source.endDate || '').trim()
  const direction = String(source.direction || 'all').trim().toLowerCase()
  const status = String(source.status || 'all').trim().toLowerCase()
  const phoneRaw = String(source.phone || '').trim()
  const cursor = source.cursor == null ? '' : String(source.cursor)

  if (!validDate(startDate) || !validDate(endDate)) {
    return { error: 'Choose a valid start and end date.' }
  }
  if (!['all', 'inbound', 'outbound'].includes(direction)) {
    return { error: 'Choose a valid call direction.' }
  }
  if (!['all', 'in_progress', 'answered', 'missed', 'abandoned', 'rejected', 'failed'].includes(status)) {
    return { error: 'Choose a valid call status.' }
  }
  if (phoneRaw.length > 32) {
    return { error: 'Enter a shorter telephone number.' }
  }
  const phone = phoneDigits(phoneRaw)
  if (phone && phone.length < 6) {
    return { error: 'Enter at least 6 digits of the telephone number.' }
  }
  if (cursor.length > 150000) {
    return { error: 'This results page expired. Search again.' }
  }

  const start = londonEpoch(startDate, '00:00:00')
  const end = londonEpoch(endDate, '23:59:59')
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return { error: 'The end date must be on or after the start date.' }
  }
  if (end - start > MAX_RANGE_SECONDS) {
    return { error: 'Choose a date range of 92 days or less.' }
  }

  return {
    filters: {
      start,
      end: Math.min(end, Math.floor(Date.now() / 1000)),
      direction,
      status,
      phone,
      needsPostFilter: Boolean(phone) || status !== 'all',
    },
    cursor,
  }
}

/**
 * @param {Record<string, any>} contact
 * @param {number} nowSec
 */
export function shapeContact(contact, nowSec) {
  const id = String(contact?.Id || '')
  const status = deriveStatus(contact)
  const phone = contact?.CustomerEndpoint?.Address ? String(contact.CustomerEndpoint.Address) : ''
  const initiated = epochSeconds(contact?.InitiationTimestamp)
  const state = recordingState(contact)
  return {
    id,
    initiatedAt: initiated ? new Date(initiated * 1000).toISOString() : null,
    phone: phone || null,
    direction: directionOf(contact?.InitiationMethod),
    directionLabel: directionLabel(contact?.InitiationMethod),
    queueId: contact?.QueueInfo?.Id ? String(contact.QueueInfo.Id) : '',
    agentId: contact?.AgentInfo?.Id ? String(contact.AgentInfo.Id) : '',
    status,
    statusLabel: STATUS_LABELS[status] || 'Other',
    waitSeconds: waitingSeconds(contact, nowSec),
    talkSeconds: talkSeconds(contact, nowSec),
    totalSeconds: totalSeconds(contact, nowSec),
    recordingState: state,
    recordingAvailable: state === 'available',
  }
}

/**
 * @param {ReturnType<typeof shapeContact>} row
 * @param {{ phone: string, status: string }} filters
 */
export function rowMatches(row, filters) {
  if (filters.status !== 'all' && row.status !== filters.status) return false
  if (filters.phone && !phonesMatch(row.phone, filters.phone)) return false
  return true
}

/**
 * @param {ReturnType<typeof shapeContact>} row
 * @param {Map<string, string>} queues
 * @param {Map<string, string>} agents
 */
export function publicContact(row, queues, agents) {
  return {
    id: row.id,
    initiatedAt: row.initiatedAt,
    phone: row.phone,
    direction: row.direction,
    directionLabel: row.directionLabel,
    queue: row.queueId ? queues.get(row.queueId) || 'Unavailable' : '—',
    agent: row.agentId ? agents.get(row.agentId) || 'Unavailable' : '—',
    status: row.status,
    statusLabel: row.statusLabel,
    waitSeconds: row.waitSeconds,
    talkSeconds: row.talkSeconds,
    totalSeconds: row.totalSeconds,
    recordingState: row.recordingState,
    recordingAvailable: row.recordingState === 'available',
  }
}
