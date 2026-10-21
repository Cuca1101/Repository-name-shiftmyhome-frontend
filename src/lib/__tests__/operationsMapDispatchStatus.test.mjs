import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveDispatchDriverStatus } from '../operationsMapDispatchRules.js'

test('an on-the-way job is not idle when the GPS row still says available', () => {
  assert.equal(resolveDispatchDriverStatus('available', 'on_way', 1, true), 'on_route')
  assert.equal(resolveDispatchDriverStatus('available', 'on_way', 1, false), 'assigned')
})

test('a driver with no job can still be idle', () => {
  assert.equal(resolveDispatchDriverStatus('available', '', 0, true), 'idle')
  assert.equal(resolveDispatchDriverStatus('available', '', 0, false), 'offline')
})

test('the map status module can call the resolver', () => {
  const src = readFileSync(new URL('../operationsMapDispatchStatus.js', import.meta.url), 'utf8')
  assert.match(src, /import\s*\{[^}]*resolveDispatchDriverStatus[^}]*\}\s*from\s*['"]\.\/operationsMapDispatchRules/)
})
