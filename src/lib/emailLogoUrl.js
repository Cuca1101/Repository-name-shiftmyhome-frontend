import { SITE_BRAND_LOGO_URL } from './siteBrandMeta'

export const PUBLIC_EMAIL_LOGO_URL = SITE_BRAND_LOGO_URL

/**
 * Point a quote-email logo at the public PNG. Relative and non-image sources
 * cannot load inside a preview frame or in a received message.
 * Other images are left unchanged.
 * @param {string} html
 */
export function repairEmailPreviewLogo(html) {
  const source = String(html || '')
  if (!source) return source
  return source.replace(/<img\b([^>]*?)>/gi, (tag) => {
    const srcMatch = tag.match(/\bsrc\s*=\s*(["'])([\s\S]*?)\1/i)
    const altMatch = tag.match(/\balt\s*=\s*(["'])([\s\S]*?)\1/i)
    const src = String(srcMatch?.[2] || '').trim()
    const alt = String(altMatch?.[2] || '')
    const looksLikeLogo = /logo/i.test(src) || /shiftmyhome/i.test(alt)
    if (!looksLikeLogo || src === PUBLIC_EMAIL_LOGO_URL) return tag
    if (srcMatch) return tag.replace(srcMatch[0], `src="${PUBLIC_EMAIL_LOGO_URL}"`)
    return tag.replace(/<img\b/i, `<img src="${PUBLIC_EMAIL_LOGO_URL}"`)
  })
}
