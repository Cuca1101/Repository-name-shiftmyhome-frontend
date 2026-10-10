import assert from 'node:assert/strict'
import { buildMoveTimeline, NOT_RECORDED } from '../src/lib/moveTimeline.js'

const timeline = buildMoveTimeline([
  {
    id: '1',
    status: 'on_way',
    occurred_at: '2026-10-10T09:00:00.000Z',
    created_at: '2026-10-10T09:05:00.000Z',
    source: 'manual',
    driver_name: 'Andrei Teglas',
    latitude: 55.86,
    longitude: -4.25,
    accuracy_m: 12,
    stop_type: 'pickup',
  },
  {
    id: '2',
    status: 'arrived_pickup',
    created_at: '2026-10-10T09:20:00.000Z',
    source: 'gps',
    driver_name: 'Andrei Teglas',
  },
  {
    id: '3',
    status: 'customer_not_available',
    occurred_at: '2026-10-10T09:22:00.000Z',
    created_at: '2026-10-10T09:22:00.000Z',
    stop_type: 'pickup',
    notes: 'No answer at the door',
    source: 'manual',
    driver_name: 'Andrei Teglas',
  },
  {
    id: '4',
    status: 'correction',
    corrects_event_id: '1',
    actor_name: 'office@shiftmyhome.co.uk',
    correction_reason: 'Driver confirmed the leave time',
    occurred_at: '2026-10-10T18:00:00.000Z',
    created_at: '2026-10-10T18:00:00.000Z',
  },
], [
  { id: 'p1', photo_type: 'collection', signed_url: 'https://example.test/a.jpg' },
], { completedAt: '2026-10-10T12:00:00.000Z' })

const left = timeline.milestones.find((step) => step.key === 'departed_collection')
assert.equal(left.recorded, true)
assert.equal(left.driverName, 'Andrei Teglas')
assert.equal(left.sourceLabel, 'Manual action')
assert.equal(left.showReceived, true)
assert.equal(left.corrections.length, 1)

const loading = timeline.milestones.find((step) => step.key === 'loading_started')
assert.equal(loading.whenLabel, NOT_RECORDED)
assert.equal(loading.recorded, false)

const finished = timeline.milestones.find((step) => step.key === 'loading_finished')
assert.equal(finished.photos.length, 1)

const job = timeline.milestones.find((step) => step.key === 'job_finished')
assert.equal(job.fromBooking, true)
assert.notEqual(job.whenLabel, NOT_RECORDED)
assert.equal(job.sourceLabel, NOT_RECORDED)

assert.equal(timeline.contacts.length, 1)
assert.equal(timeline.contacts[0].stage, 'Collection')
assert.equal(timeline.contacts[0].notes, 'No answer at the door')

const oldOnly = buildMoveTimeline([], [], {})
assert.ok(oldOnly.milestones.every((step) => step.whenLabel === NOT_RECORDED))

console.log('Move timeline tests passed')
