/**
 * Cut the Sprinter out of the white studio plate for map marker use.
 * Output: transparent PNG, tightly cropped to the van (+ soft contact shadow).
 */
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(__dirname, '../public/tracking/mercedes-sprinter-lwb.png')
const assetSrc =
  'C:/Users/andre/.cursor/projects/c-ShiftMyHomeLtd/assets/c__Users_andre_AppData_Roaming_Cursor_User_workspaceStorage_e6904dca5b108623130fce4b7b81d7b6_images_image-ca00e81b-5159-40d1-a288-198efae41400.png'
const src = fs.existsSync(assetSrc) ? assetSrc : out

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width, height, channels } = info

function idx(x, y) {
  return (y * width + x) * channels
}

// Pass 1: key out white / light floor
for (let i = 0; i < data.length; i += channels) {
  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max - min
  const avg = (r + g + b) / 3

  if (min >= 240 && chroma <= 22) {
    data[i + 3] = 0
    continue
  }
  if (min >= 210 && chroma <= 18) {
    const t = (min - 210) / 30
    data[i + 3] = Math.max(0, Math.min(255, Math.round(255 * (1 - t) ** 2)))
    continue
  }
  // Kill long soft cast shadow (mid grey floor)
  if (chroma <= 16 && avg >= 170 && avg <= 238) {
    data[i + 3] = avg >= 190 ? 0 : Math.round(40 * ((190 - avg) / 20))
  }
}

// Pass 2: remove white fringe — transparent if mostly surrounded by transparent
const alpha = new Uint8Array(width * height)
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    alpha[y * width + x] = data[idx(x, y) + 3]
  }
}
for (let y = 1; y < height - 1; y += 1) {
  for (let x = 1; x < width - 1; x += 1) {
    const i = idx(x, y)
    const a = data[i + 3]
    if (a < 8 || a > 230) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const min = Math.min(r, g, b)
    if (min < 200) continue
    let clearN = 0
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue
        if (alpha[(y + dy) * width + (x + dx)] < 20) clearN += 1
      }
    }
    if (clearN >= 3) data[i + 3] = 0
  }
}

let minX = width
let minY = height
let maxX = 0
let maxY = 0
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    if (data[idx(x, y) + 3] < 24) continue
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
}
if (maxX < minX || maxY < minY) throw new Error('No opaque pixels found')

const pad = 1
minX = Math.max(0, minX - pad)
minY = Math.max(0, minY - pad)
maxX = Math.min(width - 1, maxX + pad)
maxY = Math.min(height - 1, maxY + pad)
const cropW = maxX - minX + 1
const cropH = maxY - minY + 1
const tmp = `${out}.tmp.png`

await sharp(data, { raw: { width, height, channels } })
  .extract({ left: minX, top: minY, width: cropW, height: cropH })
  .png({ compressionLevel: 9 })
  .toFile(tmp)

fs.renameSync(tmp, out)
const meta = await sharp(out).metadata()
console.log('cropped sprinter', {
  source: path.basename(src),
  from: `${width}x${height}`,
  to: `${meta.width}x${meta.height}`,
  hasAlpha: meta.hasAlpha,
  bytes: fs.statSync(out).size,
})
