import { requireAdmin } from '../../../_shared/adminSession.js'
import { createRecordingPlayback } from '../../../_shared/connectApi.js'
import { HttpError, assertBrowserOrigin, json, logServerError, preflight } from '../../../_shared/http.js'

export async function onRequest(context) {
  const { request, env } = context
  const method = request.method.toUpperCase()
  if (method === 'OPTIONS') return preflight(request)
  if (method !== 'POST') return json({ message: 'Method not allowed.' }, 405, request)

  try {
    assertBrowserOrigin(request)
    await requireAdmin(request, env)
    const result = await createRecordingPlayback(request, env)
    return json(result, 200, request)
  } catch (error) {
    if (error instanceof HttpError) return json({ message: error.message }, error.status, request)
    logServerError('connect recording failed', error)
    return json({ message: 'Could not open the recording.' }, 500, request)
  }
}
