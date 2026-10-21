import assert from 'node:assert/strict'
import { register } from 'node:module'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const { buildAdminLiveStage } = await import('../jobDispatchTimeline.js')
const {
  customerTrackingFromLiveStage,
  resolveCustomerTrackingStage,
  resolveGpsStatusHeadline,
} = await import('../trackingJobStage.js')

const assigned = { assigned_at: '2026-10-21T22:02:22.658Z' }

test('assigned before Start waits, and a loading status does not say the driver is loading', () => {
  const stage = buildAdminLiveStage(assigned, [])
  const banner = customerTrackingFromLiveStage(stage, {
    status_raw: 'loading_started',
    operational_status: 'Loading',
    assignment_status: 'active',
    location: { motion: { state: 'stationary' } },
  })
  assert.equal(banner.stageMessage, 'Driver assigned — waiting to start')
  assert.equal(banner.arrivedMessage, null)
  assert.equal(banner.showLiveEta, false)

  const fromStatus = resolveCustomerTrackingStage({
    status_raw: 'loading_started',
    operational_status: 'Loading',
    assignment_status: 'active',
    location: { motion: { state: 'stationary' } },
  })
  assert.equal(fromStatus.stageMessage, 'Driver assigned — waiting to start')
  assert.equal(fromStatus.arrivedMessage, null)
  assert.equal(resolveGpsStatusHeadline({ state: 'stationary' }, true, { journeyActive: false }), 'Waiting for driver to depart')
})

test('the saved SMH loading row stays on the way because Start is the on_way event', () => {
  const stage = buildAdminLiveStage(assigned, [
    { status: 'on_way', occurred_at: '2026-10-21T22:03:09.993Z', source: 'manual', workflow_version: 6 },
    { status: 'loading_started', occurred_at: '2026-10-21T22:31:23.44Z', source: 'manual', stop_type: 'pickup', workflow_version: 6 },
  ])
  const banner = customerTrackingFromLiveStage(stage, {
    status_raw: 'loading_started',
    operational_status: 'Loading',
    assignment_status: 'on_way',
    location: { motion: { state: 'stationary' } },
  })
  assert.equal(banner.stageMessage, 'Your driver is on the way to collection')
  assert.equal(banner.arrivedMessage, null)
  assert.equal(banner.showLiveEta, true)
  assert.equal(stage.collection.timer.running, false)
  assert.equal(resolveGpsStatusHeadline({ state: 'stationary' }, true, { journeyActive: true }), 'Stopped')
})

test('GPS arrival after Start shows at collection, and completion stops the timer', () => {
  const arrived = buildAdminLiveStage(assigned, [
    { status: 'on_way', occurred_at: '2026-05-28T10:00:00Z', source: 'manual' },
    { status: 'arrived_pickup', occurred_at: '2026-05-28T10:20:00Z', source: 'gps' },
  ])
  const atCollection = customerTrackingFromLiveStage(arrived, {})
  assert.equal(atCollection.arrivedMessage, 'Your driver is at collection')
  assert.equal(atCollection.showLiveEta, false)
  assert.equal(arrived.collection.timer.running, true)

  const done = buildAdminLiveStage(assigned, [
    { status: 'on_way', occurred_at: '2026-05-28T10:00:00Z', source: 'manual' },
    { status: 'arrived_pickup', occurred_at: '2026-05-28T10:20:00Z', source: 'gps' },
    { status: 'pickup_completed', occurred_at: '2026-05-28T10:50:00Z', source: 'manual' },
    { status: 'in_transit', occurred_at: '2026-05-28T11:00:00Z', source: 'manual' },
    { status: 'arrived_delivery', occurred_at: '2026-05-28T11:30:00Z', source: 'gps' },
    { status: 'completed', occurred_at: '2026-05-28T12:00:00Z', source: 'manual' },
  ])
  assert.equal(done.collection.timer.running, false)
  assert.equal(done.delivery.timer.running, false)
  const finished = customerTrackingFromLiveStage(done, { completed_at: '2026-05-28T12:00:00Z' })
  assert.equal(finished.stageMessage, 'Your move is complete')
})

test('delivery start and GPS arrival use their own messages', () => {
  const driving = buildAdminLiveStage(assigned, [
    { status: 'on_way', occurred_at: '2026-05-28T10:00:00Z' },
    { status: 'pickup_completed', occurred_at: '2026-05-28T10:40:00Z' },
    { status: 'in_transit', occurred_at: '2026-05-28T10:50:00Z' },
  ])
  assert.equal(customerTrackingFromLiveStage(driving, {}).stageMessage, 'Your driver is on the way to delivery')

  const there = buildAdminLiveStage(assigned, [
    { status: 'on_way', occurred_at: '2026-05-28T10:00:00Z' },
    { status: 'in_transit', occurred_at: '2026-05-28T10:50:00Z' },
    { status: 'arrived_delivery', occurred_at: '2026-05-28T11:20:00Z', source: 'gps' },
    { status: 'unloading_started', occurred_at: '2026-05-28T11:25:00Z', source: 'manual' },
  ])
  const banner = customerTrackingFromLiveStage(there, { location: { motion: { state: 'stationary' } } })
  assert.equal(banner.arrivedMessage, 'Your driver is at delivery')
  assert.equal(there.delivery.timer.running, true)
})
