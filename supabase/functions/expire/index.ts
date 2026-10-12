// Hourly, from pg_cron: email the couple a day before their gallery is deleted, then delete expired galleries.
// Files go through the Storage API: deleting storage.objects rows in SQL would leave the files behind.
// Secrets: CRON_SECRET, RESEND_API_KEY, MAIL_FROM, SITE_URL. Deploy with --no-verify-jwt (CRON_SECRET is the auth).
import { createClient } from 'npm:@supabase/supabase-js@2'

const env = (k: string) => Deno.env.get(k) ?? ''
const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
const ok = ({ error }: { error: unknown }) => { if (error) throw error }

const MAIL = {
  ms: (couple: string, when: string, link: string) => ({
    subject: `Galeri ${couple} akan dipadam pada ${when}`,
    html: `<p>Salam ${esc(couple)},</p><p>Ucapan video dan gambar daripada tetamu anda akan dipadam secara automatik pada <b>${when}</b>. Muat turun apa yang ingin anda simpan sebelum itu:</p><p><a href="${link}">Buka galeri</a></p><p>Selepas tarikh itu, fail tidak dapat dipulihkan.</p><p>Sepatah</p>`,
  }),
  en: (couple: string, when: string, link: string) => ({
    subject: `${couple}: your gallery will be deleted on ${when}`,
    html: `<p>Hi ${esc(couple)},</p><p>The video wishes and photos from your guests will be deleted automatically on <b>${when}</b>. Download anything you want to keep before then:</p><p><a href="${link}">Open the gallery</a></p><p>After that, they can't be recovered.</p><p>Sepatah</p>`,
  }),
}

async function remind(e: any) {
  const lang = e.default_lang === 'en' ? 'en' : 'ms'
  const when = new Date(e.expires_at).toLocaleString(lang === 'ms' ? 'ms-MY' : 'en-MY', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Kuala_Lumpur' })
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env('MAIL_FROM'), to: e.couple_email, ...MAIL[lang](`${e.bride} & ${e.groom}`, when, `${env('SITE_URL')}/g/${e.gallery_token}`) }),
  })
  if (!r.ok) throw new Error(`resend ${r.status} ${await r.text()}`)
  ok(await sb.from('events').update({ reminded_at: new Date().toISOString() }).eq('id', e.id))
}

// Every file has a reserved row (the storage policy only accepts reserved paths), so the rows list all files.
// Rows go only after every file is gone, so a failed run retries the same paths next hour.
async function expire(e: any) {
  const paths: string[] = []
  for (const t of ['wishes', 'photos']) {
    const { data, error } = await sb.from(t).select('path').eq('event_id', e.id)
    if (error) throw error
    paths.push(...data.map((r) => r.path))
  }
  for (let i = 0; i < paths.length; i += 1000) ok(await sb.storage.from('media').remove(paths.slice(i, i + 1000)))
  // the event's public assets folder too: every music upload (replacing a song keeps the old file) and any frames
  const { data: assets, error } = await sb.storage.from('assets').list(e.id, { limit: 1000 })
  if (error) throw error
  if (assets.length) ok(await sb.storage.from('assets').remove(assets.map((a) => `${e.id}/${a.name}`)))
  for (const t of ['wishes', 'photos']) ok(await sb.from(t).delete().eq('event_id', e.id))
  ok(await sb.from('events').update({ expired_at: new Date().toISOString(), content: { ...e.content, music_path: '' } }).eq('id', e.id))
}

Deno.serve(async (req) => {
  if (!env('CRON_SECRET') || req.headers.get('x-cron-secret') !== env('CRON_SECRET')) return new Response('forbidden', { status: 403 })
  const out = { reminded: [] as string[], expired: [] as string[], failed: [] as string[] }
  async function run(rpc: string, fn: (e: any) => Promise<void>, done: string[]) {
    const { data, error } = await sb.rpc(rpc)
    if (error) return out.failed.push(`${rpc}: ${error.message}`)
    for (const e of data) {
      try {
        await fn(e)
        done.push(e.slug)
      } catch (err) {
        out.failed.push(`${e.slug}: ${(err as Error).message}`)
      }
    }
  }
  if (env('RESEND_API_KEY')) await run('reminder_due', remind, out.reminded)
  else out.failed.push('RESEND_API_KEY not set, no reminders sent')
  await run('expiry_due', expire, out.expired)
  console.log(JSON.stringify(out))
  return Response.json(out, { status: out.failed.length ? 500 : 200 })
})
