import {
  ETA_UNAVAILABLE_MESSAGE,
  formatTrackingEtaMiles,
  formatTrackingEtaTiming,
  isTrackingEtaDisplayReady,
  isTrackingGpsFresh,
  resolveTrackingEtaDestination,
  resolveTrackingGpsState,
  shouldRefreshTrackingEta,
  trackingEtaAddress,
  ETA_MOVE_THRESHOLD_M,
} from '../src/lib/trackingDriverEta.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

{
  const d = resolveTrackingEtaDestination('On way', 'on_way')
  assert(d?.kind === 'collection', 'on way → collection')
}

{
  const d = resolveTrackingEtaDestination('Assigned', 'on_way')
  assert(d?.kind === 'collection', 'status_raw on_way wins over Assigned')
}

{
  const d = resolveTrackingEtaDestination('Arrived', 'arrived')
  assert(d == null, 'arrived → no ETA')
}

{
  const d = resolveTrackingEtaDestination('In transit', 'in_transit')
  assert(d?.kind === 'delivery', 'in transit → delivery')
}

{
  const d = resolveTrackingEtaDestination('In progress', 'in_progress')
  assert(d?.kind === 'delivery', 'in progress → delivery')
}

{
  const d = resolveTrackingEtaDestination('Assigned', 'assigned')
  assert(d == null, 'assigned alone → no collection ETA until Start Job')
}

{
  const d = resolveTrackingEtaDestination('Accepted', 'confirmed')
  assert(d == null, 'accepted/confirmed → no ETA until Start Job')
}

{
  const t = formatTrackingEtaTiming(12 * 60, Date.parse('2026-10-07T15:07:00Z'))
  assert(t.minutesLabel === '12 min', `minutes ${t.minutesLabel}`)
  assert(/^\d{2}:\d{2}$/.test(t.clock), `clock ${t.clock}`)
  assert(
    t.phrase === `Approximately 12 minutes · Estimated arrival ${t.clock}`,
    `phrase ${t.phrase}`,
  )
}

{
  const near = formatTrackingEtaTiming(1.117, Date.parse('2026-10-09T22:38:00Z'))
  assert(near.minutesLabel === '1 min', `near minutes ${near.minutesLabel}`)
  assert(
    near.phrase === `Approximately 1 minute · Estimated arrival ${near.clock}`,
    `near phrase ${near.phrase}`,
  )
  assert(
    isTrackingEtaDisplayReady(
      { status: 'ready', phrase: near.phrase, clock: near.clock, minutesLabel: near.minutesLabel, milesLabel: '<0.1' },
      true,
    ),
    'short approach must still display',
  )
}

{
  assert(formatTrackingEtaMiles(6920) === '4.3', 'miles format')
  assert(formatTrackingEtaMiles(6.052) === '<0.1', 'metres beside the stop must not become an em dash')
  assert(formatTrackingEtaMiles(0) === '—', 'zero miles')
}

{
  assert(trackingEtaAddress('collection', '43 Kingswood Drive', '34 Govanhill Street') === '43 Kingswood Drive', 'collection address')
  assert(trackingEtaAddress('delivery', '43 Kingswood Drive', '34 Govanhill Street') === '34 Govanhill Street', 'delivery address')
}

{
  const loc = { available: true, live: true, updated_at: new Date().toISOString(), motion: { state: 'stationary' } }
  assert(resolveTrackingGpsState({ trackingLive: true, location: loc }) === 'fresh', 'stopped is still fresh GPS')
  assert(isTrackingGpsFresh({ trackingLive: true, location: loc }) === true, 'stopped is not missing GPS')
  assert(ETA_UNAVAILABLE_MESSAGE === 'Arrival time temporarily unavailable', 'unavailable copy')
}

{
  const a = { lng: -4.26, lat: 55.86 }
  const b = { lng: -4.26, lat: 55.86 + 20 / 111111 }
  assert(
    shouldRefreshTrackingEta(a, b, Date.now() - 1000) === false,
    'small move should not refresh',
  )
  const c = { lng: -4.26, lat: 55.86 + (ETA_MOVE_THRESHOLD_M + 10) / 111111 }
  assert(shouldRefreshTrackingEta(a, c, Date.now() - 1000) === true, 'large move refreshes')
  assert(shouldRefreshTrackingEta(a, a, Date.now() - 70_000) === true, 'age refreshes')
}

console.log('ok tracking driver eta tests')
