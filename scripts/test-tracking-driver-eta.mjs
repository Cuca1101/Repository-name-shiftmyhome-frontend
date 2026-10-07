import {
  formatTrackingEtaMiles,
  formatTrackingEtaTiming,
  resolveTrackingEtaDestination,
  shouldRefreshTrackingEta,
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
  const t = formatTrackingEtaTiming(12 * 60, Date.parse('2026-10-07T15:07:00Z'))
  assert(t.minutesLabel === '12 min', `minutes ${t.minutesLabel}`)
  assert(/^\d{2}:\d{2}$/.test(t.clock), `clock ${t.clock}`)
}

{
  assert(formatTrackingEtaMiles(6920) === '4.3', 'miles format')
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
