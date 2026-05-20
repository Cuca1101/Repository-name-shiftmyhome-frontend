import { useCallback, useRef, useState } from 'react'
import { FileUp, Loader2, Trash2 } from 'lucide-react'
import { assertDriverDocumentFile } from '../../lib/data/driverDocumentConstants'
import { uploadDriverDocument, deleteDriverDocument } from '../../lib/data/driverDocumentsRepository'

/**
 * @param {{
 *   driverId?: string | null,
 *   documentType: import('../../lib/data/driverDocumentConstants.js').DriverDocumentType,
 *   label: string,
 *   hint?: string,
 *   disabled?: boolean,
 *   existing: (Record<string, unknown> & { signedUrl?: string | null }) | null,
 *   pendingFile?: File | null,
 *   onPendingFileChange?: (file: File | null) => void,
 *   onChange?: () => void,
 *   externalBusy?: boolean,
 * }} props
 */
export default function DriverDocumentUpload({
  driverId = null,
  documentType,
  label,
  hint,
  disabled = false,
  existing,
  pendingFile = null,
  onPendingFileChange,
  onChange,
  externalBusy = false,
}) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [err, setErr] = useState('')

  const deferUpload = !String(driverId || '').trim()
  const uploadedName = existing?.file_name != null ? String(existing.file_name) : ''
  const hasUploaded = Boolean(uploadedName)
  const hasPending = Boolean(pendingFile)
  const isLoading = busy || externalBusy
  const canInteract = !disabled && !isLoading

  const statusLabel = hasUploaded
    ? uploadedName
    : hasPending
      ? pendingFile.name
      : 'Not uploaded'

  const statusTone = hasUploaded
    ? 'text-emerald-800 bg-emerald-50 border-emerald-200/80'
    : hasPending
      ? 'text-amber-900 bg-amber-50 border-amber-200/80'
      : 'text-slate-500 bg-slate-50 border-slate-200'

  const handleFile = useCallback(
    async (file) => {
      if (!file || !canInteract) return
      setErr('')
      try {
        assertDriverDocumentFile(file)
      } catch (e) {
        setErr(e?.message || 'Invalid file')
        return
      }

      if (deferUpload) {
        onPendingFileChange?.(file)
        setDragOver(false)
        return
      }

      setBusy(true)
      try {
        await uploadDriverDocument(String(driverId), documentType, file)
        onPendingFileChange?.(null)
        onChange?.()
      } catch (e) {
        setErr(e?.message || 'Upload failed')
      } finally {
        setBusy(false)
        setDragOver(false)
      }
    },
    [canInteract, deferUpload, documentType, driverId, onChange, onPendingFileChange],
  )

  function onInputChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void handleFile(file)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    if (!canInteract) return
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  async function onRemove() {
    if (!canInteract) return
    setErr('')

    if (hasPending) {
      onPendingFileChange?.(null)
      return
    }

    if (!hasUploaded || !existing?.id) return

    setBusy(true)
    try {
      await deleteDriverDocument(String(existing.id))
      onChange?.()
    } catch (e) {
      setErr(e?.message || 'Remove failed')
    } finally {
      setBusy(false)
    }
  }

  const showRemove = hasUploaded || hasPending

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          {hint ? <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{hint}</p> : null}
        </div>
        {showRemove ? (
          <button
            type="button"
            disabled={!canInteract}
            onClick={() => void onRemove()}
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Remove
          </button>
        ) : null}
      </div>

      <div className={`mt-2 rounded-lg border px-3 py-2 ${statusTone}`}>
        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
          {hasUploaded ? 'Uploaded' : hasPending ? (deferUpload ? 'Selected (uploads on Save)' : 'Uploading…') : 'Status'}
        </p>
        <p className="mt-0.5 truncate text-xs font-medium" title={statusLabel}>
          {statusLabel}
        </p>
        {hasUploaded && existing?.signedUrl ? (
          <a
            href={String(existing.signedUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs font-semibold text-brand-700 hover:underline"
          >
            View (signed link)
          </a>
        ) : null}
      </div>

      <div
        role="button"
        tabIndex={canInteract ? 0 : -1}
        onKeyDown={(e) => {
          if (canInteract && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          if (canInteract) setDragOver(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setDragOver(false)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (canInteract) e.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={onDrop}
        className={`mt-2 flex min-h-[72px] flex-col items-center justify-center rounded-xl border-2 border-dashed px-3 py-3 text-center transition ${
          dragOver
            ? 'border-brand-400 bg-brand-50/80'
            : 'border-slate-200 bg-slate-50/80'
        } ${canInteract ? 'cursor-pointer hover:border-brand-300 hover:bg-brand-50/40' : 'cursor-not-allowed opacity-50'}`}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" aria-hidden />
        ) : (
          <FileUp className="h-5 w-5 text-slate-400" aria-hidden />
        )}
        <p className="mt-1.5 text-xs font-semibold text-slate-700">
          {isLoading ? 'Uploading…' : 'Drag & drop or tap below'}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">JPEG, PNG, WebP, HEIC, or PDF · max 10 MB</p>
      </div>

      <button
        type="button"
        disabled={!canInteract}
        onClick={() => inputRef.current?.click()}
        className="mt-2 inline-flex min-h-[40px] w-full items-center justify-center rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900 hover:bg-brand-100 disabled:opacity-50"
      >
        {hasUploaded || hasPending ? 'Replace' : 'Upload'}
      </button>

      {isLoading ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-brand-500" />
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
        disabled={!canInteract}
        onChange={onInputChange}
      />

      {err ? <p className="mt-2 text-xs text-red-700">{err}</p> : null}
    </div>
  )
}
