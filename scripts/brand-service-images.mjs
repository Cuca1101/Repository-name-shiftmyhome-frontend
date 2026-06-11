/**
 * Brand service card photos from real stock + ShiftMyHome watermark.
 * house-removals.jpg is preserved as-is (custom boxes photo — do not overwrite).
 * Run: npm run images:brand-services
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const servicesDir = path.join(__dirname, '..', 'public', 'assets', 'services')
const sourcesDir = path.join(servicesDir, '_sources')
const logoMark = path.join(__dirname, '..', 'public', 'logo-mark.png')

/** @param {number} width @param {number} height @param {string} subtitle */
function watermarkSvg(width, height, subtitle) {
  const barH = Math.max(64, Math.round(height * 0.12))
  const titleSize = Math.max(24, Math.round(barH * 0.4))
  const subSize = Math.max(13, Math.round(barH * 0.24))
  const yBase = height - barH
  const pad = Math.round(width * 0.03)
  const safeSub = subtitle.replace(/&/g, '&amp;').replace(/</g, '&lt;')

  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f172a" stop-opacity="0"/>
      <stop offset="40%" stop-color="#0f172a" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0.92"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${yBase}" width="${width}" height="${barH}" fill="url(#bar)"/>
  <text x="${pad}" y="${yBase + barH * 0.5}" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${titleSize}" fill="#ffffff">ShiftMyHome</text>
  <text x="${pad}" y="${yBase + barH * 0.82}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${subSize}" fill="#bfdbfe" letter-spacing="0.06em">${safeSub}</text>
</svg>`)
}

/** White panel on van side for logo + text. */
function vanDecalSvg(w, h) {
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${w}" height="${h}" rx="6" fill="#ffffff" fill-opacity="0.92"/>
</svg>`)
}

/**
 * @param {string} input
 * @param {string} output
 * @param {string} subtitle
 * @param {{ vanLogo?: boolean }} [opts]
 */
async function brandServiceImage(input, output, subtitle, opts = {}) {
  if (!fs.existsSync(input)) throw new Error(`Missing source: ${input}`)

  const resizeOpts = { fit: 'cover' }
  if (opts.cropPosition) resizeOpts.position = opts.cropPosition
  let base = await sharp(input).resize(1600, 1067, resizeOpts).jpeg({ quality: 90 }).toBuffer()
  const { width, height } = await sharp(base).metadata()
  const w = width ?? 1600
  const h = height ?? 1067

  const composites = []

  if (opts.vanLogo) {
    const rect = opts.vanLogoRect ?? { left: 0.52, top: 0.34, width: 0.28 }
    const decalW = Math.round(w * rect.width)
    const decalH = Math.round(decalW * 0.34)
    const markSize = Math.round(decalH * 0.62)
    const markLeft = Math.round(w * rect.left)
    const markTop = Math.round(h * rect.top)

    if (fs.existsSync(logoMark)) {
      const mark = await sharp(logoMark)
        .resize(markSize, markSize, { fit: 'inside' })
        .tint({ r: 15, g: 61, b: 122 })
        .png()
        .toBuffer()
      const markMeta = await sharp(mark).metadata()
      const markW = markMeta.width ?? markSize
      composites.push({
        input: vanDecalSvg(decalW, decalH),
        top: markTop,
        left: markLeft,
      })
      composites.push({
        input: mark,
        top: markTop + Math.round((decalH - (markMeta.height ?? markSize)) / 2),
        left: markLeft + Math.round(decalW * 0.05),
      })
      const textSvg = Buffer.from(`<svg width="${decalW - markW - Math.round(decalW * 0.08)}" height="${decalH}" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="${Math.round(decalH * 0.44)}" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${Math.max(16, Math.round(decalH * 0.19))}" fill="#0f3d7a">ShiftMyHome</text>
  <text x="0" y="${Math.round(decalH * 0.7)}" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="${Math.max(8, Math.round(decalH * 0.09))}" fill="#2563eb" letter-spacing="0.04em">YOUR MOVE MADE SIMPLE</text>
</svg>`)
      composites.push({
        input: textSvg,
        top: markTop,
        left: markLeft + markW + Math.round(decalW * 0.06),
      })
    }
  }

  composites.push({ input: watermarkSvg(w, h, subtitle), top: 0, left: 0 })

  if (fs.existsSync(logoMark)) {
    const markSize = Math.max(52, Math.round(Math.min(w, h) * 0.1))
    const mark = await sharp(logoMark).resize(markSize, markSize, { fit: 'inside' }).png().toBuffer()
    const markMeta = await sharp(mark).metadata()
    composites.push({
      input: mark,
      top: h - Math.max(64, Math.round(h * 0.12)) + Math.round(markSize * 0.12),
      left: w - (markMeta.width ?? markSize) - Math.round(w * 0.03),
    })
  }

  await sharp(base).composite(composites).jpeg({ quality: 88, mozjpeg: true }).toFile(`${output}.tmp`)
  fs.renameSync(`${output}.tmp`, output)
  console.log(`✓ ${path.basename(output)} — ${subtitle}`)
}

/** Real Pexels photos (RDNE / delivery series). */
const SERVICES = [
  {
    source: 'man-with-van-source.jpg',
    output: 'man-with-van.jpg',
    subtitle: 'MAN & VAN · SCOTLAND',
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/2019_Mercedes-Benz_Sprinter_Luton_Van_2.1.jpg',
    userAgent: true,
    vanLogo: true,
    vanLogoRect: { left: 0.32, top: 0.4, width: 0.34 },
    cropPosition: 'left',
  },
  {
    source: 'furniture-delivery-source.jpg',
    output: 'furniture-delivery.jpg',
    subtitle: 'FURNITURE DELIVERY · SCOTLAND',
    url: 'https://images.pexels.com/photos/7464242/pexels-photo-7464242.jpeg?auto=compress&cs=tinysrgb&w=1800&h=1200&fit=crop',
  },
  {
    source: 'office-moves-source.jpg',
    output: 'office-moves.jpg',
    subtitle: 'OFFICE REMOVALS · SCOTLAND',
    url: 'https://images.pexels.com/photos/7464266/pexels-photo-7464266.jpeg?auto=compress&cs=tinysrgb&w=1800&h=1200&fit=crop',
  },
  {
    source: 'clearance-source.jpg',
    output: 'clearance.jpg',
    subtitle: 'HOUSE CLEARANCE · SCOTLAND',
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/2019_Mercedes-Benz_Sprinter_Luton_Van_2.1.jpg',
    userAgent: true,
    vanLogo: true,
    vanLogoRect: { left: 0.1, top: 0.38, width: 0.34 },
  },
]

async function download(url, dest, userAgent = false) {
  const headers = userAgent
    ? { 'User-Agent': 'ShiftMyHomeImageScript/1.0 (https://shiftmyhome.co.uk)' }
    : {}
  const res = await fetch(url, { redirect: 'follow', headers })
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(dest, buf)
  console.log(`↓ ${path.basename(dest)} (${Math.round(buf.length / 1024)} KB)`)
}

async function main() {
  fs.mkdirSync(sourcesDir, { recursive: true })
  console.log('Keeping house-removals.jpg unchanged (custom boxes photo).')

  for (const svc of SERVICES) {
    const input = path.join(sourcesDir, svc.source)
    const output = path.join(servicesDir, svc.output)
    await download(svc.url, input, svc.userAgent)
    await brandServiceImage(input, output, svc.subtitle, {
      vanLogo: svc.vanLogo,
      vanLogoRect: svc.vanLogoRect,
      cropPosition: svc.cropPosition,
    })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
