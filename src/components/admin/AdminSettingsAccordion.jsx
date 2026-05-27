import { useCallback, useState } from 'react'
import { ChevronDown } from 'lucide-react'

const STORAGE_PREFIX = 'admin-settings-accordion:'

/**
 * @param {string} storageKey
 * @param {string[]} validIds
 */
function readStoredOpenId(storageKey, validIds) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`)
    if (raw == null) return null
    const parsed = JSON.parse(raw)
    const id = parsed?.openId
    if (id == null || id === '') return null
    return validIds.includes(id) ? id : null
  } catch {
    return null
  }
}

/**
 * @param {string} storageKey
 * @param {string | null} openId
 */
function writeStoredOpenId(storageKey, openId) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, JSON.stringify({ openId }))
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * @param {{
 *   id: string,
 *   title: string,
 *   open: boolean,
 *   onToggle: (id: string) => void,
 *   children: import('react').ReactNode,
 * }} props
 */
export function AdminSettingsAccordionPanel({ id, title, open, onToggle, children }) {
  const panelId = `admin-settings-panel-${id}`
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm">
      <button
        type="button"
        id={`${panelId}-trigger`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onToggle(id)}
        className="flex min-h-[40px] w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-slate-50/80 sm:min-h-[42px] sm:px-3.5"
      >
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={`${panelId}-trigger`}
          className="border-t border-slate-100 px-3 py-2.5 sm:px-3.5 sm:py-3"
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Single-expand admin settings accordion with localStorage persistence.
 * @param {{
 *   storageKey: string,
 *   items: { id: string, title: string, content: import('react').ReactNode }[],
 *   className?: string,
 * }} props
 */
export default function AdminSettingsAccordion({ storageKey, items, className = '' }) {
  const validIds = items.map((item) => item.id)
  const [openId, setOpenId] = useState(() => readStoredOpenId(storageKey, validIds))

  const toggle = useCallback(
    (id) => {
      setOpenId((current) => {
        const next = current === id ? null : id
        writeStoredOpenId(storageKey, next)
        return next
      })
    },
    [storageKey],
  )

  return (
    <div className={`space-y-1.5 ${className}`.trim()}>
      {items.map((item) => (
        <AdminSettingsAccordionPanel
          key={item.id}
          id={item.id}
          title={item.title}
          open={openId === item.id}
          onToggle={toggle}
        >
          {item.content}
        </AdminSettingsAccordionPanel>
      ))}
    </div>
  )
}
