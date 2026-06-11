import { useCallback, useEffect, useState } from 'react'

/**
 * Positions a fixed portal panel directly below an anchor element.
 * @param {React.RefObject<HTMLElement | null>} anchorRef
 * @param {boolean} open
 * @param {{ maxHeight?: number, gap?: number }} [options]
 */
export function useFloatingPanelBelow(anchorRef, open, { maxHeight = 320, gap = 4 } = {}) {
  const [panelStyle, setPanelStyle] = useState(null)

  const updatePanelPosition = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight
    const calculatedMax = Math.min(maxHeight, Math.max(120, viewportHeight - rect.bottom - gap - 8))
    setPanelStyle({
      top: rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      maxHeight: calculatedMax,
    })
  }, [anchorRef, maxHeight, gap])

  useEffect(() => {
    if (!open) {
      setPanelStyle(null)
      return undefined
    }
    updatePanelPosition()
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', updatePanelPosition)
    viewport?.addEventListener('scroll', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    window.addEventListener('resize', updatePanelPosition)
    return () => {
      viewport?.removeEventListener('resize', updatePanelPosition)
      viewport?.removeEventListener('scroll', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
      window.removeEventListener('resize', updatePanelPosition)
    }
  }, [open, updatePanelPosition])

  return panelStyle
}
