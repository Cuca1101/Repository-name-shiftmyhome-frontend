import { supabase } from './supabase'

const TABLE = 'admin_login_sessions'
const STORAGE_KEY = 'smh_admin_login_session_id'

/** Heartbeat while the admin panel is open. */
export const ADMIN_PRESENCE_HEARTBEAT_MS = 30_000

/** No heartbeat for this long means the visit is no longer live. */
export const ADMIN_PRESENCE_ONLINE_MS = 90_000

/** On the next visit, close an idle open row at its last heartbeat. */
const STALE_MS = 3 * 60 * 1000

/** False after Sign out so a late heartbeat cannot open a new visit. */
let acceptPresence = false

function readStoredId() {
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

function writeStoredId(id) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* private mode */
  }
}

/**
 * @param {string} id
 * @param {string} userId
 */
async function resumeOpenSession(id, userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, user_id, signed_out_at, last_seen_at')
    .eq('id', id)
    .maybeSingle()

  if (error || !data || data.user_id !== userId) return false
  if (data.signed_out_at) return false

  const age = Date.now() - new Date(data.last_seen_at).getTime()
  if (age > STALE_MS) {
    await supabase.from(TABLE).update({ signed_out_at: data.last_seen_at }).eq('id', data.id).is('signed_out_at', null)
    return false
  }

  await supabase.from(TABLE).update({ last_seen_at: new Date().toISOString() }).eq('id', data.id).is('signed_out_at', null)
  return true
}

async function listOpenSessions(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, signed_in_at, last_seen_at')
    .eq('user_id', userId)
    .is('signed_out_at', null)
    .order('last_seen_at', { ascending: false })

  if (error || !data?.length) return []
  return data
}

/** One person stays on a single open visit, even with two admin windows. */
async function closeOlderOpenSessions(userId, keepId) {
  const open = await listOpenSessions(userId)
  const keep = open.find((row) => row.id === keepId)
  if (!keep) return

  const keepStarted = new Date(keep.signed_in_at).getTime()
  await Promise.all(
    open
      .filter((row) => row.id !== keepId && new Date(row.signed_in_at).getTime() <= keepStarted)
      .map((row) =>
        supabase.from(TABLE).update({ signed_out_at: row.last_seen_at }).eq('id', row.id).is('signed_out_at', null),
      ),
  )
}

async function adoptFreshOpenSession(userId) {
  const open = await listOpenSessions(userId)
  const now = Date.now()
  const fresh = open.find((row) => now - new Date(row.last_seen_at).getTime() <= STALE_MS)
  if (!fresh) return false

  writeStoredId(fresh.id)
  await supabase
    .from(TABLE)
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', fresh.id)
    .is('signed_out_at', null)
  await closeOlderOpenSessions(userId, fresh.id)
  return true
}

/** Start or resume the current browser's admin visit. Safe to call more than once. */
export async function startAdminPresence() {
  if (!acceptPresence || !supabase) return
  const { data: sessionData } = await supabase.auth.getSession()
  const user = sessionData.session?.user
  if (!user?.id) return

  const storedId = readStoredId()
  if (storedId) {
    const resumed = await resumeOpenSession(storedId, user.id)
    if (resumed) {
      await closeOlderOpenSessions(user.id, storedId)
      return
    }
    writeStoredId('')
  }

  if (await adoptFreshOpenSession(user.id)) return

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 512) : ''
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: user.id,
      email: user.email || 'unknown',
      user_agent: userAgent,
    })
    .select('id')
    .single()

  if (error || !data?.id) return
  if (!acceptPresence) {
    const now = new Date().toISOString()
    await supabase.from(TABLE).update({ signed_out_at: now, last_seen_at: now }).eq('id', data.id).is('signed_out_at', null)
    return
  }

  writeStoredId(data.id)
  await closeOlderOpenSessions(user.id, data.id)
}

/** Refresh last-seen while the panel stays open. */
export async function touchAdminPresence() {
  if (!acceptPresence || !supabase) return
  const id = readStoredId()
  if (!id) {
    await startAdminPresence()
    return
  }
  const { data, error } = await supabase
    .from(TABLE)
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', id)
    .is('signed_out_at', null)
    .select('id')

  if (!acceptPresence || error) return
  if (!data?.length) {
    writeStoredId('')
    await startAdminPresence()
    return
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user?.id
  if (userId) await closeOlderOpenSessions(userId, id)
}

/** Mark the current visit as signed out. Call this before auth.signOut(). */
export async function endAdminPresence() {
  acceptPresence = false
  const id = readStoredId()
  writeStoredId('')
  if (!supabase || !id) return
  const now = new Date().toISOString()
  await supabase.from(TABLE).update({ signed_out_at: now, last_seen_at: now }).eq('id', id).is('signed_out_at', null)
}

/** Heartbeat for as long as the admin shell is mounted. */
export function watchAdminPresence() {
  acceptPresence = true
  void startAdminPresence()
  const timer = window.setInterval(() => {
    void touchAdminPresence()
  }, ADMIN_PRESENCE_HEARTBEAT_MS)

  const onHide = () => {
    if (document.visibilityState === 'hidden') void touchAdminPresence()
  }
  const onPageHide = () => {
    void touchAdminPresence()
  }
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', onPageHide)

  return () => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', onPageHide)
  }
}

/** Earlier admin logins kept by the login system. No sign-out time is stored. */
export async function listAdminAuthHistory() {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('list_admin_auth_history')
  if (error) throw error
  return data || []
}

export async function listAdminLoginSessions(limit = 200) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, user_id, email, signed_in_at, last_seen_at, signed_out_at, user_agent')
    .order('signed_in_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

/**
 * @param {{ signed_in_at: string, last_seen_at: string, signed_out_at: string | null }} row
 * @param {number} [now]
 */
export function adminSessionStatus(row, now = Date.now()) {
  if (row.signed_out_at) {
    return { state: 'left', leftAt: row.signed_out_at, endedBy: 'sign-out' }
  }
  const seen = new Date(row.last_seen_at).getTime()
  if (Number.isFinite(seen) && now - seen <= ADMIN_PRESENCE_ONLINE_MS) {
    return { state: 'online', leftAt: null, endedBy: null }
  }
  return { state: 'closed', leftAt: row.last_seen_at, endedBy: 'browser' }
}

/**
 * @param {{ signed_in_at: string, last_seen_at: string, signed_out_at: string | null }} row
 * @param {number} [now]
 */
export function adminSessionDurationMs(row, now = Date.now()) {
  const start = new Date(row.signed_in_at).getTime()
  if (!Number.isFinite(start)) return 0
  const status = adminSessionStatus(row, now)
  const end = status.state === 'online' ? now : new Date(status.leftAt).getTime()
  if (!Number.isFinite(end)) return 0
  return Math.max(0, end - start)
}
