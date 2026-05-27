import AvailableJobInventorySection from './AvailableJobInventorySection'
import QuotePhotosAdminSection from './QuotePhotosAdminSection'
import JobAcceptedPayoutSummaryPanel from './JobAcceptedPayoutSummaryPanel'

function Panel({ title, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-3 sm:p-4 ${className}`.trim()}>
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

/**
 * @param {{
 *   q: Record<string, unknown>,
 *   notesDraft: string,
 *   onNotesDraftChange: (v: string) => void,
 *   onSaveNotes: () => void,
 *   onAddTimelineNote: () => void,
 *   photoQuoteRef: string,
 *   jobId: string | null,
 *   linkedJob?: Record<string, unknown> | null,
 *   legacyPhotoFileNames?: string[],
 *   overrides: Record<string, unknown>,
 *   jobCharges?: Array<Record<string, unknown>>,
 * }} props
 */
export default function JobDispatchDetailExtras({
  q,
  notesDraft,
  onNotesDraftChange,
  onSaveNotes,
  onAddTimelineNote,
  photoQuoteRef,
  jobId,
  linkedJob = null,
  legacyPhotoFileNames = [],
  overrides,
  jobCharges = [],
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <AvailableJobInventorySection quote={q} />
      </div>

      <Panel title="Internal notes">
        <textarea
          value={notesDraft}
          onChange={(e) => onNotesDraftChange(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          placeholder="Driver brief, access notes…"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSaveNotes}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Save notes
          </button>
          <button
            type="button"
            onClick={onAddTimelineNote}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            Add timeline entry
          </button>
        </div>
        {(overrides.adminNotesLog || '').trim() ? (
          <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap rounded border border-slate-100 bg-slate-50 p-2 font-mono text-[10px] text-slate-700">
            {String(overrides.adminNotesLog)}
          </pre>
        ) : null}
      </Panel>

      <JobAcceptedPayoutSummaryPanel q={q} charges={jobCharges} />

      <Panel title="Photos" className="lg:col-span-2">
        <QuotePhotosAdminSection
          quoteRef={photoQuoteRef}
          jobId={jobId}
          quoteRow={q}
          linkedJob={linkedJob}
          legacyPhotoFileNames={legacyPhotoFileNames}
        />
      </Panel>
    </div>
  )
}
