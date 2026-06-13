/** Find the scroll container that should move for a quote wizard field. */
export function findQuoteScrollRoot(fromEl) {
  if (!fromEl) return document.documentElement

  const seoMain = document.querySelector('#seo-quote .quote-flow-main')
  if (seoMain?.contains(fromEl)) {
    const { overflowY } = getComputedStyle(seoMain)
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return seoMain
    }
  }

  let node = fromEl.parentElement
  while (node && node !== document.documentElement) {
    const { overflowY } = getComputedStyle(node)
    if (
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      node.scrollHeight > node.clientHeight + 2
    ) {
      return node
    }
    node = node.parentElement
  }

  return document.documentElement
}

export function scrollRootBy(root, delta, behavior = 'auto') {
  if (!delta) return
  if (root === document.documentElement) {
    window.scrollBy({ top: delta, behavior })
    return
  }
  root.scrollBy({ top: delta, behavior })
}

/**
 * @param {'picker' | 'panel-only'} [mode]
 *   picker — scroll anchor + panel into view (floor/property pickers)
 *   panel-only — scroll only if panel bottom is cut off (address suggestions)
 */
export function revealQuoteFloatingPanel(
  anchor,
  { panelTop, panelHeight, mode = 'picker', anchorTopOffset = 112 },
) {
  if (!anchor) return

  const viewportHeight = window.visualViewport?.height ?? window.innerHeight
  const scrollRoot = findQuoteScrollRoot(anchor)
  const anchorRect = anchor.getBoundingClientRect()
  const panelBottom = panelTop + panelHeight

  let delta = 0

  if (mode === 'picker' && anchorRect.top > anchorTopOffset) {
    delta = anchorRect.top - anchorTopOffset
  }

  const overflowBottom = panelBottom - viewportHeight + 16
  if (overflowBottom > 0) {
    delta = mode === 'picker' ? Math.max(delta, overflowBottom) : overflowBottom
  }

  if (Math.abs(delta) < 8) return
  scrollRootBy(scrollRoot, delta)
}
