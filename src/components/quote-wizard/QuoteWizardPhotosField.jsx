import { useRef } from 'react'

const MAX_PHOTOS = 12

/**
 * Step 3 photo picker — files held in wizard context, not the native input value.
 * @param {{
 *   files: File[],
 *   onAddFiles: (fileList: FileList | File[]) => void,
 *   onRemoveAt: (index: number) => void,
 *   onClearAll: () => void,
 *   inputId?: string,
 *   variant?: 'desktop' | 'mobile',
 * }} props
 */
export default function QuoteWizardPhotosField({
  files,
  onAddFiles,
  onRemoveAt,
  onClearAll,
  inputId = 'quote-wizard-photos',
  variant = 'desktop',
}) {
  const inputRef = useRef(null)
  const count = files.length

  function handleInputChange(e) {
    const list = e.target.files
    if (list?.length) onAddFiles(list)
    e.target.value = ''
  }

  const statusText =
    count === 0
      ? 'No file chosen'
      : `${count} photo${count === 1 ? '' : 's'} selected`

  const fileList = count > 0 ? (
    <div className="mt-2 space-y-2">
      <ul className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-slate-200/80 bg-white/80 px-2 py-1.5 text-xs text-slate-700">
        {files.map((file, index) => (
          <li key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate" title={file.name}>
              {file.name}
            </span>
            <button
              type="button"
              onClick={() => onRemoveAt(index)}
              className="shrink-0 font-semibold text-brand-700 hover:underline"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
      >
        Clear selected photos
      </button>
    </div>
  ) : null

  const hiddenInput = (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept="image/*"
      multiple
      className="sr-only"
      onChange={handleInputChange}
    />
  )

  if (variant === 'mobile') {
    const card = 'min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm'
    return (
      <div className={`${card} p-3`}>
        <p className="text-sm font-bold text-slate-900">Photos (optional)</p>
        <label
          htmlFor={inputId}
          className="mt-2 inline-flex min-h-[40px] cursor-pointer items-center rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-900 transition active:scale-[0.98]"
        >
          {count > 0 ? 'Add more photos' : 'Choose photos'}
        </label>
        {hiddenInput}
        <p className="mt-2 text-sm text-slate-500">{statusText}</p>
        {fileList}
        <p className="mt-2 text-xs text-slate-500">
          Helpful for access or large items. Filenames are noted on your quote.
        </p>
      </div>
    )
  }

  const label = 'mb-1.5 block text-sm font-medium text-slate-700'
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-5">
      <label htmlFor={inputId} className={label}>
        Photos (optional)
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        onChange={handleInputChange}
        className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700"
      />
      <p className="mt-2 text-sm text-slate-600">{statusText}</p>
      {fileList}
      <p className="mt-2 text-xs text-slate-500">
        Helpful for access or large items. Filenames are noted on your quote.
      </p>
    </div>
  )
}

export { MAX_PHOTOS }
