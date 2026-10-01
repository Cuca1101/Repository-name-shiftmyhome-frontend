import { requireAdmin } from '../../../_shared/adminSession.js'
import { HttpError, assertBrowserOrigin, json, logServerError, preflight } from '../../../_shared/http.js'
import { listTeamsPstnCalls } from '../../../_shared/teamsGraph.js'

export async function onRequest(context) {
  const { request, env } = context
  const method = request.method.toUpperCase()
  if (method === 'OPTIONS') return preflight(request)
  if (method !== 'POST') return json({ message: 'Method not allowed.' }, 405, request)

  try {
    assertBrowserOrigin(request)
    await requireAdmin(request, env)
    const result = await listTeamsPstnCalls(request, env)
    return json(result, 200, request)
  } catch (error) {
    if (error instanceof HttpError) return json({ message: error.message }, error.status, request)
    logServerError('teams call history failed', error)
    return json({ message: 'Could not load Teams call history.' }, 500, request)
  }
}
