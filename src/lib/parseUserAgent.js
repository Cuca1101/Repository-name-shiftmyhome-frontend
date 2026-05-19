/**
 * Lightweight client-side UA parsing (no third-party SDK).
 * @param {string} [ua]
 */
export function parseUserAgentLite(ua) {
  const s = String(ua || (typeof navigator !== 'undefined' ? navigator.userAgent : ''))
  const lower = s.toLowerCase()

  let device_type = 'desktop'
  if (/ipad|tablet|playbook|silk/i.test(s)) device_type = 'tablet'
  else if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(s)) device_type = 'mobile'

  let browser_name = 'Unknown'
  if (lower.includes('edg/')) browser_name = 'Edge'
  else if (lower.includes('chrome/') && !lower.includes('chromium')) browser_name = 'Chrome'
  else if (lower.includes('firefox/')) browser_name = 'Firefox'
  else if (lower.includes('safari/') && !lower.includes('chrome')) browser_name = 'Safari'
  else if (lower.includes('opr/') || lower.includes('opera')) browser_name = 'Opera'

  return { device_type, browser_name, user_agent: s.slice(0, 512) }
}
