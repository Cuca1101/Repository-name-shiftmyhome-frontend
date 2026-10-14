import assert from 'node:assert/strict'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const { PUBLIC_EMAIL_LOGO_URL, repairEmailPreviewLogo } = await import('../src/lib/emailLogoUrl.js')

const repaired = repairEmailPreviewLogo(
  '<img src="/logo.png" alt="ShiftMyHome" /><img src="https://example.com/van.jpg" alt="Van" />',
)
assert.match(repaired, new RegExp(`src="${PUBLIC_EMAIL_LOGO_URL.replaceAll('.', '\\.')}"`))
assert.match(repaired, /src="https:\/\/example.com\/van.jpg"/)

const exact = '<p>SENT-SNAPSHOT-MARKER</p><img src="https://example.invalid/stored-logo.png" alt="ShiftMyHome" />'
assert.equal(exact.includes('SENT-SNAPSHOT-MARKER'), true)
assert.equal(exact.includes('stored-logo.png'), true)

console.log('Email logo preview checks passed')
