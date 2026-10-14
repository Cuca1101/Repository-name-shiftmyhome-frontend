import { chromium } from 'playwright'

const origin = process.argv[2] || 'http://127.0.0.1:5175'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const api = []
page.on('response', (response) => {
  if (response.url().includes('places.googleapis.com')) api.push(response.status())
})

await page.addInitScript(() => {
  localStorage.setItem(
    'smh_cookie_consent',
    JSON.stringify({ essential: true, analytics: true, marketing: false, updatedAt: new Date().toISOString() }),
  )
  localStorage.removeItem('smh-reviews-badge-dismissed')
})
await page.goto(origin, { waitUntil: 'domcontentloaded' })
const badge = page.locator('button[aria-label*="Google reviews"], button[aria-label*="Open Google reviews"]').first()
await badge.waitFor({ timeout: 15000 })
await page.waitForTimeout(4000)
const text = (await badge.innerText()).replace(/\s+/g, ' ').trim()
const label = await badge.getAttribute('aria-label')
const fake = /127|4\.9|Michael R/.test(`${text} ${label}`)

await badge.click()
const drawer = page.getByRole('dialog', { name: 'What our customers say' })
await drawer.waitFor({ timeout: 10000 })
const dialog = (await drawer.innerText()).replace(/\s+/g, ' ')
const liveAuthor = /Tony|Andrew Lucas|Kelvin Alex|Alice|alunita covaci/.test(dialog)
const fakeAuthor = /Michael R\.|Emma L\./.test(dialog)

console.log(JSON.stringify({ origin, api, text, label, fake, liveAuthor, fakeAuthor, dialog: dialog.slice(0, 400) }, null, 2))
await browser.close()
process.exit(fake || fakeAuthor || !liveAuthor ? 1 : 0)
