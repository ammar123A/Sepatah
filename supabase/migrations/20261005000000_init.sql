-- Sepatah schema. Run once in the Supabase SQL editor (or `supabase db push`).

create table events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{2,60}$' and slug not in ('admin', 'g')),
  bride text not null, groom text not null,
  event_date date not null,
  starts_at timestamptz, ends_at timestamptz,          -- majlis time, shown on the invitation
  venue text, address text,
  window_start timestamptz not null,                   -- QR guestbook open from
  window_end timestamptz not null check (window_end > window_start),
  default_lang text not null default 'ms' check (default_lang in ('ms', 'en')),
  published boolean not null default false,            -- drafts are invisible and accept nothing
  content jsonb not null default '{}',                 -- hosts, aturcara[{time,item}], contacts[{name,phone}], music_path
  theme jsonb not null default '{}',
  couple_email text,
  gallery_token text unique not null default encode(extensions.gen_random_bytes(24), 'hex'),
  expires_at timestamptz,                              -- default window_end + 3 days, editable
  reminded_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz not null default now()
);

create table rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  name text not null check (length(name) between 1 and 80),
  attending boolean not null,
  guests int not null default 1 check (guests between 0 and 20),
  created_at timestamptz not null default now()
);

create table frames (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events on delete cascade,   -- null = reusable
  name text,
  overlay_path text not null,
  safe_area jsonb not null default '{"x":0,"y":0,"w":1080,"h":1350}',
  created_at timestamptz not null default now()
);

create table wishes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  source text not null check (source in ('pre', 'event')),
  guest_name text, path text not null unique, duration real,
  device text,
  status text not null default 'uploading' check (status in ('uploading', 'visible', 'hidden')),
  created_at timestamptz not null default now()
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  guest_name text, frame_id uuid references frames on delete set null, path text not null unique,
  device text,
  status text not null default 'uploading' check (status in ('uploading', 'pending', 'approved', 'hidden')),
  created_at timestamptz not null default now()
);
create index on wishes (event_id, status);
create index on wishes (device, created_at);
create index on photos (event_id, status);
create index on photos (device, created_at);

create table admin_users (user_id uuid primary key references auth.users on delete cascade);

-- expires_at defaults to window_end + 3 days; moving window_end shifts it by the same amount (keeps extensions)
create function set_expires_at() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.expires_at := coalesce(new.expires_at, new.window_end + interval '3 days');
  elsif new.window_end <> old.window_end and new.expires_at is not distinct from old.expires_at then
    new.expires_at := new.expires_at + (new.window_end - old.window_end);
  end if;
  return new;
end $$;
create trigger events_expires before insert or update on events for each row execute function set_expires_at();

-- ---------- access ----------
create function is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid())
$$;

alter table events enable row level security;
alter table rsvps enable row level security;
alter table frames enable row level security;
alter table wishes enable row level security;
alter table photos enable row level security;
alter table admin_users enable row level security;

create policy admin_all on events for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on rsvps for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on frames for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on wishes for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on photos for all to authenticated using (is_admin()) with check (is_admin());

-- explicit grants, so it works whether or not the project auto-exposes new tables
revoke all on events, rsvps, frames, wishes, photos, admin_users from anon;
grant select, insert, update, delete on events, rsvps, frames, wishes, photos to authenticated;

-- Guests read public fields only, and only for published, unexpired events
create view public_events as
  select slug, bride, groom, event_date, starts_at, ends_at, venue, address,
         window_start, window_end, default_lang, content, theme
  from events where published and expired_at is null;
revoke all on public_events from anon, authenticated;
grant select on public_events to anon, authenticated;

-- ---------- uploads ----------
-- The one window rule. 'event' = QR guestbook and photos, 'pre' = wish sent with the invitation.
create function upload_open(src text, w_start timestamptz, w_end timestamptz, at timestamptz default now())
returns boolean language sql immutable as $$
  select case src
    when 'event' then at between w_start and w_end
    when 'pre' then at < w_start
    else false end
$$;

-- Step 1 of an upload: validate, reserve a row, hand back the storage path.
create function start_upload(p_slug text, p_kind text, p_source text, p_ext text, p_name text, p_device text, p_duration real default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  e events;
  v_id uuid := gen_random_uuid();
  v_path text;
  v_recent int;
begin
  select * into e from events where slug = p_slug and published and expired_at is null;
  if not found then raise exception 'not_found'; end if;
  if p_kind = 'photo' then p_source := 'event'; end if;
  if p_kind not in ('video', 'photo') or p_source not in ('pre', 'event') then raise exception 'bad_request'; end if;
  if not upload_open(p_source, e.window_start, e.window_end) then raise exception 'closed'; end if;
  if (p_kind = 'video' and p_ext not in ('mp4', 'webm', 'mov')) or (p_kind = 'photo' and p_ext <> 'jpg') then raise exception 'bad_type'; end if;
  -- ponytail: duration is client-reported; the 50 MB bucket limit is the real guard
  if coalesce(p_duration, 0) > 31 then raise exception 'too_long'; end if;
  if length(coalesce(p_device, '')) not between 8 and 64 then raise exception 'bad_request'; end if;

  -- ponytail: device id lives in localStorage, so clearing it resets the limit; add IP limiting via Edge Function if abused
  select (select count(*) from wishes where device = p_device and created_at > now() - interval '1 hour')
       + (select count(*) from photos where device = p_device and created_at > now() - interval '1 hour')
    into v_recent;
  if v_recent >= 20 then raise exception 'rate_limited'; end if;

  v_path := e.id || '/' || (case p_kind when 'video' then 'wishes' else 'photos' end) || '/' || v_id || '.' || p_ext;
  if p_kind = 'video' then
    insert into wishes (id, event_id, source, guest_name, path, duration, device)
    values (v_id, e.id, p_source, nullif(left(trim(p_name), 60), ''), v_path, p_duration, p_device);
  else
    insert into photos (id, event_id, guest_name, path, device)
    values (v_id, e.id, nullif(left(trim(p_name), 60), ''), v_path, p_device);
  end if;
  return json_build_object('id', v_id, 'path', v_path);
end $$;

-- Storage insert policy helper: the path must be a fresh reserved slot whose window is still open.
create function upload_slot_ok(p_path text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from (select event_id, source, path, created_at from wishes where status = 'uploading'
          union all
          select event_id, 'event', path, created_at from photos where status = 'uploading') r
    join events e on e.id = r.event_id
    where r.path = p_path
      and r.created_at > now() - interval '30 minutes'
      and e.published and e.expired_at is null
      and upload_open(r.source, e.window_start, e.window_end))
$$;

-- Step 3 of an upload: the file is in storage, make the row live.
create function finish_upload(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update wishes w set status = 'visible'
  where w.id = p_id and w.status = 'uploading'
    and exists (select 1 from storage.objects o where o.bucket_id = 'media' and o.name = w.path);
  if found then return; end if;
  update photos p set status = 'pending'
  where p.id = p_id and p.status = 'uploading'
    and exists (select 1 from storage.objects o where o.bucket_id = 'media' and o.name = p.path);
  if not found then raise exception 'not_found'; end if;
end $$;

-- RSVP goes through an RPC so guests never touch the events table.
-- ponytail: no RSVP rate limit; add the device check from start_upload if spam shows up
create function submit_rsvp(p_slug text, p_name text, p_attending boolean, p_guests int default 1)
returns void language plpgsql security definer set search_path = public as $$
declare v_event uuid;
begin
  select id into v_event from events where slug = p_slug and published and expired_at is null;
  if not found then raise exception 'not_found'; end if;
  insert into rsvps (event_id, name, attending, guests)
  values (v_event, trim(p_name), p_attending, case when p_attending then p_guests else 0 end);
end $$;

revoke execute on function upload_open, start_upload, upload_slot_ok, finish_upload, submit_rsvp, is_admin from public;
grant execute on function start_upload, upload_slot_ok, finish_upload, submit_rsvp to anon, authenticated;
grant execute on function upload_open, is_admin to authenticated;

-- ---------- storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media', 'media', false, 52428800, array['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg']),
  ('assets', 'assets', true, 10485760, array['image/png', 'image/jpeg', 'audio/mpeg'])
on conflict (id) do nothing;

create policy guest_upload on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'media' and public.upload_slot_ok(name));
create policy admin_all on storage.objects for all to authenticated
  using (bucket_id in ('media', 'assets') and public.is_admin())
  with check (bucket_id in ('media', 'assets') and public.is_admin());

-- live screen (step 6)
alter publication supabase_realtime add table photos;
