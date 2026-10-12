# Sepatah

Malaysian wedding platform: invitation + RSVP, video wishes, QR guestbook, photo booth, couple galleries. Vue 3 + Vite + Supabase. Brief: [SEPATAH.md](SEPATAH.md).

## Setup (once)
1. Create a Supabase project (region **Singapore**).
2. SQL editor: run each file in [supabase/migrations/](supabase/migrations/) in name order, then each file in [supabase/tests/](supabase/tests/). They must print `window ok`, `gallery ok` and `expiry ok`, and change nothing.
3. Edge Functions. Neither checks a JWT: `gallery` is authed by the gallery token, `expire` by `CRON_SECRET`.
   ```
   npx supabase secrets set --project-ref <ref> CRON_SECRET=<long random> RESEND_API_KEY=re_... MAIL_FROM="Sepatah <galeri@your-domain>" SITE_URL=https://your-site
   npx supabase functions deploy gallery --no-verify-jwt --project-ref <ref>
   npx supabase functions deploy expire --no-verify-jwt --project-ref <ref>
   ```
   Then give the hourly cron job (set up by the expiry migration) its URL and the same secret, in the SQL editor:
   ```sql
   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
   select vault.create_secret('<same long random>', 'cron_secret');
   ```
   `MAIL_FROM` must be on a domain verified in Resend (until then `onboarding@resend.dev` only delivers to the Resend account's own email).
   Check a run by hand: `curl -X POST https://<ref>.supabase.co/functions/v1/expire -H "x-cron-secret: <secret>"`. Past runs: `select * from net._http_response order by created desc limit 5;`
4. Authentication â†’ Users â†’ **Add user** (Mato's email + password). Copy the user id, then in the SQL editor:
   ```sql
   insert into admin_users values ('<user id>');
   ```
5. Copy `.env.example` to `.env` and fill in the URL + anon (publishable) key.

## Run
```
npm install
npm run dev        # http://localhost:5173, use --host to open on a phone on the same Wi-Fi (camera still needs HTTPS)
npm run check      # invitation helpers (calendar file, phone links, countdown), prints "invite ok"
npm run build      # dist/, deploy to Netlify (public/_redirects handles SPA routes)
```
On Netlify set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables before building.

## Routes
| Path | Who | What |
|---|---|---|
| `/:slug` | guests | invitation, RSVP, pre-event video wish (until the QR window opens) |
| `/:slug/tetamu` | guests (QR) | video wish + photo, during the event window |
| `/g/:token` | couple (secret link) | three galleries (early wishes, guestbook, photos), download, share |
| `/admin` | Mato | login, events |
| `/admin/e/:id` | Mato | create / edit event (`new` for a new one) |

## How uploads are protected
Guests can't read anything except the `public_events` view. An upload is three calls:
`start_upload` (RPC checks published, window, type, duration, per-device rate limit, then reserves a row) â†’
file POST to the private `media` bucket (a storage policy allows only a freshly reserved path whose window is still open) â†’
`finish_upload` (RPC confirms the file exists, then makes the row visible).

## Gallery expiry
`expires_at` defaults to QR close + 3 days (editable per event). Every hour `expire` emails the couple (in the event's language) once their gallery is within 24 h of deletion, then, once `expires_at` passes, deletes the files through the Storage API, deletes the event's `assets` folder (music, frames), deletes the wish/photo rows and sets `expired_at`. RSVPs are kept. Moving `expires_at` later re-arms the reminder.
