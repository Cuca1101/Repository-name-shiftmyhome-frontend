import { AwsClient } from 'aws4fetch'
import { HttpError } from './http.js'
import {
  MAX_SCAN,
  PAGE_SIZE,
  allowedRecordingTarget,
  initiationMethodsFor,
  normaliseRecordingPrefix,
  isContactId,
  parseHistoryRequest,
  pickRecording,
  publicContact,
  recordingState,
  rowMatches,
  shapeContact,
} from './callHistoryModel.js'

const ALLOWED_REGION = 'eu-west-2'

/** @param {string} region */
function connectOrigin(region) {
  return `https://connect.${region}.amazonaws.com`
}

/** @param {Record<string, string | undefined>} env */
export function readServerConfig(env) {
  const region = String(env.AWS_REGION || '').trim()
  const instanceId = String(env.AWS_CONNECT_INSTANCE_ID || '').trim()
  const accessKeyId = String(env.AWS_ACCESS_KEY_ID || '').trim()
  const secretAccessKey = String(env.AWS_SECRET_ACCESS_KEY || '').trim()
  const sessionToken = String(env.AWS_SESSION_TOKEN || '').trim()
  const recordingsBucket = String(env.AWS_CONNECT_RECORDINGS_BUCKET || '').trim()
  const recordingsPrefix = normaliseRecordingPrefix(env.AWS_CONNECT_RECORDINGS_PREFIX || '')
  if (region !== ALLOWED_REGION || !instanceId || !accessKeyId || !secretAccessKey || !isContactId(instanceId)) {
    throw new HttpError(503, 'AWS configuration required')
  }
  return { region, instanceId, accessKeyId, secretAccessKey, sessionToken, recordingsBucket, recordingsPrefix }
}

/** @param {ReturnType<typeof readServerConfig>} config */
function awsClient(config) {
  return new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    sessionToken: config.sessionToken || undefined,
    region: config.region,
    retries: 2,
  })
}

/**
 * @param {AwsClient} aws
 * @param {string} url
 * @param {RequestInit & { aws?: Record<string, unknown> }} [init]
 */
async function signedJson(aws, url, init) {
  const response = await aws.fetch(url, init)
  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }
  return { response, data }
}

/** @param {number} status */
function connectFailure(status) {
  if (status === 403 || status === 401) {
    throw new HttpError(403, 'Amazon Connect denied this request. Check the IAM permissions for this instance.')
  }
  if (status === 404) {
    throw new HttpError(404, 'Amazon Connect could not find that resource.')
  }
  if (status === 429) {
    throw new HttpError(429, 'Amazon Connect is busy. Wait a moment and try again.')
  }
  throw new HttpError(502, 'Amazon Connect could not complete the request.')
}

/** @param {Uint8Array} bytes */
function bytesToBase64Url(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

/** @param {string} value */
function base64UrlToBytes(value) {
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4))
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * @param {{ nextToken: string | null, pendingIds: string[] }} payload
 * @param {string} secret
 */
async function signCursor(payload, secret) {
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
  return `${body}.${bytesToBase64Url(sig)}`
}

/**
 * @param {string} cursor
 * @param {string} secret
 */
async function readCursor(cursor, secret) {
  if (!cursor) return { nextToken: null, pendingIds: [], fresh: true }
  const [body, sig] = cursor.split('.')
  if (!body || !sig) throw new HttpError(400, 'This results page expired. Search again.')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  let payload
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(sig),
      new TextEncoder().encode(body),
    )
    if (!valid) throw new HttpError(400, 'This results page expired. Search again.')
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body)))
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, 'This results page expired. Search again.')
  }
  const nextToken = payload?.nextToken == null ? null : String(payload.nextToken)
  const pendingIds = Array.isArray(payload?.pendingIds) ? payload.pendingIds.map(String) : null
  if (!pendingIds || pendingIds.length > MAX_SCAN || pendingIds.some((id) => !isContactId(id))) {
    throw new HttpError(400, 'This results page expired. Search again.')
  }
  if (nextToken && (nextToken.length > 100000 || nextToken.includes('\0'))) {
    throw new HttpError(400, 'This results page expired. Search again.')
  }
  return { nextToken, pendingIds, fresh: false }
}

/**
 * @param {unknown[]} items
 * @param {number} limit
 * @param {(item: any, index: number) => Promise<any>} fn
 */
async function mapPool(items, limit, fn) {
  const results = new Array(items.length)
  let index = 0
  async function worker() {
    while (index < items.length) {
      const current = index
      index += 1
      results[current] = await fn(items[current], current)
    }
  }
  const workers = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}

/**
 * @param {AwsClient} aws
 * @param {ReturnType<typeof readServerConfig>} config
 * @param {{ start: number, end: number, direction: string }} filters
 * @param {string | null} nextToken
 * @param {number} maxResults
 */
async function searchContacts(aws, config, filters, nextToken, maxResults) {
  const methods = initiationMethodsFor(filters.direction)
  const body = {
    InstanceId: config.instanceId,
    MaxResults: maxResults,
    TimeRange: {
      Type: 'INITIATION_TIMESTAMP',
      StartTime: filters.start,
      EndTime: filters.end,
    },
    Sort: { FieldName: 'INITIATION_TIMESTAMP', Order: 'DESCENDING' },
    SearchCriteria: {
      Channels: ['VOICE'],
      ...(methods ? { InitiationMethods: methods } : {}),
    },
  }
  if (nextToken) body.NextToken = nextToken
  if (filters.end < filters.start) {
    return { ids: [], nextToken: null, totalCount: 0 }
  }

  const { response, data } = await signedJson(aws, `${connectOrigin(config.region)}/search-contacts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) connectFailure(response.status)
  const contacts = Array.isArray(data?.Contacts) ? data.Contacts : []
  return {
    ids: contacts.map((contact) => String(contact?.Id || '')).filter(isContactId),
    nextToken: data?.NextToken ? String(data.NextToken) : null,
    totalCount: Number.isFinite(Number(data?.TotalCount)) ? Number(data.TotalCount) : null,
  }
}

/**
 * @param {AwsClient} aws
 * @param {ReturnType<typeof readServerConfig>} config
 * @param {string} contactId
 */
async function describeContact(aws, config, contactId) {
  const url = `${connectOrigin(config.region)}/contacts/${encodeURIComponent(config.instanceId)}/${encodeURIComponent(contactId)}`
  const { response, data } = await signedJson(aws, url, { method: 'GET' })
  if (response.status === 404) return null
  if (!response.ok) connectFailure(response.status)
  return data?.Contact || null
}

/**
 * @param {AwsClient} aws
 * @param {ReturnType<typeof readServerConfig>} config
 * @param {string} queueId
 */
async function describeQueueName(aws, config, queueId) {
  const url = `${connectOrigin(config.region)}/queues/${encodeURIComponent(config.instanceId)}/${encodeURIComponent(queueId)}`
  const { response, data } = await signedJson(aws, url, { method: 'GET' })
  if (!response.ok) return ''
  return String(data?.Queue?.Name || '').trim()
}

/**
 * @param {AwsClient} aws
 * @param {ReturnType<typeof readServerConfig>} config
 * @param {string} userId
 */
async function describeAgentName(aws, config, userId) {
  const url = `${connectOrigin(config.region)}/users/${encodeURIComponent(config.instanceId)}/${encodeURIComponent(userId)}`
  const { response, data } = await signedJson(aws, url, { method: 'GET' })
  if (!response.ok) return ''
  const info = data?.User?.IdentityInfo || {}
  const person = [info.FirstName, info.LastName].filter(Boolean).join(' ').trim()
  return person || String(data?.User?.Username || '').trim()
}

/**
 * @param {Request} request
 * @param {Record<string, string | undefined>} env
 */
export async function listCallHistory(request, env) {
  const config = readServerConfig(env)
  const raw = await request.json().catch(() => null)
  const parsed = parseHistoryRequest(raw)
  if ('error' in parsed && parsed.error) throw new HttpError(400, parsed.error)
  const { filters, cursor } = parsed
  const position = await readCursor(cursor, config.secretAccessKey)
  const aws = awsClient(config)
  const nowSec = Math.floor(Date.now() / 1000)

  /** @type {ReturnType<typeof shapeContact>[]} */
  const matched = []
  let pendingIds = position.pendingIds.slice()
  let nextToken = position.nextToken
  let searchStarted = !position.fresh
  let scanned = 0
  let emptyPages = 0
  let totalCount = null
  const scanLimit = filters.needsPostFilter ? MAX_SCAN : PAGE_SIZE

  while (matched.length < PAGE_SIZE && scanned < scanLimit) {
    if (pendingIds.length === 0) {
      if (searchStarted && !nextToken) break
      const page = await searchContacts(
        aws,
        config,
        filters,
        nextToken,
        filters.needsPostFilter ? 50 : PAGE_SIZE,
      )
      searchStarted = true
      pendingIds = page.ids
      nextToken = page.nextToken
      if (!filters.needsPostFilter) totalCount = page.totalCount
      if (pendingIds.length === 0) {
        if (!nextToken) break
        emptyPages += 1
        if (emptyPages > 8) break
        continue
      }
      emptyPages = 0
    }

    const chunkSize = filters.needsPostFilter ? Math.min(8, scanLimit - scanned) : pendingIds.length
    if (chunkSize <= 0) break
    const chunk = pendingIds.splice(0, chunkSize)
    scanned += chunk.length
    const described = await mapPool(chunk, 4, (contactId) => describeContact(aws, config, contactId))
    const extras = []
    for (const contact of described) {
      if (!contact) continue
      const row = shapeContact(contact, nowSec)
      if (!isContactId(row.id) || !rowMatches(row, filters)) continue
      if (matched.length < PAGE_SIZE) matched.push(row)
      else extras.push(row.id)
    }
    if (extras.length) pendingIds = extras.concat(pendingIds)
    if (!filters.needsPostFilter) break
  }

  const queueIds = [...new Set(matched.map((row) => row.queueId).filter(Boolean))]
  const agentIds = [...new Set(matched.map((row) => row.agentId).filter(Boolean))]
  const queues = new Map()
  const agents = new Map()
  await Promise.all([
    ...queueIds.map(async (id) => {
      const name = await describeQueueName(aws, config, id)
      if (name) queues.set(id, name)
    }),
    ...agentIds.map(async (id) => {
      const name = await describeAgentName(aws, config, id)
      if (name) agents.set(id, name)
    }),
  ])

  const hasMore = pendingIds.length > 0 || Boolean(nextToken)
  const nextCursor = hasMore
    ? await signCursor({ nextToken, pendingIds: pendingIds.slice(0, MAX_SCAN) }, config.secretAccessKey)
    : null

  return {
    contacts: matched.map((row) => publicContact(row, queues, agents)),
    nextCursor,
    totalCount: filters.needsPostFilter ? null : totalCount,
    pageSize: PAGE_SIZE,
  }
}

/**
 * @param {Request} request
 * @param {Record<string, string | undefined>} env
 */
export async function createRecordingPlayback(request, env) {
  const config = readServerConfig(env)
  const raw = await request.json().catch(() => null)
  const contactId = String(raw?.contactId || '').trim()
  if (!isContactId(contactId)) throw new HttpError(400, 'Choose a valid call.')

  const aws = awsClient(config)
  const contact = await describeContact(aws, config, contactId)
  if (!contact) throw new HttpError(404, 'That call could not be found.')
  const state = recordingState(contact)
  if (state === 'processing') return { recordingAvailable: false, recordingState: 'processing' }
  const recording = pickRecording(contact)
  if (state !== 'available' || !recording) return { recordingAvailable: false, recordingState: 'none' }
  if (!config.recordingsBucket || !config.recordingsPrefix) {
    throw new HttpError(503, 'AWS configuration required')
  }

  // Location comes only from DescribeContact. Bucket and prefix come only from server variables.
  const target = allowedRecordingTarget(recording.Location, config.recordingsBucket, config.recordingsPrefix)
  if (!target) throw new HttpError(404, 'No recording')

  const expiresIn = 300
  const keyPath = target.key.split('/').map(encodeURIComponent).join('/')
  const unsigned = `https://${target.bucket}.s3.${config.region}.amazonaws.com/${keyPath}?X-Amz-Expires=${expiresIn}`
  const signed = await aws.sign(unsigned, {
    method: 'GET',
    aws: { signQuery: true, service: 's3', region: config.region },
  })

  return {
    recordingAvailable: true,
    recordingState: 'available',
    playbackUrl: String(signed.url),
    expiresIn,
  }
}
