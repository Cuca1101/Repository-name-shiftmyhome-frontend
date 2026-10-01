import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const { teamsCallLink, teamsCallUrl, TEAMS_HOME_URL } = await import('../src/lib/teamsPhone.js')

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
}

const uk = teamsCallLink('0141 461 4813')
assert(uk.ok, 'uk number validates')
assert(uk.e164 === '+441414614813', 'uk becomes E.164')
assert(uk.href === 'https://teams.microsoft.com/l/call/0/0?users=4:%2B441414614813', 'official PSTN deep link')
assert(teamsCallUrl('+447440365226') === 'https://teams.microsoft.com/l/call/0/0?users=4:%2B447440365226', 'plus is encoded')
assert(TEAMS_HOME_URL === 'https://teams.microsoft.com/', 'teams home is the official host')
const bad = teamsCallLink('123')
assert(!bad.ok && bad.error, 'invalid number is rejected')

const { listTeamsPstnCalls } = await import('../functions/_shared/teamsGraph.js')
const empty = await listTeamsPstnCalls(new Request('http://localhost/api/admin/teams/calls', { method: 'POST', body: '{}' }), {})
assert(empty.configured === false, 'missing Graph credentials stay unconfigured')
assert(empty.calls.length === 0, 'unconfigured history has no rows')
assert(empty.recordingsAvailable === false, 'recordings are not invented')

console.log('Teams phone links: OK')
