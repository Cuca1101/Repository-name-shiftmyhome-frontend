import { HttpError } from './http.js'

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

const RECORDINGS_NOTE =
  'Microsoft Graph PSTN call logs do not include recording files. Teams keeps recordings in the tenant compliance or OneDrive location, and this page does not receive them.'

const MISSED_NOTE =
  'Microsoft Graph does not provide a separate missed-call feed. An inbound Teams Phone row with a duration of 0 seconds is shown as unanswered. Calls that never reached Teams may be absent from this log.'

/**
 * @param {Record<string, string | undefined>} env
 */
export function teamsGraphConfig(env) {
  const tenantId = String(env.MICROSOFT_TENANT_ID || '').trim()
  const clientId = String(env.MICROSOFT_CLIENT_ID || '').trim()
  const clientSecret = String(env.MICROSOFT_CLIENT_SECRET || '').trim()
  if (!tenantId && !clientId && !clientSecret) return null
  if (!GUID.test(tenantId) || !GUID.test(clientId) || clientSecret.length < 8) {
    throw new HttpError(503, 'Microsoft Teams call history is not configured correctly on the server.')
  }
  return { tenantId, clientId, clientSecret }
}

/**
 * @param {Record<string, string | undefined>} env
 */
async function graphToken(env) {
  const config = teamsGraphConfig(env)
  if (!config) return null
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })
  let response
  try {
    response = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
  } catch {
    throw new HttpError(503, 'Could not reach Microsoft sign-in. Try again.')
  }
  if (!response.ok) {
    throw new HttpError(502, 'Microsoft refused the server sign-in. Check the app registration and admin consent.')
  }
  const payload = await response.json().catch(() => null)
  const token = String(payload?.access_token || '')
  if (!token) throw new HttpError(502, 'Microsoft did not return an access token.')
  return token
}

/**
 * @param {string} callType
 */
function directionOf(callType) {
  const value = String(callType || '').toLowerCase()
  if (value.endsWith('_in')) return 'inbound'
  if (value.includes('_out')) return 'outbound'
  return 'other'
}

/**
 * @param {Record<string, unknown>} row
 */
function mapRow(row) {
  const callType = String(row.callType || '')
  const duration = Number(row.duration)
  const durationSeconds = Number.isFinite(duration) && duration >= 0 ? duration : null
  const direction = directionOf(callType)
  return {
    id: String(row.id || row.callId || ''),
    startedAt: row.startDateTime || null,
    endedAt: row.endDateTime || null,
    durationSeconds,
    direction,
    callType,
    callerNumber: row.callerNumber || '',
    calleeNumber: row.calleeNumber || '',
    agentName: row.userDisplayName || '',
    unanswered: direction === 'inbound' && durationSeconds === 0,
  }
}

/**
 * @param {string} value
 */
function requireDate(value, label) {
  const date = String(value || '').trim()
  if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new HttpError(400, `${label} must be a YYYY-MM-DD date.`)
  }
  return date
}

/**
 * @param {Request} request
 * @param {Record<string, string | undefined>} env
 */
export async function listTeamsPstnCalls(request, env) {
  const config = teamsGraphConfig(env)
  if (!config) {
    return {
      configured: false,
      calls: [],
      truncated: false,
      recordingsAvailable: false,
      recordingsNote: RECORDINGS_NOTE,
      missedNote: MISSED_NOTE,
      message:
        'Microsoft Teams call history is not configured. Open Teams and Call with Teams still work. History needs server credentials and the CallRecords.Read.All application permission.',
    }
  }

  const body = await request.json().catch(() => ({}))
  const startDate = requireDate(body.startDate, 'Start date')
  const endDate = requireDate(body.endDate, 'End date')
  if (startDate > endDate) throw new HttpError(400, 'The start date is after the end date.')
  const span = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000
  if (span > 31) throw new HttpError(400, 'Choose a range of 31 days or fewer.')

  const token = await graphToken(env)
  let url = `https://graph.microsoft.com/v1.0/communications/callRecords/getPstnCalls(from=${startDate},to=${endDate})`
  const rows = []
  let truncated = false

  for (let page = 0; page < 3 && url; page += 1) {
    if (!url.startsWith('https://graph.microsoft.com/')) {
      throw new HttpError(502, 'Microsoft returned an unexpected history link.')
    }
    let response
    try {
      response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    } catch {
      throw new HttpError(503, 'Could not reach Microsoft Graph. Try again.')
    }
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(
        502,
        'Microsoft Graph refused call history. The app needs application permission CallRecords.Read.All with admin consent.',
      )
    }
    if (!response.ok) throw new HttpError(502, 'Microsoft Graph could not return call history.')
    const payload = await response.json().catch(() => null)
    if (Array.isArray(payload?.value)) rows.push(...payload.value)
    const next = String(payload?.['@odata.nextLink'] || '')
    if (next && page === 2) {
      truncated = true
      url = ''
    } else {
      url = next
    }
  }

  const phone = String(body.phone || '').replace(/\D/g, '')
  const direction = String(body.direction || 'all')
  const unansweredOnly = body.unansweredOnly === true
  let calls = rows.map(mapRow).filter((row) => row.id)
  if (phone) {
    calls = calls.filter((row) => {
      const caller = String(row.callerNumber).replace(/\D/g, '')
      const callee = String(row.calleeNumber).replace(/\D/g, '')
      return caller.includes(phone) || callee.includes(phone)
    })
  }
  if (direction === 'inbound' || direction === 'outbound') {
    calls = calls.filter((row) => row.direction === direction)
  }
  if (unansweredOnly) calls = calls.filter((row) => row.unanswered)

  return {
    configured: true,
    calls,
    truncated,
    recordingsAvailable: false,
    recordingsNote: RECORDINGS_NOTE,
    missedNote: MISSED_NOTE,
    message: '',
  }
}
