// Runnable check for src/invite.js: npm run check
import assert from 'node:assert/strict'
import { ics, intl, left } from './invite.js'

const timed = ics(
  { slug: 'a-b', event_date: '2026-12-01', starts_at: '2026-12-01T03:00:00Z', venue: 'Dewan Seri', address: 'Jalan 1, Shah Alam\nSelangor' },
  'Walimatul Urus A & B', 'https://x.test/a-b')
assert.ok(timed.startsWith('BEGIN:VCALENDAR\r\n') && timed.endsWith('\r\nEND:VCALENDAR'))
assert.match(timed, /\r\nDTSTART:20261201T030000Z\r\nDTEND:20261201T060000Z\r\n/, 'no ends_at → 3 hours')
assert.match(timed, /\r\nLOCATION:Dewan Seri\\, Jalan 1\\, Shah Alam\\nSelangor\r\n/, 'commas and newlines escaped')
assert.match(timed, /\r\nURL:https:\/\/x.test\/a-b\r\n/)

const allDay = ics({ slug: 'a-b', event_date: '2026-12-31' }, 'x')
assert.match(allDay, /\r\nDTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101\r\n/, 'all-day crosses year end')
assert.ok(!allDay.includes('LOCATION') && !allDay.includes('URL'))

assert.equal(intl('012-345 6789'), '60123456789')
assert.equal(intl('+60 12 345 6789'), '60123456789')

assert.deepEqual(left(Date.UTC(2026, 0, 2, 1, 2, 3), Date.UTC(2026, 0, 1)), [1, 1, 2, 3])
assert.deepEqual(left(0, 1000), [0, 0, 0, 0])

console.log('invite ok')
