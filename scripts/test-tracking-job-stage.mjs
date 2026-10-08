import { resolveGpsStatusHeadline, resolveTrackingJobStage } from '../src/lib/trackingJobStage.js'
import { resolveTrackingEtaDestination } from '../src/lib/trackingDriverEta.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

{
  const s = resolveTrackingJobStage('On way', 'on_way')
  assert(s.stage === 'en_route_collection', 'on way')
  assert(s.showLiveEta === true, 'eta on')
  assert(s.journeyActive === true, 'journey active after Start Job')
  assert(s.etaKind === 'collection', 'collection')
  assert(/on the way to collection/i.test(String(s.stageMessage || '')), 'on way copy')
}

{
  const s = resolveTrackingJobStage('Arrived', 'arrived_pickup')
  assert(s.stage === 'arrived_collection', 'arrived collection')
  assert(/arrived at collection/i.test(String(s.arrivedMessage || '')), 'msg')
  assert(s.showLiveEta === false, 'no eta at stop')
}

{
  const s = resolveTrackingJobStage('In transit', 'in_transit')
  assert(s.stage === 'en_route_delivery', 'delivery')
  assert(s.etaKind === 'delivery', 'eta delivery')
  assert(/collected/i.test(String(s.stageMessage || '')), 'collected message')
}

{
  const s = resolveTrackingJobStage('Loaded', 'pickup_completed')
  assert(s.stage === 'collected', 'collected stage')
  assert(s.etaKind === 'delivery', 'route switches to delivery')
  assert(/Job collected/i.test(String(s.stageMessage || '')), 'job collected copy')
}

{
  const s = resolveTrackingJobStage('Arrived delivery', 'arrived_delivery')
  assert(s.stage === 'arrived_delivery', 'arrived delivery')
}

{
  const s = resolveTrackingJobStage('Assigned', 'Booked')
  assert(s.stage === 'awaiting_departure', 'assigned waits for Start Job')
  assert(s.showLiveEta === false, 'no ETA before Start Job')
  assert(s.etaKind == null, 'no route kind before Start Job')
  assert(s.journeyActive === false, 'journey not active')
  assert(/has not yet started/i.test(String(s.stageMessage || '')), 'not started copy')
  assert(/Waiting for driver to depart/i.test(String(s.waitingMessage || '')), 'waiting copy')
}

assert(resolveTrackingEtaDestination('Assigned', 'Booked') == null, 'ETA dest null before Start Job')
assert(resolveTrackingEtaDestination('On way', 'on_way')?.kind === 'collection', 'ETA after Start Job')

assert(
  resolveGpsStatusHeadline({ state: 'moving' }, true, { journeyActive: false }) === 'Moving',
  'show Moving before Start Job when GPS is moving',
)
assert(
  resolveGpsStatusHeadline({ state: 'stationary' }, true, { journeyActive: false })
    === 'Waiting for driver to depart',
  'waiting copy when parked before Start Job',
)
assert(resolveGpsStatusHeadline({ state: 'moving' }, true, { journeyActive: true }) === 'Moving', 'moving')
assert(resolveGpsStatusHeadline({ state: 'stationary' }, true, { journeyActive: true }) === 'Stopped', 'stopped')
assert(resolveGpsStatusHeadline({ state: 'stale' }, false, { journeyActive: true }) === 'GPS delayed', 'delayed')
assert(
  resolveGpsStatusHeadline({ state: 'unavailable' }, false, { journeyActive: true }) === 'GPS unavailable',
  'unavailable',
)

console.log('ok tracking job stage tests')
