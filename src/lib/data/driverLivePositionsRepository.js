import { isSupabaseConfigured, supabase } from '../supabase'

const TABLE = 'driver_live_positions'

/**
 * Latest row per driver_key (most recent updated_at wins).
 * @returns {Promise<Record<string, Record<string, unknown>>>}
 */
export async function fetchLatestDriverLivePositionsMap() {
  if (!isSupabaseConfigured || !supabase) return {}
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(500)
    if (error) return {}
    /** @type {Record<string, Record<string, unknown>>} */
    const out = {}
    for (const row of data ?? []) {
      const k = String(row?.driver_key || '').trim()
      if (!k || out[k]) continue
      out[k] = row
    }
    return out
  } catch {
    return {}
  }
}

/**
 * Subscribe to driver position changes (Supabase Realtime). No-op if unavailable.
 * @param {(payload: { eventType: string, new: Record<string, unknown> | null }) => void} onEvent
 * @returns {() => void} unsubscribe
 */
export function subscribeDriverLivePositions(onEvent) {
  if (!isSupabaseConfigured || !supabase) return () => {}
  try {
    const channel = supabase
      .channel('driver-live-positions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE },
        (payload) => {
          onEvent({
            eventType: payload.eventType,
            new: payload.new && typeof payload.new === 'object' ? payload.new : null,
          })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  } catch {
    return () => {}
  }
}
