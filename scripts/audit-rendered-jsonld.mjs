/**
 * Audit JSON-LD after React hydration (rendered DOM).
 */
import { chromium } from 'playwright'

const url = process.argv[2] || 'https://www.shiftmyhome.co.uk/furniture-delivery-glasgow'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(url, { waitUntil: 'networkidle' })

const blocks = await page.evaluate(() => {
  const headEnd = document.head
  return [...document.querySelectorAll('script[type="application/ld+json"]')].map((el) => {
    let type = '?'
    try {
      type = JSON.parse(el.textContent || '')['@type'] || '?'
    } catch {
      type = 'parse-error'
    }
    const inHead = headEnd.contains(el)
    return {
      region: inHead ? 'head' : 'body',
      type,
      id: el.id || '',
      parent: el.parentElement?.tagName?.toLowerCase() || '',
    }
  })
})

await browser.close()

const counts = {}
for (const b of blocks) {
  const key = `${b.type} (${b.region})`
  counts[key] = (counts[key] || 0) + 1
}

console.log(`URL: ${url}`)
console.log(`Total JSON-LD scripts: ${blocks.length}`)
console.log(counts)
console.log('FAQPage details:', blocks.filter((b) => b.type === 'FAQPage'))
