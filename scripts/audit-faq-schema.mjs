/**
 * Deep FAQ schema audit: structure, duplicates, visible content match.
 */
import { chromium } from 'playwright'
import { getSeoPageByPath } from '../src/data/seoPages.js'
import { buildFaqPageJsonLd, normalizeSeoFaqs, validateFaqPageJsonLd } from '../src/lib/seoStructuredData.js'

const url = process.argv[2] || 'https://www.shiftmyhome.co.uk/furniture-delivery-glasgow'
const path = new URL(url).pathname

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(url, { waitUntil: 'networkidle' })

const audit = await page.evaluate(() => {
  const faqScripts = []
  document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
    try {
      const data = JSON.parse(el.textContent || '')
      if (data['@type'] === 'FAQPage') {
        faqScripts.push({
          region: document.head.contains(el) ? 'head' : 'body',
          id: el.id || '',
          parent: el.parentElement?.tagName?.toLowerCase() || '',
          mainEntityCount: Array.isArray(data.mainEntity) ? data.mainEntity.length : 0,
          data,
        })
      }
    } catch {
      /* ignore */
    }
  })

  const visible = []
  document.querySelectorAll('.seo-faq-item').forEach((item) => {
    const q = item.querySelector('summary')?.textContent?.trim() || ''
    const a = item.querySelector('.seo-faq-answer')?.textContent?.trim() || ''
    visible.push({ q, a })
  })

  return { faqScripts, visible }
})

await browser.close()

const expected = buildFaqPageJsonLd(normalizeSeoFaqs(getSeoPageByPath(path)?.faqs), path)

console.log('URL:', url)
console.log('FAQPage script count:', audit.faqScripts.length)
if (audit.faqScripts.length > 1) {
  console.error('INVALID: Google requires exactly one FAQPage per page (duplicate blocks cause invalid items).')
}
audit.faqScripts.forEach((s, i) => {
  console.log(`\n--- FAQ block ${i + 1} (${s.region}, id=${s.id || 'none'}, parent=${s.parent}) ---`)
  const issues = []
  if (!Array.isArray(s.data.mainEntity) || s.data.mainEntity.length === 0) {
    issues.push('mainEntity missing or empty')
  }
  s.data.mainEntity?.forEach((q, idx) => {
    if (q['@type'] !== 'Question') issues.push(`item ${idx}: @type not Question`)
    if (!q.name?.trim()) issues.push(`item ${idx}: missing name`)
    if (!q.acceptedAnswer) issues.push(`item ${idx}: missing acceptedAnswer`)
    else {
      if (q.acceptedAnswer['@type'] !== 'Answer') issues.push(`item ${idx}: acceptedAnswer @type not Answer`)
      if (!q.acceptedAnswer.text?.trim()) issues.push(`item ${idx}: missing acceptedAnswer.text`)
    }
  })
  console.log('Structure issues:', issues.length ? issues : 'none')
  console.log('Questions:', s.data.mainEntity?.map((q) => q.name))
})

console.log('\n--- Visible FAQ on page ---')
audit.visible.forEach((v, i) => console.log(`${i + 1}. Q: ${v.q}`))

console.log('\n--- Expected from source data ---')
expected?.mainEntity?.forEach((q, i) => console.log(`${i + 1}. Q: ${q.name}`))
const validationErrors = validateFaqPageJsonLd(expected)
console.log('\n--- Schema.org / Google required fields ---')
console.log(validationErrors.length ? validationErrors : 'All required fields present')

if (audit.faqScripts[0] && audit.visible.length) {
  const schemaQs = audit.faqScripts[0].data.mainEntity.map((q) => q.name.trim())
  const visibleQs = audit.visible.map((v) => v.q.trim())
  const mismatch = []
  for (let i = 0; i < Math.max(schemaQs.length, visibleQs.length); i++) {
    const sq = schemaQs[i]
    const vq = visibleQs[i]
    const sa = audit.faqScripts[0].data.mainEntity[i]?.acceptedAnswer?.text?.trim()
    const va = audit.visible[i]?.a?.trim()
    if (sq !== vq) mismatch.push(`Q${i + 1} name: schema="${sq}" visible="${vq}"`)
    if (sa !== va) mismatch.push(`Q${i + 1} answer: schema="${sa?.slice(0, 40)}..." visible="${va?.slice(0, 40)}..."`)
  }
  console.log('\n--- Schema vs visible match (first FAQ block) ---')
  console.log(mismatch.length ? mismatch : 'All items match')
}
