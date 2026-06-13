import { useCallback, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingPanelBelow } from './useFloatingPanelBelow'

const labelClass = 'mb-1 block text-xs font-medium leading-snug text-slate-700'

const triggerClass =
  'box-border flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-base shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'

const optionRow =
  'flex min-h-[56px] w-full min-w-0 items-center gap-3 border-b border-slate-100 px-4 py-3 text-left text-base transition last:border-b-0 active:bg-brand-50'

function RadioIndicator({ selected }) {
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
        selected ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white'
      }`}
      aria-hidden
    >
      {selected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
    </span>
  )
}

/**
 * Mobile option picker — trigger + floating panel below (same pattern as address suggestions).
 * @param {{
 *   id: string,
 *   label: string,
 *   value: string | number | null | undefined,
 *   options: { value: string | number, label: string }[],
 *   onChange: (value: string | number) => void,
 *   placeholder?: string,
 *   open?: boolean,
 *   onOpenChange?: (open: boolean) => void,
 * }} props
 */
export default function MobileOptionBottomSheet({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose an option',
  open = false,
  onOpenChange,
}) {
  const listId = useId()
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const labelId = `${id}-label`
  const panelTitle = label

  const selected = options.find((o) => o.value === value)
  const display = selected ? selected.label : placeholder
  const isPlaceholder = !selected

  const panelStyle = useFloatingPanelBelow(triggerRef, open, {
    maxHeight: 400,
    autoReveal: true,
    revealMode: 'picker',
  })

  const closePanel = useCallback(() => {
    onOpenChange?.(false)
  }, [onOpenChange])

  const togglePanel = useCallback(() => {
    onOpenChange?.(!open)
  }, [onOpenChange, open])

  useEffect(() => {
    if (!open) return undefined
    function handlePointerDown(ev) {
      if (rootRef.current?.contains(ev.target)) return
      if (panelRef.current?.contains(ev.target)) return
      closePanel()
    }
    function handleKey(ev) {
      if (ev.key === 'Escape') closePanel()
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKey)
    }
  }, [open, closePanel])

  useEffect(() => {
    if (!open || !panelStyle) return undefined
    requestAnimationFrame(() => {
      if (panelRef.current) panelRef.current.scrollTop = 0
    })
    return undefined
  }, [open, panelStyle])

  function pick(next) {
    onChange(next)
    closePanel()
  }

  return (
    <div ref={rootRef} className="box-border min-w-0 w-full">
      <span className={labelClass} id={labelId}>
        {label}
      </span>

      <button
        ref={triggerRef}
        type="button"
        id={id}
        onClick={togglePanel}
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={triggerClass}
      >
        <span className={`min-w-0 flex-1 truncate ${isPlaceholder ? 'text-slate-500' : 'font-medium text-slate-900'}`}>
          {display}
        </span>
        <svg
          className={`h-5 w-5 shrink-0 text-slate-400 transition ${open ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {open && panelStyle && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              id={listId}
              role="listbox"
              aria-label={panelTitle}
              className="quote-floating-panel"
              style={{
                top: panelStyle.top,
                left: panelStyle.left,
                width: panelStyle.width,
                maxHeight: panelStyle.maxHeight,
              }}
            >
              {options.map((opt) => {
                const isSelected = value === opt.value
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => pick(opt.value)}
                    className={`${optionRow} ${isSelected ? 'bg-brand-50 font-medium text-brand-900' : 'text-slate-900'}`}
                  >
                    <span className="min-w-0 flex-1">{opt.label}</span>
                    <RadioIndicator selected={isSelected} />
                  </button>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
