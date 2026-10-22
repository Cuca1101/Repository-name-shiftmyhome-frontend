import assert from 'node:assert/strict'
import { register } from 'node:module'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const { buildAdminLiveStage, dispatchWorkflowBadge, liveStageFromPortalBooking, formatLoadDuration } = await import('../jobDispatchTimeline.js')
const { formatDateTimeUK } = await import('../formatDateDisplay.js')

const assigned = {
  id: 'q1',
  assigned_at: '2026-05-28T09:00:00Z',
  assigned_driver_id: 'd1',
  assigned_driver_name: 'Driver One',
}

test('Accepted is the admin assignment time, before the driver starts', () => {
  const stage = buildAdminLiveStage(assigned, [])
  assert.equal(stage.accepted.at, '2026-05-28T09:00:00Z')
  assert.equal(stage.accepted.state, 'current')
  assert.equal(stage.currentLabel, 'Accepted')
  assert.equal(stage.collection.start.at, '')
  assert.equal(stage.collection.arrived.at, '')
  assert.equal(stage.delivery.complete.at, '')
})

test('maps the driver app sequence and keeps every stamp', () => {
  const history = [
    { status: 'on_way', occurred_at: '2026-05-28T10:00:00Z', source: 'manual' },
    { status: 'arrived_pickup', occurred_at: '2026-05-28T10:20:00Z', source: 'gps' },
    { status: 'loading_started', occurred_at: '2026-05-28T10:25:00Z', source: 'manual' },
    { status: 'pickup_completed', occurred_at: '2026-05-28T10:50:00Z', source: 'manual' },
    { status: 'in_transit', occurred_at: '2026-05-28T10:55:00Z', source: 'manual' },
    { status: 'arrived_delivery', occurred_at: '2026-05-28T11:30:00Z', source: 'gps' },
    { status: 'unloading_started', occurred_at: '2026-05-28T11:35:00Z', source: 'manual' },
    { status: 'completed', occurred_at: '2026-05-28T12:00:00Z', source: 'manual' },
  ]
  const stage = buildAdminLiveStage(
    { ...assigned, status: 'completed', operational_status: 'Completed', completed_at: '2026-05-28T12:00:00Z' },
    history,
  )

  assert.equal(stage.collection.start.at, '2026-05-28T10:00:00Z')
  assert.equal(stage.collection.arrived.at, '2026-05-28T10:20:00Z')
  assert.equal(stage.collection.complete.at, '2026-05-28T10:50:00Z')
  assert.equal(stage.delivery.start.at, '2026-05-28T10:55:00Z')
  assert.equal(stage.delivery.arrived.at, '2026-05-28T11:30:00Z')
  assert.equal(stage.delivery.complete.at, '2026-05-28T12:00:00Z')
  assert.equal(stage.collection.timer.running, false)
  assert.equal(stage.delivery.timer.running, false)
  assert.equal(stage.collection.timer.endedAt, '2026-05-28T10:50:00Z')
  assert.equal(stage.delivery.timer.endedAt, '2026-05-28T12:00:00Z')
  assert.equal(formatLoadDuration(stage.collection.timer.startedAt, stage.collection.timer.endedAt), '30 min')
  assert.equal(formatLoadDuration(stage.delivery.timer.startedAt, stage.delivery.timer.endedAt), '30 min')
  assert.equal(stage.currentLabel, 'Completed')
  assert.equal(stage.collection.start.state, 'done')
  assert.equal(stage.delivery.complete.state, 'done')
})

test('the first saved arrival is the recorded time, including a manual press', () => {
  const stage = buildAdminLiveStage(assigned, [
    { status: 'on_way', occurred_at: '2026-05-28T10:00:00Z', source: 'manual' },
    { status: 'arrived_pickup', occurred_at: '2026-05-28T10:10:00Z', source: 'manual' },
    { status: 'arrived_pickup', occurred_at: '2026-05-28T10:18:00Z', source: 'gps' },
  ])
  assert.equal(stage.collection.arrived.at, '2026-05-28T10:10:00Z')
  assert.equal(stage.collection.arrived.state, 'current')
  assert.equal(stage.collection.timer.running, true)
  assert.equal(stage.collection.timer.startedAt, '2026-05-28T10:10:00Z')
  assert.equal(stage.currentLabel, 'Arrived at collection · Manual · 11:10')
  assert.equal(stage.collection.arrived.label, 'Arrived · Manual')
})

test('loading after arrival stays on the arrival and names the loading clock', () => {
  const stage = buildAdminLiveStage(assigned, [
    { status: 'on_way', occurred_at: '2026-05-28T10:00:00Z', source: 'manual' },
    { status: 'arrived_pickup', occurred_at: '2026-05-28T10:20:00Z', source: 'manual' },
    { status: 'loading_started', occurred_at: '2026-05-28T10:25:00Z', source: 'manual' },
  ])
  assert.equal(stage.collection.arrived.at, '2026-05-28T10:20:00Z')
  assert.equal(stage.collection.loadingAt, '2026-05-28T10:25:00Z')
  assert.equal(stage.currentLabel, 'Arrived at collection · Manual · 11:20')
})

test('a manual arrival after Start shows even when an older item tick exists', () => {
  const stage = buildAdminLiveStage(assigned, [
    { status: 'loading_started', occurred_at: '2026-10-21T22:31:00.233Z', source: 'manual', stop_type: 'pickup' },
    { status: 'on_way', occurred_at: '2026-10-22T08:15:48.708Z', source: 'manual', stop_type: 'pickup' },
    { status: 'arrived_pickup', occurred_at: '2026-10-22T08:46:11.180Z', source: 'manual', stop_type: 'pickup' },
  ])
  assert.equal(stage.collection.start.at, '2026-10-22T08:15:48.708Z')
  assert.equal(stage.collection.arrived.at, '2026-10-22T08:46:11.180Z')
  assert.equal(stage.currentLabel, 'Arrived at collection · Manual · 09:46')
  assert.equal(stage.collection.arrived.label, 'Arrived · Manual')
  assert.equal(stage.collection.timer.running, true)
})

test('collection timer runs from arrival until collection complete, excluding travel', () => {
  const travelling = buildAdminLiveStage(assigned, [
    { status: 'on_way', occurred_at: '2026-05-28T10:00:00Z' },
  ])
  assert.equal(travelling.collection.timer.running, false)
  assert.equal(travelling.currentLabel, 'Left for collection · 11:00')

  const onSite = buildAdminLiveStage(assigned, [
    { status: 'on_way', occurred_at: '2026-05-28T10:00:00Z' },
    { status: 'arrived_pickup', occurred_at: '2026-05-28T10:20:00Z', source: 'gps' },
  ])
  assert.equal(onSite.collection.timer.running, true)
  assert.equal(onSite.collection.start.state, 'done')

  const finished = buildAdminLiveStage(assigned, [
    { status: 'on_way', occurred_at: '2026-05-28T10:00:00Z' },
    { status: 'arrived_pickup', occurred_at: '2026-05-28T10:20:00Z', source: 'gps' },
    { status: 'pickup_completed', occurred_at: '2026-05-28T10:50:00Z' },
  ])
  assert.equal(finished.collection.timer.running, false)
  assert.equal(finished.collection.timer.endedAt, '2026-05-28T10:50:00Z')
  assert.equal(finished.collection.complete.state, 'current')
  assert.equal(finished.currentLabel, 'Collection complete')
})

test('delivery timer is separate and stops when the job is completed', () => {
  const history = [
    { status: 'pickup_completed', occurred_at: '2026-05-28T10:50:00Z' },
    { status: 'in_transit', occurred_at: '2026-05-28T10:55:00Z' },
    { status: 'arrived_delivery', occurred_at: '2026-05-28T11:30:00Z', source: 'gps' },
  ]
  const onSite = buildAdminLiveStage(assigned, history)
  assert.equal(onSite.delivery.timer.running, true)
  assert.equal(onSite.collection.timer.running, false)
  assert.equal(onSite.currentLabel, 'Arrived at delivery · Automatic (GPS) · 12:30')
  assert.equal(onSite.delivery.arrived.label, 'Arrived · Automatic (GPS)')
  assert.equal(onSite.delivery.start.state, 'done')

  const done = buildAdminLiveStage(assigned, [
    ...history,
    { status: 'completed', occurred_at: '2026-05-28T12:10:00Z' },
  ])
  assert.equal(done.delivery.timer.running, false)
  assert.equal(done.delivery.timer.endedAt, '2026-05-28T12:10:00Z')
  assert.equal(formatLoadDuration(done.delivery.timer.startedAt, done.delivery.timer.endedAt), '40 min')
})

test('a missing event stays empty and a historical completion stamp is kept', () => {
  const stage = buildAdminLiveStage(
    { ...assigned, status: 'completed', completed_at: '2026-05-28T15:00:00Z' },
    [
      { status: 'on_way', created_at: '2026-05-28T11:00:00Z' },
      { status: 'in_transit', created_at: '2026-05-28T13:00:00Z' },
    ],
  )
  assert.equal(stage.collection.arrived.at, '')
  assert.equal(stage.collection.arrived.state, 'upcoming')
  assert.equal(stage.collection.timer.running, false)
  assert.equal(stage.delivery.complete.at, '2026-05-28T15:00:00Z')
  assert.equal(stage.collection.start.at, '2026-05-28T11:00:00Z')
  assert.equal(stage.delivery.start.at, '2026-05-28T13:00:00Z')
})

test('generic arrived follows the stop, and corrections are ignored', () => {
  const stage = buildAdminLiveStage(assigned, [
    { status: 'on_way', occurred_at: '2026-05-28T10:00:00Z', source: 'manual' },
    { id: 'a', status: 'arrived', occurred_at: '2026-05-28T10:20:00Z', source: 'gps', stop_type: 'pickup' },
    { id: 'b', status: 'arrived', occurred_at: '2026-05-28T10:25:00Z', source: 'manual', corrects_event_id: 'a' },
    { status: 'in_transit', occurred_at: '2026-05-28T11:00:00Z' },
    { status: 'arrived', occurred_at: '2026-05-28T11:40:00Z', source: 'gps', stop_type: 'delivery' },
  ])
  assert.equal(stage.collection.arrived.at, '2026-05-28T10:20:00Z')
  assert.equal(stage.delivery.arrived.at, '2026-05-28T11:40:00Z')
})

test('UK display follows daylight saving', () => {
  assert.equal(formatDateTimeUK('2026-06-15T12:00:00Z'), '15/06/2026, 13:00')
  assert.equal(formatDateTimeUK('2026-01-15T12:00:00Z'), '15/01/2026, 12:00')
})

test('customer portal booking fields match the admin live stage', () => {
  const history = [
    { status: 'on_way', occurred_at: '2026-05-28T10:00:00Z', source: 'manual' },
    { status: 'arrived_pickup', occurred_at: '2026-05-28T10:20:00Z', source: 'gps' },
    { status: 'loading_started', occurred_at: '2026-05-28T10:25:00Z', source: 'manual' },
    { status: 'pickup_completed', occurred_at: '2026-05-28T10:50:00Z', source: 'manual' },
    { status: 'in_transit', occurred_at: '2026-05-28T10:55:00Z', source: 'manual' },
    { status: 'arrived_delivery', occurred_at: '2026-05-28T11:30:00Z', source: 'gps' },
    { status: 'unloading_started', occurred_at: '2026-05-28T11:35:00Z', source: 'manual' },
    { status: 'completed', occurred_at: '2026-05-28T12:10:00Z', source: 'manual' },
  ]
  const quote = {
    ...assigned,
    status: 'completed',
    operational_status: 'Completed',
    completed_at: '2026-05-28T12:10:00Z',
    cancelled_at: '',
  }
  const assignment = { status: 'completed', completed_at: '2026-05-28T12:10:00Z' }
  const booking = {
    assigned_at: quote.assigned_at,
    status: quote.status,
    operational_status: quote.operational_status,
    completed_at: quote.completed_at,
    cancelled_at: '',
    assignment_status: assignment.status,
    assignment_completed_at: assignment.completed_at,
  }
  const admin = buildAdminLiveStage(quote, history, null, assignment)
  const portal = liveStageFromPortalBooking(booking, history)
  assert.deepEqual(portal, admin)
  const now = Date.parse('2026-05-28T13:00:00Z')
  for (const key of ['collection', 'delivery']) {
    assert.equal(formatDateTimeUK(portal[key].start.at), formatDateTimeUK(admin[key].start.at))
    assert.equal(formatDateTimeUK(portal[key].arrived.at), formatDateTimeUK(admin[key].arrived.at))
    assert.equal(formatDateTimeUK(portal[key].complete.at), formatDateTimeUK(admin[key].complete.at))
    assert.equal(
      formatLoadDuration(portal[key].timer.startedAt, portal[key].timer.endedAt, now),
      formatLoadDuration(admin[key].timer.startedAt, admin[key].timer.endedAt, now),
    )
  }
  assert.equal(formatDateTimeUK(portal.accepted.at), formatDateTimeUK(admin.accepted.at))
  assert.equal(formatLoadDuration(portal.collection.timer.startedAt, portal.collection.timer.endedAt, now), '30 min')
  assert.equal(formatLoadDuration(portal.delivery.timer.startedAt, portal.delivery.timer.endedAt, now), '40 min')
})

test('a loading row is not arrival, and GPS arrival before Start is ignored', () => {
  const loadingOnly = buildAdminLiveStage(assigned, [
    { status: 'on_way', occurred_at: '2026-10-21T22:03:09.993Z', source: 'manual' },
    { status: 'loading_started', occurred_at: '2026-10-21T22:31:23.44Z', source: 'manual', stop_type: 'pickup' },
  ])
  assert.equal(loadingOnly.collection.start.at, '2026-10-21T22:03:09.993Z')
  assert.equal(loadingOnly.collection.arrived.at, '')
  assert.equal(loadingOnly.collection.timer.running, false)
  assert.equal(loadingOnly.currentLabel, 'Left for collection · 23:03')

  const earlyGps = buildAdminLiveStage(assigned, [
    { status: 'arrived_pickup', occurred_at: '2026-05-28T08:00:00Z', source: 'gps' },
    { status: 'on_way', occurred_at: '2026-05-28T10:00:00Z', source: 'manual' },
  ])
  assert.equal(earlyGps.collection.arrived.at, '')
  assert.equal(earlyGps.collection.timer.running, false)
})

test('an earlier assignment does not advance the current one', async () => {
  const { currentAttemptRows } = await import('../driverWorkflowAttempt.js')
  const history = [
    { status: 'on_way', occurred_at: '2026-10-21T18:00:00Z', workflow_version: 5, source: 'manual' },
    { status: 'loading_started', occurred_at: '2026-10-21T18:20:00Z', workflow_version: 5, source: 'manual' },
    { status: 'arrived_pickup', occurred_at: '2026-10-21T18:10:00Z', workflow_version: 5, source: 'gps' },
  ]
  const stage = buildAdminLiveStage(assigned, currentAttemptRows(history, 6))
  assert.equal(stage.collection.start.at, '')
  assert.equal(stage.collection.arrived.at, '')
  assert.equal(stage.currentLabel, 'Accepted')
})

test('a saved on_way Start stays Left for collection with its UK time', () => {
  const quote = {
    ...assigned,
    status: 'on_way',
    operational_status: 'Left for collection',
    marketplace_visibility: 'assigned',
  }
  const stage = buildAdminLiveStage(quote, [
    { status: 'on_way', occurred_at: '2026-10-22T12:51:17.736Z', source: 'manual', stop_type: 'pickup' },
  ])
  assert.equal(stage.currentLabel, 'Left for collection · 13:51')
  assert.equal(stage.collection.start.at, '2026-10-22T12:51:17.736Z')
  assert.equal(dispatchWorkflowBadge(quote).label, 'Active')

  const delivery = buildAdminLiveStage(quote, [
    { status: 'on_way', occurred_at: '2026-10-22T12:51:17.736Z' },
    { status: 'pickup_completed', occurred_at: '2026-10-22T13:10:00Z' },
    { status: 'arrived_pickup', occurred_at: '2026-10-22T13:00:00Z', source: 'manual' },
    { status: 'in_transit', occurred_at: '2026-10-22T13:20:00Z', source: 'manual' },
  ])
  assert.equal(delivery.currentLabel, 'Left for delivery · 14:20')
})

test('the same saved stamps rebuild after a fresh call', () => {
  const history = [
    { status: 'on_way', occurred_at: '2026-05-28T10:00:00Z' },
    { status: 'arrived_pickup', occurred_at: '2026-05-28T10:20:00Z', source: 'gps' },
    { status: 'pickup_completed', occurred_at: '2026-05-28T10:50:00Z' },
  ]
  const first = buildAdminLiveStage(assigned, history)
  const second = buildAdminLiveStage(assigned, history)
  assert.deepEqual(first, second)
})
