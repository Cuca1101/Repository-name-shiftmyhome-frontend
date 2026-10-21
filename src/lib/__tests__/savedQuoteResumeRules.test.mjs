import assert from 'node:assert/strict'
import test from 'node:test'
import {
  combineSavedQuoteResumeState,
  localSavedQuoteResumeState,
  QUOTE_DRAFT_MAX_AGE_MS,
} from '../savedQuoteResumeRules.js'

const now = Date.parse('2026-10-21T12:00:00Z')

test('a recent unfinished draft still needs a backend check', () => {
  assert.equal(
    localSavedQuoteResumeState(
      { quoteRef: 'SMH-2026-100', savedAt: now - 60_000, wizard: { moveDate: '2026-10-25' } },
      now,
    ),
    'pending',
  )
})

test('a draft older than 14 days is expired', () => {
  assert.equal(
    localSavedQuoteResumeState(
      {
        quoteRef: 'SMH-2026-100',
        savedAt: now - QUOTE_DRAFT_MAX_AGE_MS - 1000,
        wizard: { moveDate: '2026-11-01' },
      },
      now,
    ),
    'expired',
  )
})

test('a past move date can still resume the same quote', () => {
  assert.equal(
    localSavedQuoteResumeState(
      { quoteRef: 'SMH-2026-100', savedAt: now, wizard: { moveDate: '2026-10-01' } },
      now,
    ),
    'pending',
  )
})

test('a confirmed or closed backend status removes resume', () => {
  assert.equal(combineSavedQuoteResumeState('pending', 'booked'), 'booked')
  assert.equal(combineSavedQuoteResumeState('pending', 'expired'), 'expired')
  assert.equal(combineSavedQuoteResumeState('pending', 'closed'), 'closed')
})

test('an unknown backend row can still resume a valid local draft', () => {
  assert.equal(combineSavedQuoteResumeState('pending', 'unknown'), 'resumable')
  assert.equal(combineSavedQuoteResumeState('pending', 'resumable'), 'resumable')
})

test('local expiry wins over a resumable backend row', () => {
  assert.equal(combineSavedQuoteResumeState('expired', 'resumable'), 'expired')
  assert.equal(combineSavedQuoteResumeState('none', 'resumable'), 'none')
})
