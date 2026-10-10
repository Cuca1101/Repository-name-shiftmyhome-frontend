import { useEffect, useState } from 'react'
import { buildMoveTimeline, formatMoveDateTime, NOT_RECORDED } from '../../lib/moveTimeline'
import { trackingClient } from '../../lib/jobCustomerTracking'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import {
  attachSignedUrlsToJobPhotos,
  fetchJobPhotosForAdminLookup,
} from '../../lib/data/jobPhotosRepository'

/**
 * @param {{
 *   variant?: 'customer' | 'admin',
 *   token?: string,
 *   quoteId?: string,
 *   quoteRef?: string,
 *   completedAt?: string | null,
 * }} props
 */
export default function MoveTimeline({
  variant = 'customer',
  token = '',
  quoteId = '',
  quoteRef = '',
  completedAt = null,
}) {
  const [events, setEvents] = useState([])
  const [photos, setPhotos] = useState([])
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [correctionFor, setCorrectionFor] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setReady(false)
      setLoadError('')
      try {
        if (variant === 'admin' && supabase && quoteId) {
          const history = await supabase
            .from('job_status_history')
            .select('id, status, occurred_at, created_at, source, stop_type, latitude, longitude, accuracy_m, notes, driver_id, driver_name, corrects_event_id, correction_reason, actor_name')
            .eq('quote_id', quoteId)
            .order('created_at', { ascending: true })
          if (history.error) throw history.error
          let withUrls = []
          try {
            const photoResult = await fetchJobPhotosForAdminLookup({ quoteRef, quoteRow: { id: quoteId, quote_ref: quoteRef } })
            withUrls = await attachSignedUrlsToJobPhotos(photoResult.rows || [])
          } catch {
            withUrls = []
          }
          if (!cancelled) {
            setEvents(history.data || [])
            setPhotos(withUrls)
          }
        } else if (token) {
          const client = trackingClient()
          if (!client) {
            if (!cancelled) setLoadError('The timeline could not be loaded.')
            return
          }
          const { data: timeline, error: timelineError } = await client.rpc('public_get_job_move_timeline', { p_token: token })
          if (timelineError || timeline?.ok === false) {
            throw timelineError || new Error(timeline?.error || 'timeline_failed')
          }
          let nextPhotos = []
          try {
            const media = await client.functions.invoke('get-job-tracking-media', { body: { token } })
            nextPhotos = Array.isArray(media.data?.photos) ? media.data.photos : []
          } catch {
            nextPhotos = []
          }
          if (!cancelled) {
            setEvents(Array.isArray(timeline?.events) ? timeline.events : [])
            setPhotos(nextPhotos)
          }
        } else if (!cancelled) {
          setEvents([])
          setPhotos([])
        }
      } catch {
        if (!cancelled) {
          setEvents([])
          setPhotos([])
          setLoadError('The timeline could not be loaded.')
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [variant, token, quoteId, quoteRef, notice])

  const timeline = buildMoveTimeline(events, photos, { completedAt })
  const admin = variant === 'admin'

  async function saveCorrection(event) {
    if (!supabase || !event?.id) return
    const text = reason.trim()
    if (!text) {
      setNotice('Add the reason for the correction.')
      return
    }
    setSaving(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const actor = userData?.user?.email || 'Admin'
      const { error } = await supabase.from('job_status_history').insert({
        quote_id: quoteId,
        driver_id: event.driver_id,
        status: 'correction',
        occurred_at: new Date().toISOString(),
        notes: text,
        corrects_event_id: event.id,
        correction_reason: text,
        actor_name: actor,
        driver_name: event.driver_name || null,
        stop_type: event.stop_type || null,
      })
      if (error) {
        setNotice(error.message || 'Could not save the correction.')
        return
      }
      setReason('')
      setCorrectionFor('')
      setNotice('Correction recorded. The original event is unchanged.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-bold text-slate-900 sm:text-lg">Move timeline</h2>
      <p className="mt-1 text-sm text-slate-500">
        Times are shown in UK time. Stages without a recorded driver action stay as {NOT_RECORDED}.
      </p>
      {!ready ? <p className="mt-3 text-sm text-slate-500">Loading the timeline…</p> : null}
      {ready && loadError ? <p className="mt-3 text-sm text-slate-700">{loadError}</p> : null}
      {ready && !loadError ? <ol className="mt-4 space-y-3">
        {timeline.milestones.map((step) => (
          <li key={step.key} className="rounded-xl border border-slate-200 px-3 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-bold text-slate-900">{step.label}</p>
              <p className="text-sm font-semibold text-slate-800">{step.whenLabel}</p>
            </div>
            {admin ? <AdminFacts step={step} /> : null}
            {!admin && step.showReceived ? (
              <p className="mt-1 text-xs text-slate-500">Received by server: {step.receivedLabel}</p>
            ) : null}
            {step.notes ? <p className="mt-2 text-sm text-slate-700">{step.notes}</p> : null}
            <PhotoRow photos={step.photos} />
            {step.corrections.map((row) => (
              <p key={row.id} className="mt-2 text-sm text-slate-600">
                Correction by {row.actor_name || NOT_RECORDED} at {formatMoveDateTime(row.occurred_at || row.created_at)}
                {row.correction_reason || row.notes ? `: ${row.correction_reason || row.notes}` : ''}
              </p>
            ))}
            {admin && step.event?.id ? (
              <div className="mt-2">
                {correctionFor === step.event.id ? (
                  <form
                    className="flex flex-col gap-2 sm:flex-row"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void saveCorrection(step.event)
                    }}
                  >
                    <input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Reason for the correction"
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <button type="submit" disabled={saving} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                      {saving ? 'Saving…' : 'Save correction'}
                    </button>
                  </form>
                ) : (
                  <button type="button" className="text-sm font-semibold text-brand-700" onClick={() => { setCorrectionFor(step.event.id); setReason(''); setNotice('') }}>
                    Record a correction
                  </button>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ol> : null}

      {ready && !loadError && timeline.contacts.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-bold text-slate-900">Customer contact</h3>
          <ul className="mt-2 space-y-2">
            {timeline.contacts.map((item) => (
              <li key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
                <p className="font-bold text-slate-900">{item.label}</p>
                <p className="mt-1 text-slate-700">{item.whenLabel} · {item.stage}</p>
                {item.notes ? <p className="mt-1 text-slate-800">{item.notes}</p> : <p className="mt-1 text-slate-500">No explanation recorded.</p>}
                {admin ? (
                  <p className="mt-1 text-slate-600">
                    {item.driverName} · {item.sourceLabel}
                    {item.latitude != null ? ` · ${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}` : ' · Position not recorded'}
                    {item.accuracyM != null ? ` · ${Math.round(item.accuracyM)} m` : ' · Accuracy not recorded'}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ready && !loadError && admin && timeline.other.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-bold text-slate-900">Other recorded events</h3>
          <ul className="mt-2 space-y-2">
            {timeline.other.map((row) => (
              <li key={row.id} className="rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
                <p className="font-bold text-slate-900">{String(row.status || 'Event').replaceAll('_', ' ')}</p>
                <p className="mt-1">{formatMoveDateTime(row.occurred_at || row.created_at)}</p>
                <p className="mt-1 text-slate-600">
                  {row.driver_name || NOT_RECORDED}
                  {' · '}
                  {row.source === 'manual' ? 'Manual action' : row.source === 'gps' ? 'GPS detection' : NOT_RECORDED}
                </p>
                {row.notes ? <p className="mt-1">{row.notes}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ready && !loadError && admin && timeline.unmatchedPhotos.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-bold text-slate-900">Other evidence</h3>
          <PhotoRow photos={timeline.unmatchedPhotos} />
        </div>
      ) : null}
      {notice ? <p className="mt-3 text-sm text-slate-700">{notice}</p> : null}
      {!isSupabaseConfigured && admin ? <p className="mt-3 text-sm text-slate-500">Timeline storage is not configured.</p> : null}
    </section>
  )
}

function AdminFacts({ step }) {
  if (!step.recorded) return null
  const position = step.latitude != null && step.longitude != null
    ? `${step.latitude.toFixed(5)}, ${step.longitude.toFixed(5)}`
    : NOT_RECORDED
  const accuracy = step.accuracyM != null ? `${Math.round(step.accuracyM)} m` : NOT_RECORDED
  return (
    <dl className="mt-2 grid grid-cols-1 gap-1 text-xs text-slate-600 sm:grid-cols-2">
      <div>Driver: {step.driverName}</div>
      <div>Source: {step.sourceLabel}</div>
      <div>When it happened: {step.occurredLabel}</div>
      <div>Received by server: {step.receivedLabel}</div>
      <div>GPS: {position}</div>
      <div>Accuracy: {accuracy}</div>
    </dl>
  )
}

function PhotoRow({ photos }) {
  if (!photos?.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {photos.map((photo) => {
        const src = photo.signed_url || photo.signedUrl || ''
        const label = photo.photo_type || 'Photo'
        return src ? (
          <a key={photo.id || src} href={src} target="_blank" rel="noreferrer" className="block">
            <img src={src} alt={String(label)} className="h-16 w-16 rounded-lg object-cover" />
          </a>
        ) : (
          <span key={photo.id || label} className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">{label}</span>
        )
      })}
    </div>
  )
}
