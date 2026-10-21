import assert from 'node:assert/strict'
import test from 'node:test'
import {
  attemptDecision,
  currentAttemptRows,
  earlierAttemptRows,
  progressClaimAccepted,
} from './driverWorkflowAttempt.js'

test('current attempt ignores an earlier Start and Arrived', () => {
  const rows = [
    { status: 'on_way', workflow_version: 1, created_at: '2026-10-21T09:00:00Z' },
    { status: 'arrived_pickup', workflow_version: 1, created_at: '2026-10-21T09:20:00Z' },
  ]
  assert.equal(currentAttemptRows(rows, 2).length, 0)
  assert.equal(earlierAttemptRows(rows, 2).length, 2)
})

test('a delayed update from the previous attempt is rejected', () => {
  assert.equal(progressClaimAccepted(2, 1), false)
  assert.equal(progressClaimAccepted(2, null), false)
  assert.equal(progressClaimAccepted(2, 2), true)
})

test('the same driver starts again after the attempt number changes', () => {
  assert.equal(attemptDecision(1, 2), 'reset')
  assert.equal(attemptDecision(null, 1), 'keep')
  assert.equal(attemptDecision(2, 2), 'keep')
})

test('admin and customer trackers receive no events from the previous attempt', () => {
  const rows = [
    { status: 'on_way', workflow_version: 1 },
    { status: 'loading_started', workflow_version: 1 },
    { status: 'on_way', workflow_version: 2 },
  ]
  const live = currentAttemptRows(rows, 2).map((row) => row.status)
  assert.deepEqual(live, ['on_way'])
  assert.equal(earlierAttemptRows(rows, 2).length, 2)
})
