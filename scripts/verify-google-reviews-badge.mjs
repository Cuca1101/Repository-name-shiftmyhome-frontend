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
const badge = page.getByRole('button', { name: /Open reviews|Google reviews/i }).first()
await badge.waitFor({ timeout: 15000 })
await badge.getByText('0 Trustpilot reviews').waitFor({ timeout: 15000 })
const text = (await badge.innerText()).replace(/\s+/g, ' ').trim()
const label = await badge.getAttribute('aria-label')
const fake = /127|4\.9|Michael R|Excellent 4\.8|89 reviews/.test(`${text} ${label}`)
const trustpilotLive = /0 Trustpilot reviews/.test(text)
const fakeHero = await page.locator('text=/Excellent 4\\.8/ >> visible=true').count()
const liveHero = await page.locator('text=/Trustpilot · no reviews yet/ >> visible=true').count()

await badge.click()
const drawer = page.getByRole('dialog', { name: 'What our customers say' })
await drawer.waitFor({ timeout: 10000 })
const googleLive = api.includes(200)
if (googleLive) await drawer.getByText(/Google average/).waitFor({ timeout: 10000 })
await drawer.getByRole('tab', { name: /Trustpilot/ }).click()
await drawer.getByText('No Trustpilot reviews yet.').waitFor({ timeout: 10000 })
await drawer.getByText('Trustpilot · 0 reviews').waitFor({ timeout: 10000 })
const dialog = (await drawer.innerText()).replace(/\s+/g, ' ')
const liveAuthor = /Tony|Andrew Lucas|Kelvin Alex|Alice|alunita covaci/.test(dialog)
const fakeAuthor = /Michael R\.|Emma L\./.test(dialog)

console.log(JSON.stringify({
  origin,
  api,
  text,
  label,
  fake,
  trustpilotLive,
  fakeHero,
  liveHero,
  googleLive,
  liveAuthor,
  fakeAuthor,
  dialog: dialog.slice(0, 500),
}, null, 2))
await browser.close()
const googleFailed = googleLive && (!liveAuthor || fakeAuthor)
process.exit(fake || fakeHero || !liveHero || !trustpilotLive || googleFailed ? 1 : 0)
