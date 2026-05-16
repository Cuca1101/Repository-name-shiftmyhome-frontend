/**
 * Animated enterprise driver marker (DOM).
 * @param {{
 *   driverId: string,
 *   name: string,
 *   initials: string,
 *   bearing: number,
 *   moving: boolean,
 *   status: string,
 *   etaLabel?: string,
 *   online?: boolean,
 *   isFocused?: boolean,
 * }} opts
 */
export function buildDriverMarkerElement(opts) {
  const wrap = document.createElement('button')
  wrap.type = 'button'
  wrap.dataset.driverId = opts.driverId
  wrap.setAttribute('aria-label', `Driver ${opts.name}`)
  wrap.style.cssText =
    'display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:auto;cursor:pointer;margin:0;padding:0;border:none;background:transparent;'
  const idle = opts.status === 'idle' || opts.status === 'offline'
  wrap.style.opacity = idle ? '0.55' : '1'

  const shell = document.createElement('div')
  shell.style.cssText =
    'position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;'

  if (opts.moving) {
    const pulse = document.createElement('div')
    pulse.style.cssText =
      'position:absolute;inset:-6px;border-radius:9999px;background:rgba(37,99,235,0.35);animation:ops-driver-pulse 1.6s ease-out infinite;'
    shell.appendChild(pulse)
  }

  const arrow = document.createElement('div')
  arrow.style.cssText = `position:absolute;top:-2px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:8px solid #1d4ed8;transform:rotate(${opts.bearing || 0}deg);transform-origin:center 20px;`
  shell.appendChild(arrow)

  const pin = document.createElement('div')
  pin.textContent = opts.initials || 'DR'
  pin.style.cssText = `width:36px;height:36px;border-radius:9999px;border:3px solid ${opts.isFocused ? '#fbbf24' : '#fff'};box-shadow:0 3px 12px rgba(15,23,42,0.45);background:${opts.online === false ? '#64748b' : '#2563eb'};color:#fff;font:bold 11px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;transform:rotate(${opts.bearing || 0}deg);transition:transform 0.35s ease;`
  if (opts.isFocused) pin.style.outline = '3px solid rgba(251,191,36,0.5)'
  shell.appendChild(pin)
  wrap.appendChild(shell)

  const lab = document.createElement('div')
  lab.textContent = (opts.name.split(' ')[0] || opts.name).slice(0, 14)
  lab.style.cssText =
    'max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:bold 9px system-ui,sans-serif;padding:2px 5px;border-radius:6px;background:rgba(255,255,255,0.96);border:1px solid rgba(15,23,42,0.1);color:#0f172a;box-shadow:0 1px 4px rgba(0,0,0,0.12);'
  wrap.appendChild(lab)

  if (opts.etaLabel && opts.etaLabel !== '—') {
    const eta = document.createElement('div')
    eta.textContent = opts.etaLabel
    eta.style.cssText =
      'font:bold 9px system-ui,sans-serif;padding:1px 6px;border-radius:9999px;background:#0f172a;color:#f8fafc;'
    wrap.appendChild(eta)
  }

  if (!document.getElementById('ops-driver-pulse-style')) {
    const style = document.createElement('style')
    style.id = 'ops-driver-pulse-style'
    style.textContent =
      '@keyframes ops-driver-pulse{0%{transform:scale(0.85);opacity:.7}70%{transform:scale(1.15);opacity:0}100%{opacity:0}}'
    document.head.appendChild(style)
  }

  return wrap
}
