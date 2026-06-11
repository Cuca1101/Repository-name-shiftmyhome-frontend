/**
 * Build branded service card photos from real removals images (no random stock).
 * Sources: custom house-removals.jpg + man-with-van.jpg (moving van on street).
 * Run: npm run images:brand-services
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const servicesDir = path.join(__dirname, '..', 'public', 'assets', 'services')
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

/**
 * @param {string} input
 * @param {string} output
 * @param {string} subtitle
 * @param {{ left?: number, top?: number, width?: number, height?: number }} [crop]
 */
async function brandServiceImage(input, output, subtitle, crop) {
  if (!fs.existsSync(input)) throw new Error(`Missing source: ${input}`)

  let pipeline = sharp(input)
  const meta = await sharp(input).metadata()
  const srcW = meta.width ?? 1200
  const srcH = meta.height ?? 800

  if (crop) {
    const left = Math.round((crop.left ?? 0) * srcW)
    const top = Math.round((crop.top ?? 0) * srcH)
    const width = Math.round((crop.width ?? 1) * srcW)
    const height = Math.round((crop.height ?? 1) * srcH)
    pipeline = pipeline.extract({ left, top, width, height }).resize(1600, 1067, { fit: 'cover' })
  } else {
    pipeline = pipeline.resize(1600, 1067, { fit: 'cover' })
  }

  const base = await pipeline.jpeg({ quality: 90 }).toBuffer()
  const { width, height } = await sharp(base).metadata()

  const composites = [{ input: watermarkSvg(width, height, subtitle), top: 0, left: 0 }]

  if (fs.existsSync(logoMark)) {
    const markSize = Math.max(52, Math.round(Math.min(width, height) * 0.1))
    const mark = await sharp(logoMark).resize(markSize, markSize, { fit: 'inside' }).png().toBuffer()
    const markMeta = await sharp(mark).metadata()
    composites.push({
      input: mark,
      top: height - Math.max(64, Math.round(height * 0.12)) + Math.round(markSize * 0.12),
      left: width - (markMeta.width ?? markSize) - Math.round(width * 0.03),
    })
  }

  await sharp(base).composite(composites).jpeg({ quality: 88, mozjpeg: true }).toFile(`${output}.tmp`)
  fs.renameSync(`${output}.tmp`, output)
  console.log(`✓ ${path.basename(output)} — ${subtitle}`)
}

async function main() {
  const house = path.join(servicesDir, 'house-removals.jpg')
  const van = path.join(servicesDir, 'man-with-van.jpg')

  // Custom hero — already has box branding; only refresh bottom bar if needed
  if (fs.existsSync(house)) {
    await brandServiceImage(house, house, 'HOUSE REMOVALS · SCOTLAND')
  }

  if (fs.existsSync(van)) {
    await brandServiceImage(van, van, 'MAN & VAN · SCOTLAND')
    await brandServiceImage(van, path.join(servicesDir, 'office-moves.jpg'), 'OFFICE REMOVALS · SCOTLAND', {
      left: 0,
      top: 0.05,
      width: 1,
      height: 0.85,
    })
    await brandServiceImage(van, path.join(servicesDir, 'clearance.jpg'), 'HOUSE CLEARANCE · SCOTLAND', {
      left: 0.15,
      top: 0,
      width: 0.85,
      height: 1,
    })
  }

  if (fs.existsSync(house)) {
    await brandServiceImage(
      house,
      path.join(servicesDir, 'furniture-delivery.jpg'),
      'FURNITURE DELIVERY · SCOTLAND',
      { left: 0.35, top: 0, width: 0.65, height: 1 },
    )
    await brandServiceImage(
      house,
      path.join(servicesDir, 'student-moves.jpg'),
      'STUDENT MOVES · SCOTLAND',
      { left: 0, top: 0.1, width: 0.75, height: 0.9 },
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
