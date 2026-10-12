// Pure helpers for the invitation page. No browser or Supabase deps, so `npm run check` runs them in Node.

const utc = (d) => new Date(d).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
const esc = (s) => s.replace(/[\\;,]/g, '\\$&').replace(/\r?\n/g, '\\n')

// "Add to calendar" file. No starts_at → all-day on event_date. No ends_at → 3 hours.
// ponytail: lines aren't folded at 75 octets; Google, Apple and Outlook calendars accept long lines
export function ics(ev, title, url) {
  let when
  if (ev.starts_at) {
    const end = ev.ends_at || new Date(ev.starts_at).getTime() + 3 * 36e5
    when = [`DTSTART:${utc(ev.starts_at)}`, `DTEND:${utc(end)}`]
  } else {
    const next = new Date(Date.parse(ev.event_date + 'T00:00Z') + 864e5).toISOString().slice(0, 10)
    when = [`DTSTART;VALUE=DATE:${ev.event_date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${next.replace(/-/g, '')}`]
  }
  const where = [ev.venue, ev.address].filter(Boolean).join(', ')
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sepatah//EN', 'BEGIN:VEVENT',
    `UID:${ev.slug}@sepatah`, `DTSTAMP:${utc(Date.now())}`, ...when, `SUMMARY:${esc(title)}`,
    where && `LOCATION:${esc(where)}`, url && `URL:${url}`, 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n')
}

// Phone as typed (012-345 6789, +60 12 345 6789) → 60123456789 for wa.me and tel:
export const intl = (p) => {
  const d = p.replace(/\D/g, '')
  return d.startsWith('0') ? '6' + d : d
}

// [days, hours, minutes, seconds] until `at` (ms), all 0 once it has passed
export function left(at, now) {
  const s = Math.max(0, Math.floor((at - now) / 1000))
  return [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60]
}
