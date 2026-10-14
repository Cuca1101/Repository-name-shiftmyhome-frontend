import { useEffect, useRef } from 'react'
import { PUBLIC_EMAIL_LOGO_URL } from '../../lib/emailLogoUrl'

/**
 * Admin-only email preview. Links must never navigate the preview iframe
 * (Stripe Checkout / pay page refuse nested frames and appear stuck loading).
 *
 * Open links via a parent-document <a target="_blank"> click — not window.open.
 * window.open from a parent handler after an iframe click often loses user
 * activation and is blocked silently (links appear to do nothing).
 *
 * @param {{ html: string, className?: string, repairLogo?: boolean }} props
 */
export default function RecoveryEmailPreviewFrame({
  html,
  className = 'h-[480px] w-full bg-white',
  repairLogo = false,
}) {
  const iframeRef = useRef(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !html) return undefined

    /** @type {Document | null} */
    let doc = null

    const openOutsidePreview = (href) => {
      const url = String(href || '').trim()
      if (!url || url === '#' || url.toLowerCase().startsWith('javascript:')) return
      const link = document.createElement('a')
      link.href = url
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      document.body.appendChild(link)
      link.click()
      link.remove()
    }

    const prepareAnchors = (root) => {
      root.querySelectorAll('a[href]').forEach((anchor) => {
        const href = String(anchor.getAttribute('href') || '').trim()
        if (!href || href.startsWith('#') || href.toLowerCase().startsWith('javascript:')) return
        anchor.setAttribute('target', '_blank')
        const rel = String(anchor.getAttribute('rel') || '')
        const parts = new Set(rel.split(/\s+/).filter(Boolean))
        parts.add('noopener')
        parts.add('noreferrer')
        anchor.setAttribute('rel', [...parts].join(' '))
      })
    }

    const onClick = (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.toLowerCase().startsWith('javascript:')) return
      // Keep navigation out of the sandboxed iframe; open in a new tab from the parent.
      event.preventDefault()
      event.stopPropagation()
      openOutsidePreview(anchor.href || href)
    }

    const repairBrokenLogo = (img) => {
      if (!(img instanceof HTMLImageElement) || img.dataset.logoFixed === '1') return
      const src = img.getAttribute('src') || ''
      const alt = img.getAttribute('alt') || ''
      if (!/logo|shiftmyhome/i.test(`${src} ${alt}`)) return
      if (src === PUBLIC_EMAIL_LOGO_URL && img.naturalWidth > 0) return
      img.dataset.logoFixed = '1'
      img.src = PUBLIC_EMAIL_LOGO_URL
    }

    const onLoad = () => {
      doc = iframe.contentDocument
      if (!doc) return
      prepareAnchors(doc)
      if (repairLogo) {
        doc.querySelectorAll('img').forEach((img) => {
          if (!(img instanceof HTMLImageElement)) return
          if (img.complete) {
            if (img.naturalWidth === 0) repairBrokenLogo(img)
            return
          }
          img.addEventListener('error', () => repairBrokenLogo(img), { once: true })
          img.addEventListener('load', () => {
            if (img.naturalWidth === 0) repairBrokenLogo(img)
          }, { once: true })
        })
      }
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
  }, [html, repairLogo])

  return (
    <iframe
      ref={iframeRef}
      title="Email preview"
      className={className}
      srcDoc={html}
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      referrerPolicy="no-referrer"
    />
  )
}
