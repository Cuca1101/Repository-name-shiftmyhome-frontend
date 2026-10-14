/**
 * Same vehicle photo as the customer tracking map.
 * Keep the Sprinter cutout upright — do not rotate or mirror it from heading.
 */
export const SPRINTER_IMG = '/tracking/mercedes-sprinter-lwb.png'

let stylesInjected = false

function ensureSprinterStyles() {
  if (stylesInjected || typeof document === 'undefined') return
  stylesInjected = true
  const style = document.createElement('style')
  style.setAttribute('data-sprinter-van', '1')
  style.textContent = `
    @keyframes smh-ops-van-bob {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }
    .smh-ops-van { display:flex; flex-direction:column; align-items:center; gap:2px; pointer-events:auto; cursor:pointer; }
    .smh-ops-van-name, .smh-ops-van-ref {
      max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      font:700 10px Inter,Segoe UI,system-ui,sans-serif; padding:1px 6px; border-radius:8px;
      background:#fff; color:#0f172a; border:1px solid rgba(15,23,42,0.1);
      box-shadow:0 1px 4px rgba(15,23,42,0.12);
    }
    .smh-ops-van-ref { font:600 9px ui-monospace,SFMono-Regular,Menlo,monospace; color:#0369a1; background:#f0f9ff; border-color:#bae6fd; }
    .smh-ops-van-icon { line-height:0; filter:drop-shadow(0 3px 6px rgba(15,23,42,0.3)); }
    .smh-ops-van-icon.is-live { animation: smh-ops-van-bob 1.7s ease-in-out infinite; }
    .smh-ops-van-img { display:block; width:44px; height:44px; object-fit:contain; background:transparent; }
    .smh-ops-van-img.is-stale { filter:grayscale(0.25) brightness(0.96); opacity:0.92; }
    .smh-ops-van-stem { width:2px; height:10px; border-radius:2px; background:#0284c7; margin-top:-2px; }
    .smh-ops-van-stem.is-stale { background:#64748b; }
    .smh-ops-van-dot {
      width:9px; height:9px; margin-top:-2px; border-radius:9999px; background:#0284c7; border:2px solid #fff;
      box-shadow:0 0 0 2px rgba(2,132,199,0.35);
    }
    .smh-ops-van-dot.is-stale { background:#64748b; box-shadow:0 0 0 2px rgba(100,116,139,0.35); }
    .smh-ops-van-badge {
      font:700 8px Inter,Segoe UI,system-ui,sans-serif; padding:1px 6px; border-radius:9999px;
    }
  `
  document.head.appendChild(style)
}

/**
 * Portal-style Sprinter pin: name, job ref, photo, ground point.
 * @param {{
 *   name?: string,
 *   quoteRef?: string,
 *   live?: boolean,
 *   stale?: boolean,
 *   waitingGps?: boolean,
 * }} opts
 */
export function buildSprinterVanElement({
  name = 'Driver',
  quoteRef = '',
  live = false,
  stale = false,
  waitingGps = false,
} = {}) {
  ensureSprinterStyles()
  const fullName = String(name || 'Driver').trim() || 'Driver'
  const ref = String(quoteRef || '').trim()
  const muted = !live || stale || waitingGps

  const wrap = document.createElement('div')
  wrap.className = 'smh-ops-van'
  wrap.setAttribute('aria-label', ref ? `Driver ${fullName}, ${ref}` : `Driver ${fullName}`)

  const lab = document.createElement('div')
  lab.className = 'smh-ops-van-name'
  lab.textContent = (fullName.split(' ')[0] || fullName).slice(0, 16)
  wrap.appendChild(lab)

  if (ref) {
    const job = document.createElement('div')
    job.className = 'smh-ops-van-ref'
    job.textContent = ref
    wrap.appendChild(job)
  }

  const icon = document.createElement('div')
  icon.className = live && !muted ? 'smh-ops-van-icon is-live' : 'smh-ops-van-icon'
  const img = document.createElement('img')
  img.src = SPRINTER_IMG
  img.alt = ''
  img.draggable = false
  img.className = muted ? 'smh-ops-van-img is-stale' : 'smh-ops-van-img'
  icon.appendChild(img)
  wrap.appendChild(icon)

  const stem = document.createElement('div')
  stem.className = muted ? 'smh-ops-van-stem is-stale' : 'smh-ops-van-stem'
  wrap.appendChild(stem)
  const dot = document.createElement('div')
  dot.className = muted ? 'smh-ops-van-dot is-stale' : 'smh-ops-van-dot'
  wrap.appendChild(dot)

  if (waitingGps) {
    const badge = document.createElement('div')
    badge.className = 'smh-ops-van-badge'
    badge.textContent = 'On job'
    badge.style.cssText = 'background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;'
    wrap.appendChild(badge)
  } else if (stale || !live) {
    const badge = document.createElement('div')
    badge.className = 'smh-ops-van-badge'
    badge.textContent = 'Last known'
    badge.style.cssText = 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d;'
    wrap.appendChild(badge)
  }

  return wrap
}
