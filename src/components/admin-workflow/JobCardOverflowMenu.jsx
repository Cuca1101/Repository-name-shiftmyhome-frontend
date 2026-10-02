import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Secondary job-card actions. The menu is portaled so the card cannot clip it.
 * @param {{ children: import('react').ReactNode }} props
 */
export default function JobCardOverflowMenu({ children }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState(null)
  const rootRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onPointer(event) {
      const target = event.target
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggleMenu() {
    const button = rootRef.current?.querySelector('button')
    const rect = button?.getBoundingClientRect()
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom
      setPosition({
        top: spaceBelow < 180 ? rect.top - 4 : rect.bottom + 4,
        right: Math.max(8, window.innerWidth - rect.right),
        lift: spaceBelow < 180,
      })
    }
    setOpen((value) => !value)
  }

  const menu =
    open && position
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: position.top,
              right: position.right,
              transform: position.lift ? 'translateY(-100%)' : undefined,
              zIndex: 80,
            }}
            className="flex w-52 flex-col gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
          >
            {children}
          </div>,
          document.body,
        )
      : null

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        onClick={toggleMenu}
        className="inline-flex h-[34px] w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg leading-none text-slate-700 hover:bg-slate-50"
      >
        ⋯
      </button>
      {menu}
    </div>
  )
}
