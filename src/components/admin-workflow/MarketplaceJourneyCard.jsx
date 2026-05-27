import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchQuotesByBundledJourneyId } from '../../lib/data/quotesAdminRepository'
import { formatDateUK } from '../../lib/formatDateDisplay'
import { formatJourneyDurationHhMm } from '../../lib/journeyPlannerModel'
import {
  readManualOverridesFromQuotes,
  readPerJobPayoutsFromQuotes,
  splitJourneyDriverPayout,
} from '../../lib/journeyPayoutSplit'
import MarketplaceJourneyCardActions from './MarketplaceJourneyCardActions'
import MarketplaceJourneyRemoveButtons from './MarketplaceJourneyRemoveButtons'

function money(n) {
  if (n == null || n === '') return '—'
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return `£${x.toFixed(2)}`
}

/**
 * @param {{ journey: Record<string, unknown>, onApplied: () => void | Promise<void> }} props
 */
export default function MarketplaceJourneyCard({ journey, onApplied }) {
  const j = journey && typeof journey === 'object' ? journey : {}
  const id = String(j.id || '')
  const ref = j.journey_ref != null ? String(j.journey_ref) : id.slice(0, 8)
  const title =
    (j.summary_title != null && String(j.summary_title).trim()) ||
    (j.title != null && String(j.title).trim()) ||
    'Journey bundle'
  const fromPc = j.from_postcode != null ? String(j.from_postcode) : '—'
  const toPc = j.to_postcode != null ? String(j.to_postcode) : '—'
  const move =
    j.move_date != null && String(j.move_date).trim() ? formatDateUK(String(j.move_date)) : '—'
  const tw = j.time_range_summary != null ? String(j.time_range_summary) : '—'
  const miles = j.total_miles != null && Number.isFinite(Number(j.total_miles)) ? `${Number(j.total_miles).toFixed(1)} mi` : '—'
  const totalDurSec =
    j.total_duration_seconds != null && Number.isFinite(Number(j.total_duration_seconds))
      ? Math.round(Number(j.total_duration_seconds))
      : 0
  const totalDurationLabel = totalDurSec > 0 ? formatJourneyDurationHhMm(totalDurSec) : '—'
  const driveSec = j.total_drive_seconds != null ? Math.round(Number(j.total_drive_seconds)) : 0
  const driveM = Math.floor(driveSec / 60)
  const driveH = Math.floor(driveM / 60)
  const driveLabel =
    driveSec <= 0 ? '—' : driveH > 0 ? `${driveH}h ${String(driveM % 60).padStart(2, '0')}m` : `${driveM}m`
  const jobs = j.jobs_count != null ? Number(j.jobs_count) : 0
  const totalVol =
    j.total_volume_m3 != null && Number.isFinite(Number(j.total_volume_m3))
      ? `${Number(j.total_volume_m3).toFixed(2)} m³`
      : '—'
  const journeyPayoutRaw = j.marketplace_payout_price
  const journeyPayoutNum =
    journeyPayoutRaw != null && Number.isFinite(Number(journeyPayoutRaw)) ? Number(journeyPayoutRaw) : null
  const payout = money(journeyPayoutNum)
  const tags = Array.isArray(j.requirements_tags) ? j.requirements_tags.map(String) : []
  const hidden = Boolean(j.partner_dashboard_hidden)

  const [bundledQuotes, setBundledQuotes] = useState(/** @type {Record<string, unknown>[]} */ ([]))

  useEffect(() => {
    if (!id) {
      setBundledQuotes([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const rows = await fetchQuotesByBundledJourneyId(id)
        if (!cancelled) setBundledQuotes(rows)
      } catch {
        if (!cancelled) setBundledQuotes([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, j.updated_at])

  const perJobPayouts = useMemo(() => readPerJobPayoutsFromQuotes(bundledQuotes), [bundledQuotes])

  const perJobAuto = useMemo(() => {
    if (journeyPayoutNum == null || bundledQuotes.length === 0) return null
    const ids = bundledQuotes.map((q) => String(q.id || '').trim()).filter(Boolean)
    const manual = readManualOverridesFromQuotes(bundledQuotes)
    const split = splitJourneyDriverPayout(journeyPayoutNum, ids, manual)
    return split.perJobAuto
  }, [journeyPayoutNum, bundledQuotes])

  const jobCountDisplay = bundledQuotes.length > 0 ? bundledQuotes.length : jobs

  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-white via-violet-50/30 to-white shadow-md ring-1 ring-slate-900/[0.04]">
      <div className="border-b border-violet-100 bg-violet-600/90 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-violet-100">Journey {ref}</p>
          {hidden ? (
            <span className="rounded-full bg-amber-500/90 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">
              Hidden from partners
            </span>
          ) : (
            <span className="rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">
              Live on marketplace
            </span>
          )}
        </div>
        <h3 className="mt-1 text-lg font-bold leading-snug text-white sm:text-xl">{title}</h3>
        <p className="mt-1 text-sm font-medium text-violet-100">
          {fromPc} → {toPc}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">Driver journey offer</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-950">{payout}</p>
          <p className="mt-1 text-sm font-semibold text-emerald-900">
            {jobCountDisplay} job{jobCountDisplay === 1 ? '' : 's'}
            {perJobAuto != null ? (
              <>
                {' · '}
                <span className="text-violet-900">£{perJobAuto.toFixed(2)} per job</span>
              </>
            ) : null}
          </p>
          <p className="mt-1 text-[11px] text-emerald-800/90">
            Total driver payout for the bundle — not reduced again from customer price.
          </p>
        </div>

        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <dt className="font-semibold uppercase tracking-wide text-slate-500">Date</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{move}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <dt className="font-semibold uppercase tracking-wide text-slate-500">Time windows</dt>
            <dd className="mt-0.5 font-medium leading-snug text-slate-900">{tw}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <dt className="font-semibold uppercase tracking-wide text-slate-500">Driving distance</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{miles}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <dt className="font-semibold uppercase tracking-wide text-slate-500">Total duration</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{totalDurationLabel}</dd>
            <dd className="mt-0.5 text-[11px] text-slate-500">Drive time {driveLabel}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <dt className="font-semibold uppercase tracking-wide text-slate-500">Jobs in bundle</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{jobCountDisplay}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <dt className="font-semibold uppercase tracking-wide text-slate-500">Total volume (combined)</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{totalVol}</dd>
          </div>
        </dl>

        {bundledQuotes.length > 0 ? (
          <div className="rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-violet-800">Per-job payout</p>
            <ul className="mt-1.5 space-y-1 text-xs text-slate-800">
              {bundledQuotes.map((q) => {
                const qid = String(q.id || '')
                const qref = String(q.quote_ref || qid.slice(0, 8))
                const amt = perJobPayouts[qid]
                return (
                  <li key={qid} className="flex justify-between gap-2 font-mono">
                    <span className="font-semibold">{qref}</span>
                    <span className="tabular-nums font-bold text-violet-900">{money(amt)}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-800"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <Link
            to={`/admin/journey-planner/view/${encodeURIComponent(id)}`}
            className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-500 sm:flex-none"
          >
            Open journey
          </Link>
          <Link
            to={`/admin/journey-planner?journey=${encodeURIComponent(id)}`}
            className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 sm:flex-none"
          >
            Edit
          </Link>
        </div>

        <MarketplaceJourneyRemoveButtons journey={j} onApplied={onApplied} />

        <MarketplaceJourneyCardActions journey={j} onApplied={onApplied} />
      </div>
    </li>
  )
}
