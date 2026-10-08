import { resolveGpsStatusHeadline, resolveTrackingJobStage } from '../src/lib/trackingJobStage.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

{
  const s = resolveTrackingJobStage('On way', 'on_way')
  assert(s.stage === 'en_route_collection', 'on way')
  assert(s.showLiveEta === true, 'eta on')
  assert(s.etaKind === 'collection', 'collection')
}

{
  const s = resolveTrackingJobStage('Arrived', 'arrived_pickup')
  assert(s.stage === 'arrived_collection', 'arrived collection')
  assert(s.arrivedMessage?.includes('collection'), 'msg')
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
  assert(/deliver/i.test(String(s.stageMessage || '')), 'next deliver copy')
}

{
  const s = resolveTrackingJobStage('Arrived delivery', 'arrived_delivery')
  assert(s.stage === 'arrived_delivery', 'arrived delivery')
}

{
  const s = resolveTrackingJobStage('Assigned', 'Booked')
  assert(s.etaKind === 'collection', 'assigned → collection')
}

assert(resolveGpsStatusHeadline({ state: 'moving' }, true) === 'Moving', 'moving')
assert(resolveGpsStatusHeadline({ state: 'stationary' }, true) === 'Stopped', 'stopped')
assert(resolveGpsStatusHeadline({ state: 'stale' }, false) === 'GPS delayed', 'delayed')
assert(resolveGpsStatusHeadline({ state: 'unavailable' }, false) === 'GPS unavailable', 'unavailable')

console.log('ok tracking job stage tests')
