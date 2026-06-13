import { useCallback, useEffect, useRef, useState } from 'react'
import { revealQuoteFloatingPanel } from '../../lib/quoteScrollRoot'

/**
 * Positions a fixed portal panel directly below an anchor element.
 * @param {React.RefObject<HTMLElement | null>} anchorRef
 * @param {boolean} open
 * @param {{
 *   maxHeight?: number,
 *   gap?: number,
 *   autoReveal?: boolean,
 *   preferBelow?: boolean,
 *   revealMode?: 'picker' | 'panel-only',
 * }} [options]
 */
export function useFloatingPanelBelow(
  anchorRef,
  open,
  {
    maxHeight = 320,
    gap = 4,
    autoReveal = false,
    preferBelow = false,
    revealMode = 'picker',
  } = {},
) {
  const [panelStyle, setPanelStyle] = useState(null)
  const revealedRef = useRef(false)

  const updatePanelPosition = useCallback(
    (shouldReveal = false) => {
      const anchor = anchorRef.current
      if (!anchor) return

      const rect = anchor.getBoundingClientRect()
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const spaceBelow = Math.max(0, viewportHeight - rect.bottom - gap - 8)
      const spaceAbove = Math.max(0, rect.top - gap - 8)
      const minComfort = 220
      const openAbove =
        !preferBelow && spaceBelow < minComfort && spaceAbove > spaceBelow

      const available = openAbove ? spaceAbove : spaceBelow
      const calculatedMax = Math.min(maxHeight, Math.max(120, available))
      const top = openAbove ? Math.max(8, rect.top - gap - calculatedMax) : rect.bottom + gap

      const nextStyle = {
        top,
        left: rect.left,
        width: rect.width,
        maxHeight: calculatedMax,
      }

      setPanelStyle(nextStyle)

      if (autoReveal && shouldReveal && !revealedRef.current) {
        revealedRef.current = true
        requestAnimationFrame(() => {
          revealQuoteFloatingPanel(anchor, {
            panelTop: top,
            panelHeight: calculatedMax,
            mode: revealMode,
          })
        })
      }
    },
    [anchorRef, maxHeight, gap, autoReveal, preferBelow, revealMode],
  )

  useEffect(() => {
    if (!open) {
      setPanelStyle(null)
      revealedRef.current = false
      return undefined
    }

    updatePanelPosition(true)

    const reposition = () => updatePanelPosition(false)
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', reposition)
    viewport?.addEventListener('scroll', reposition)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      viewport?.removeEventListener('resize', reposition)
      viewport?.removeEventListener('scroll', reposition)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open, updatePanelPosition])

  return panelStyle
}
