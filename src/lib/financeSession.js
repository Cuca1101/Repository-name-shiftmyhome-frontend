import { isSupabaseConfigured, supabase } from './supabase'

let token = ''
let accessToken = ''
let chain = Promise.resolve()

function rememberSession(session) {
  accessToken = session?.access_token || ''
}

if (isSupabaseConfigured && supabase) {
  void supabase.auth.getSession().then(({ data }) => rememberSession(data.session))
  supabase.auth.onAuthStateChange((_event, session) => rememberSession(session))
}

/** Run unlock and lock calls one after another so a late lock cannot wipe a new session. */
export function enqueueFinanceSession(task) {
  const run = chain.then(task, task)
  chain = run.then(
    () => {},
    () => {},
  )
  return run
}

export function getFinanceToken() {
  return token
}

export function setFinanceToken(next) {
  token = next ? String(next) : ''
}

export function clearFinanceToken() {
  token = ''
}

async function lockAllOnServer() {
  if (!isSupabaseConfigured || !supabase) return
  await supabase.rpc('finance_lock_all')
}

/** Clear leftover server sessions before the PIN form is allowed to unlock. */
export function beginFinanceVisit() {
  clearFinanceToken()
  return enqueueFinanceSession(async () => {
    try {
      await lockAllOnServer()
    } catch {
      /* The PIN screen stays up even if the lock call cannot reach the server. */
    }
  })
}

/**
 * Drop the in-memory token and the server session.
 * Safe to call when leaving the module, refreshing, or logging out.
 */
export function lockFinanceAccess() {
  const current = token
  token = ''
  return enqueueFinanceSession(async () => {
    if (!isSupabaseConfigured || !supabase) return
    try {
      if (current) await supabase.rpc('finance_lock', { p_token: current })
      await supabase.rpc('finance_lock_all')
    } catch {
      /* The screen is already locked. */
    }
  })
}

/** Best-effort lock when the tab is closing and an async call may be cancelled. */
export function lockFinanceKeepalive() {
  clearFinanceToken()
  const url = String(supabase?.supabaseUrl || '').replace(/\/$/, '')
  const key = supabase?.supabaseKey || ''
  if (!url || !key || !accessToken) return
  try {
    void fetch(`${url}/rest/v1/rpc/finance_lock_all`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: key,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
  } catch {
    /* The in-memory token is already gone. */
  }
}
