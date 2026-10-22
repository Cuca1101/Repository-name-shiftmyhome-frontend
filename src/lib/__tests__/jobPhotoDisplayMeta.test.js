import assert from 'node:assert/strict'
import { register } from 'node:module'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const { resolveJobPhotoDisplayMeta } = await import('../jobPhotoDisplayMeta.js')
const { groupJobPhotos, photoSectionForType } = await import('../jobCustomerTracking.js')

test('a collection photo saved as Delivery photo keeps the pickup label', () => {
  const meta = resolveJobPhotoDisplayMeta(
    {
      display_title: 'Delivery photo',
      display_line: 'Delivery photo — 22/10/2026 14:16 — Added by Driver — Collection address',
      photo_kind: 'delivery',
      category: 'delivery',
      location_type: 'collection',
      stop_type: 'PICKUP',
      job_stop_address: '32 Hume Drive, Glasgow G71 8LN',
    },
    { photo_type: 'delivery', stop_type: 'PICKUP', file_name: 'delivery_delivery_1792673781521.jpg' },
  )
  assert.equal(meta.displayTitle, 'Pickup photo')
  assert.match(meta.displayLine, /^Pickup photo/)
  assert.equal(meta.jobStopAddress, '32 Hume Drive, Glasgow G71 8LN')
  assert.equal(
    photoSectionForType('delivery', 'PICKUP', { location_type: 'collection', stop_type: 'PICKUP' }),
    'pickup',
  )
})

test('a real delivery photo stays a delivery photo', () => {
  const meta = resolveJobPhotoDisplayMeta(
    {
      display_title: 'Delivery photo',
      photo_kind: 'delivery',
      location_type: 'delivery',
      stop_type: 'DROPOFF',
      job_stop_address: '45 Small Crescent, Glasgow G72 0NP',
    },
    { photo_type: 'delivery', stop_type: 'DROPOFF' },
  )
  assert.equal(meta.displayTitle, 'Delivery photo')
  assert.equal(photoSectionForType('delivery', 'DROPOFF', { location_type: 'delivery' }), 'delivery')
})

test('a pickup signature shows the person who signed', () => {
  const meta = resolveJobPhotoDisplayMeta(
    {
      evidence_type: 'pod_signature',
      recipientName: 'Elizabeth',
      stop_type: 'PICKUP',
    },
    { photo_type: 'collection', stop_type: 'PICKUP', file_name: 'pod_signature.png' },
  )
  assert.equal(meta.displayTitle, 'Pickup signature')
  assert.equal(meta.signerName, 'Elizabeth')
  const groups = groupJobPhotos([
    {
      id: 'sig',
      photo_type: 'collection',
      stop_type: 'PICKUP',
      metadata: { evidence_type: 'pod_signature', recipientName: 'Elizabeth', stop_type: 'PICKUP' },
    },
  ])
  assert.equal(groups.waiver.length, 1)
  assert.equal(groups.pickup.length, 0)
})
