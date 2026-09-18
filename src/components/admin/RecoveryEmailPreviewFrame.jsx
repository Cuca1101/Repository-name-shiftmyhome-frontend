import { useEffect, useRef } from 'react'

/**
 * Admin-only email preview. Links must never navigate the preview iframe
 * (Stripe Checkout / pay page refuse nested frames and appear stuck loading).
 */
export default function RecoveryEmailPreviewFrame({ html }) {
  const iframeRef = useRef(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !html) return undefined

    /** @type {Document | null} */
    let doc = null

    const openOutsidePreview = (href) => {
      const url = String(href || '').trim()
      if (!url || url === '#') return
      window.open(url, '_blank', 'noopener,noreferrer')
    }

    const onClick = (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return
      event.preventDefault()
      event.stopPropagation()
      openOutsidePreview(anchor.href || href)
    }

    const onLoad = () => {
      doc = iframe.contentDocument
      if (!doc) return
      doc.addEventListener('click', onClick, true)
    }

    iframe.addEventListener('load', onLoad)
    // srcDoc may already be parsed before listener attaches
    if (iframe.contentDocument?.readyState === 'complete') {
      onLoad()
    }

    return () => {
      iframe.removeEventListener('load', onLoad)
      if (doc) doc.removeEventListener('click', onClick, true)
    }
  }, [html])

  return (
    <iframe
      ref={iframeRef}
      title="Recovery email preview"
      className="h-[480px] w-full bg-white"
      srcDoc={html}
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      referrerPolicy="no-referrer"
    />
  )
}
