/**
 * Generate true transparent PNG logos (no background, no glow).
 * Outputs: public/logo-transparent.png, public/logo-mark.png
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const publicDir = path.join(root, 'public')

const ICON_SOURCE = path.join(__dirname, 'logo-icon-source.png')
const TEXT_SVG = path.join(__dirname, 'logo-transparent.svg')
const OUT_FULL = path.join(publicDir, 'logo-transparent.png')
const OUT_MARK = path.join(publicDir, 'logo-mark.png')

const EXPORT_WIDTH = 2144
const EXPORT_HEIGHT = Math.round((420 / 1072) * EXPORT_WIDTH)
const ICON_WIDTH = Math.round((220 / 1072) * EXPORT_WIDTH)
const ICON_TOP = Math.round((6 / 420) * EXPORT_HEIGHT)
const ICON_LEFT = Math.round((426 / 1072) * EXPORT_WIDTH)

/** Strip black/grey/glow — keep only bright logo pixels with clean alpha. */
async function toTrueTransparent(inputPath, targetWidth) {
  const { data, info } = await sharp(inputPath)
    .resize(targetWidth, null, {
      fit: 'inside',
      withoutEnlargement: false,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const px = Buffer.from(data)
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i]
    const g = px[i + 1]
    const b = px[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)

    if (max < 48) {
      px[i + 3] = 0
    } else if (max < 110 && min < 90) {
      const t = (max - 48) / (110 - 48)
      px[i + 3] = Math.round(t * t * 255)
    } else {
      px[i + 3] = 255
      px[i] = 255
      px[i + 1] = 255
      px[i + 2] = 255
    }
  }

  return sharp(px, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()
}

async function main() {
  if (!fs.existsSync(ICON_SOURCE)) {
    throw new Error(`Icon source not found: ${ICON_SOURCE}`)
  }

  const iconPng = await toTrueTransparent(ICON_SOURCE, ICON_WIDTH)
  const iconMeta = await sharp(iconPng).metadata()

  await sharp(iconPng).trim().png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(OUT_MARK)

  const textLayer = await sharp(TEXT_SVG, { density: 144 })
    .resize(EXPORT_WIDTH, EXPORT_HEIGHT, { fit: 'fill' })
    .ensureAlpha()
    .png()
    .toBuffer()

  const iconLeft = ICON_LEFT + Math.round((ICON_WIDTH - iconMeta.width) / 2)

  await sharp(textLayer)
    .composite([{ input: iconPng, top: ICON_TOP, left: iconLeft }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(OUT_FULL)

  const fullMeta = await sharp(OUT_FULL).metadata()
  const markMeta = await sharp(OUT_MARK).metadata()

  console.log(`✓ ${OUT_FULL} (${fullMeta.width}x${fullMeta.height})`)
  console.log(`✓ ${OUT_MARK} (${markMeta.width}x${markMeta.height})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
