/**
 * Hard cutout: transparent background, no white halo — only the Sprinter.
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

for (let i = 0; i < data.length; i += channels) {
  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max - min
  const avg = (r + g + b) / 3

  // Studio white / off-white
  if (min >= 230 && chroma <= 28) {
    data[i + 3] = 0
    continue
  }
  if (min >= 200 && chroma <= 22) {
    const t = (min - 200) / 30
    data[i + 3] = Math.max(0, Math.min(255, Math.round(255 * (1 - t) ** 2.2)))
    continue
  }
  // Soft floor shadow (kill long cast; keep tiny contact)
  if (chroma <= 18 && avg >= 155 && avg <= 240) {
    data[i + 3] = avg >= 175 ? 0 : Math.round(28 * ((175 - avg) / 20))
  }
}

// Kill white fringe beside transparent neighbours
const alpha = new Uint8Array(width * height)
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    alpha[y * width + x] = data[idx(x, y) + 3]
  }
}
for (let pass = 0; pass < 2; pass += 1) {
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = idx(x, y)
      const a = data[i + 3]
      if (a < 10 || a > 240) continue
      const min = Math.min(data[i], data[i + 1], data[i + 2])
      if (min < 185) continue
      let clearN = 0
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue
          if (alpha[(y + dy) * width + (x + dx)] < 25) clearN += 1
        }
      }
      if (clearN >= 2) {
        data[i + 3] = 0
        alpha[y * width + x] = 0
      }
    }
  }
}

let minX = width
let minY = height
let maxX = 0
let maxY = 0
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    if (data[idx(x, y) + 3] < 30) continue
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
  to: `${meta.width}x${meta.height}`,
  hasAlpha: meta.hasAlpha,
  bytes: fs.statSync(out).size,
})
