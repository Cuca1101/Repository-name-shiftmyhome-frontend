import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getLocalDateYYYYMMDD } from '../../lib/moveDateLocal'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function parseIso(iso) {
  const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function toIso(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1)
}

function monthCells(view) {
  const first = startOfMonth(view)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < lead; i += 1) cells.push(null)
  for (let day = 1; day <= days; day += 1) {
    cells.push(new Date(view.getFullYear(), view.getMonth(), day))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/**
 * Month grid for the quote move date. Stores YYYY-MM-DD, same as the old date input.
 */
export default function QuoteMoveDateCalendar({ value, onChange, id = 'quote-move-date' }) {
  const today = getLocalDateYYYYMMDD()
  const selected = parseIso(value)
  const [view, setView] = useState(() => startOfMonth(selected || parseIso(today)))
  const cells = useMemo(() => monthCells(view), [view])
  const monthLabel = view.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const thisMonth = startOfMonth(parseIso(today))
  const canGoBack = view > thisMonth

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Previous month"
          disabled={!canGoBack}
          onClick={() => setView((current) => addMonths(current, -1))}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <p className="text-sm font-semibold text-slate-900">{monthLabel}</p>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100"
          aria-label="Next month"
          onClick={() => setView((current) => addMonths(current, 1))}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((day) => (
          <span key={day} className="py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {day}
          </span>
        ))}
        {cells.map((date, index) => {
          if (!date) return <span key={`empty-${index}`} />
          const iso = toIso(date)
          const isSelected = iso === String(value || '')
          const isToday = iso === today
          const disabled = iso < today
          return (
            <button
              key={iso}
              id={isSelected ? id : undefined}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => onChange(iso)}
              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : disabled
                    ? 'cursor-not-allowed text-slate-300'
                    : isToday
                      ? 'text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50'
                      : 'text-slate-800 hover:bg-slate-100'
              }`}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
