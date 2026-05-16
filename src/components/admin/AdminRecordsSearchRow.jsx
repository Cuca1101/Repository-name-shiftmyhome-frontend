import { ADMIN_RECORDS_SEARCH_PLACEHOLDER } from '../../lib/adminSearch'

/**
 * Shared search row for admin quote/job tables — same markup as Quote requests / Job cards.
 *
 * @param {{
 *   searchInput: string,
 *   onSearchInputChange: (e: import('react').ChangeEvent<HTMLInputElement>) => void,
 *   onSearchSubmit: () => void,
 *   placeholder?: string,
 * }} props
 */
export default function AdminRecordsSearchRow({
  searchInput,
  onSearchInputChange,
  onSearchSubmit,
  placeholder = ADMIN_RECORDS_SEARCH_PLACEHOLDER,
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="min-w-0 flex-1 sm:max-w-md">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search</span>
        <input
          type="search"
          enterKeyHint="search"
          placeholder={placeholder}
          value={searchInput}
          onChange={onSearchInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSearchSubmit()
          }}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <button
        type="button"
        onClick={onSearchSubmit}
        className="min-h-[48px] rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 sm:min-h-[46px]"
      >
        Search
      </button>
    </div>
  )
}
