import assert from 'node:assert/strict'
import test from 'node:test'
import { buildStageClocks, resolveLiveStageLabel } from '../stageClocks.js'

test('arrived keeps running through loading and stops at collection complete', () => {
  const events = [
    { id: '1', status: 'arrived_pickup', occurred_at: '2026-10-14T10:00:00Z' },
    { id: '2', status: 'loading_started', occurred_at: '2026-10-14T10:10:00Z' },
    { id: '3', status: 'pickup_completed', occurred_at: '2026-10-14T10:40:00Z' },
  ]
  const clocks = buildStageClocks(events)
  assert.equal(clocks.atCollection.startedAt, '2026-10-14T10:00:00Z')
  assert.equal(clocks.atCollection.endedAt, '2026-10-14T10:40:00Z')
  assert.equal(clocks.loading.startedAt, '2026-10-14T10:10:00Z')
  assert.equal(clocks.loading.endedAt, '2026-10-14T10:40:00Z')

  assert.equal(resolveLiveStageLabel('loading_started', clocks, false), 'Arrived at collection · Loading')
})

test('an item tick before arrival does not start the loading clock', () => {
  const clocks = buildStageClocks([
    { id: '1', status: 'loading_started', occurred_at: '2026-10-21T22:31:00Z' },
    { id: '2', status: 'on_way', occurred_at: '2026-10-22T08:15:48Z' },
    { id: '3', status: 'arrived_pickup', occurred_at: '2026-10-22T08:46:11Z' },
  ])
  assert.equal(clocks.loading.startedAt, '')
  assert.equal(clocks.atCollection.startedAt, '2026-10-22T08:46:11Z')
  assert.equal(resolveLiveStageLabel('arrived_pickup', clocks, false), 'Arrived at collection')
})

test('no checked items leaves loading and unloading unrecorded', () => {
  const events = [
    { id: '1', status: 'arrived_pickup', occurred_at: '2026-10-14T10:00:00Z' },
    { id: '2', status: 'pickup_completed', occurred_at: '2026-10-14T10:20:00Z' },
    { id: '3', status: 'in_transit', occurred_at: '2026-10-14T10:25:00Z' },
    { id: '4', status: 'arrived_delivery', occurred_at: '2026-10-14T11:00:00Z' },
    { id: '5', status: 'completed', occurred_at: '2026-10-14T11:30:00Z' },
  ]
  const clocks = buildStageClocks(events)
  assert.equal(clocks.loading.startedAt, '')
  assert.equal(clocks.loading.endedAt, '')
  assert.equal(clocks.unloading.startedAt, '')
  assert.equal(clocks.atCollection.endedAt, '2026-10-14T10:20:00Z')
  assert.equal(clocks.atDelivery.endedAt, '2026-10-14T11:30:00Z')
  assert.equal(resolveLiveStageLabel('pickup_completed', clocks, false), 'Collection complete')
})

test('unloading starts at the first stamp and stops when the job is completed', () => {
  const events = [
    { id: '1', status: 'arrived_delivery', occurred_at: '2026-10-14T11:00:00Z' },
    { id: '2', status: 'unloading_started', occurred_at: '2026-10-14T11:05:00Z' },
    { id: '3', status: 'completed', occurred_at: '2026-10-14T11:35:00Z' },
  ]
  const clocks = buildStageClocks(events)
  assert.equal(clocks.unloading.startedAt, '2026-10-14T11:05:00Z')
  assert.equal(clocks.unloading.endedAt, '2026-10-14T11:35:00Z')
  assert.equal(clocks.atDelivery.startedAt, '2026-10-14T11:00:00Z')
  assert.equal(clocks.atDelivery.endedAt, '2026-10-14T11:35:00Z')
})
