# Sepatah: implementation brief

Hand this file to Claude Code as the starting context. Work in order, stop at each gate, and keep the code minimal.

## 1. What we're building

Sepatah is a custom Malaysian wedding platform, freelance work for Mato, built from scratch on **Vue 3 + Vite + Supabase**. One codebase, one Supabase project, many weddings.

Parts:
1. **Invitation site**: "Buka Undangan" cover, couple, event details, countdown, Maps/Waze links, add to calendar, RSVP form. Style reference: https://hanimarif.netlify.app/
2. **Pre-event video wish**: guest records up to 30 s while RSVPing.
3. **QR video guestbook**: one QR per event, printed for every table, **active only during the event window**. Optional name, 30 s max, upload with progress and retry.
4. **Disposable photo booth**: in-browser camera, pick a frame, composite, save.
5. **Live screen**: full-screen slideshow of **approved** photos (Supabase Realtime).
6. **Moderation**: approve or hide photos, hide or delete videos. Works on phone and laptop.
7. **Couple galleries**: three separate galleries (pre-event wishes, event guestbook videos, photos) behind a secret link. Download single or all, share link.
8. **Admin (Mato only)**: create event, set window, upload frames, view RSVPs, generate print-ready QR table card, extend or delete galleries.

Decisions already made (don't reopen):
- One public invitation link per wedding. No per-guest links. Guest name is typed and optional.
- BM and EN, **Malay is the default**.
- Scale: about 500 guests, about 100 videos per wedding.
- Galleries are deleted **3 days after the event ends** (period may change, keep it a column). Couple gets an **email** reminder before (email only, no WhatsApp).
- Photos need **approval** before reaching the live screen.
- Frames: a few reusable ones, plus a placeholder template (transparent PNG, 1080x1350, 4:5, marked safe area) for couples who bring their own design.
- PDPA: consent line on the forms and a short privacy notice.

## 2. What already exists

`sepatah-prototype/` (Vue 3 + Vite, no router, no store). Guest flow only, runs in demo mode without Supabase keys.

- `src/lib.js`: `mode` (`supabase` | `local`), `pickMime()`, `upload()` (XHR for progress, `POST /storage/v1/object/{bucket}/{path}`), IndexedDB demo store.
- `src/App.vue`: single-file screens `landing | video | review | done | photo | gallery`, BM/EN dictionary `S`, 30 s MediaRecorder with hard stop, native-camera fallback (`<input type=file capture>`), canvas photo compositing at 3x with three polaroid frames, test-info panel (format, size, bitrate, UA).
- Verified in headless Chromium with a fake camera: record, review, send, framed photo, gallery. **Not yet tested on a real iPhone or Android.**
- Not built: invitation, RSVP, event window, auth, admin, database, moderation, couple gallery, live screen, expiry, email.

Recording details to keep:
- Pick the first supported of `video/mp4;codecs=avc1.42E01E,mp4a.40.2`, `video/mp4`, `video/webm;codecs=vp9,opus`, `video/webm;codecs=vp8,opus`, `video/webm`. iOS Safari gives MP4, Chrome/Android gives WebM.
- `videoBitsPerSecond: 2_500_000` (about 10 MB per 30 s).
- Camera needs HTTPS or localhost. In-app browsers (Instagram, WhatsApp) may block it; the file-input fallback covers that. Fallback files can be much larger, so enforce a size limit on the server.
- Stop all tracks when leaving a camera screen.

## 3. Design tokens

Redesigned 2026-10-05, then twice on 2026-10-12. The last pass built the UI from the logo's arch and brand fonts and kept the original palette. Source of truth is the `:root` block in `src/style.css`.

| Token | Value |
|---|---|
| Paper / card | `#F2EDE3` / `#FBF8F2`; the page has a handmade-paper texture (watercolour mottle + grain). The envelope cover has flower bouquets (`public/sprig.svg`) on two corners. |
| Ink / muted | `#1C221E` / `#5C635D` |
| Deep green (envelope, hero arch, camera screens, selected states, focus) | `#1F3A2D`, `#2A4C3B`, `#142A1F` |
| Accent, main action + wax seal | `#C4472D` (hover `#A93A23`) |
| Error | `#A3291B` |

- Fonts (all from the logo handoff except the UI face): Gloock for couple names only, Young Serif for the wordmark, headings and countdown digits, Figtree 400–700 for UI. Scale 14/16/18/22/28/36, with names at 52–72.
- Signature: the logo's arch. The invitation and guestbook heroes are a deep-green arch with the names in paper colour, status badges are small arch outlines, and `.orn` is a tiny arch divider. Sections after the hero are left-aligned on plain paper. RSVP sits on a card.
- Controls: 12 px radius, 52 px tall (46 in admin), 1.5 px borders, deep-green focus ring. Cards have a 20 px radius.
- Cover is a sealed envelope: tap → seal pops, flap opens in 3D, card slides out, then the invitation (about 1.6 s, instant with reduced motion).
- Motion: envelope, then the arch draws up and the names ink in. Countdown digits roll. No ticker and no per-section scroll reveals. Press `scale(.98)`. Respect `prefers-reduced-motion`.
- Polaroid frames: 326 wide, padding 14 or 22, camera area 320 high, caption area 84 high.
- Sample couple "Aina & Hakim", placeholders like `[Tarikh majlis]`. Replace with `events` data.

Mato's standing rules for every UI build (apply them):
- One accent color, used for the main action only. No purple-to-pink gradients, no glass cards.
- No emoji as icons. One icon set, same line weight everywhere.
- One big element per screen, the rest quiet.
- Design loading (skeletons), empty and error states, not only the happy path.
- Small staggered motion, 150 to 300 ms, never flashy.

## 4. Data model (Supabase Postgres)

```sql
create table events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  bride text not null, groom text not null,
  event_date date not null,
  window_start timestamptz not null,   -- QR active from
  window_end   timestamptz not null,   -- QR active until
  default_lang text not null default 'ms',
  theme jsonb not null default '{}',
  gallery_token text unique not null default encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz,              -- default window_end + 3 days, editable
  created_at timestamptz default now()
);
create table rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events on delete cascade,
  name text not null, attending boolean not null, guests int default 1,
  created_at timestamptz default now()      -- final fields still to confirm
);
create table wishes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events on delete cascade,
  source text check (source in ('pre','event')) not null,
  guest_name text, path text not null, duration real,
  status text not null default 'visible' check (status in ('pending','visible','hidden')),
  created_at timestamptz default now()
);
create table photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events on delete cascade,
  guest_name text, frame_id uuid, path text not null,
  status text not null default 'pending' check (status in ('pending','approved','hidden')),
  created_at timestamptz default now()
);
create table frames (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events,          -- null = reusable
  overlay_path text not null, safe_area jsonb not null
);
create table admin_users (user_id uuid primary key references auth.users);
```

Storage: one **private** bucket, one folder per event, paths `{event_id}/wishes/{id}.{ext}` and `{event_id}/photos/{id}.{ext}`.

Security rules:
- Guests (anon) can **insert only**. They can never list or read storage objects or rows (except what the invitation and RSVP pages need from `events`, through a view that exposes public fields only).
- **Check the event window on every upload**, not only on page load. Do it in the Storage insert policy: allow when the folder's event has `now() between window_start and window_end` for `event` uploads, and `now() < window_start` (or the invitation is published) for `pre` wishes. Add size and duration limits and a per-device rate limit (Edge Function if the policy can't express it).
- Writing the `wishes` and `photos` rows should go through an RPC or Edge Function that validates the same window and rate limit, so a guest can't create rows for files they didn't upload.
- Couples open galleries by `gallery_token` (long random), no account. Playback and download use **short-lived signed URLs**, created server-side after validating the token and `expires_at`.
- Admin uses Supabase Auth plus `admin_users`. RLS on everything.
- Live screen subscribes to Realtime on `photos where status = 'approved'`.
- Expiry: scheduled job (pg_cron + Edge Function) deletes files through the **Storage API** (not SQL) once `expires_at` passes, then marks the event expired. The reminder email goes out before that (timing still open). Use a transactional email provider (Resend or similar).

## 5. Build order (stop at each gate)

1. **Risk prototype.** Run the existing prototype on a real iPhone (Safari) and Android (Chrome). Gate: records, uploads and plays back on both, and the playback/download format question is settled. Mato will paste the test-info output from each phone. Don't start step 2 until this is answered. If MP4 and WebM both play in the browsers couples will use, keep both as is. If not, decide on server-side conversion.
2. **Foundations.** Supabase project, schema, RLS, storage bucket, admin auth, admin shell, multi-event routing (`/:slug`). Add `vue-router` and `@supabase/supabase-js` only now.
3. **Invitation and RSVP.** Cover, details, countdown, map links, calendar file, RSVP form, pre-event wish, BM/EN.
4. **Video guestbook.** QR landing with event-window check and closed state, upload with retry and resume, video moderation.
5. **Galleries.** Three couple galleries, downloads (per file first; zip streaming only if it's really needed), expiry job, reminder email, expired-gallery screen.
6. **Disposable photo.** Frames and placeholder template, approval flow, live screen.
7. **QR card and admin polish.** Print-ready table card PDF, extend and delete controls.
8. **Testing and pilot.** Weak-signal real-device tests, then one real wedding.

Per step: keep the code minimal, add one runnable check for any non-trivial logic (window check, expiry, signed URL), and test on a real phone before moving on.

## 6. Known design gaps to fill as you build

- Personalised "[Nama tetamu]" greeting conflicts with the single public link. Decision: use the typed name only, no personalised links.
- The "Done" screen always says the wish was sent; it needs separate wording for photo and for pre-event wish, and a return path from the pre-event wish back to the RSVP.
- The video fallback link currently goes to Photo; it should open the native camera for video.
- Missing states: video upload failure and resume, QR window closed (before and after), gallery expired.
- Missing screens: gallery lightbox, video moderation, phone gallery layout, admin event form, QR card print view.

## 7. Open items (don't block on these)

- Final RSVP fields (name, attending, guests assumed; phone and message undecided).
- Exact timing of the expiry reminder email. Expiry period: 3 days for now.
- Hosting for the Vue app (Netlify, Vercel or Cloudflare free tier). Vercel project creation failed with the connected account, so Netlify drag-and-drop was the fallback.
- Frame template with a safe area (Figma or Canva) for couples' own designs.
- Supabase Pro at about $25/month for production. Free tier only for development (1 GB, 50 MB file limit, pauses after a week).
- Name check for "Sepatah" at MyIPO and domain lookup.
- Pricing worksheet: needs build hours per wedding, QR card printing cost, optional domain.

Full plan with cost breakdown: the Claude Docs file "Sepatah: Project Plan".
