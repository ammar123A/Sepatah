-- Invitation + RSVP becomes a per-wedding add-on. Off = guestbook only: no invitation, no RSVP, no pre-event wish.
alter table events add column rsvp boolean not null default false;
-- every wedding made before this had an invitation, so links already shared keep working
update events set rsvp = true;

-- new column goes last so create or replace is allowed
create or replace view public_events as
  select slug, bride, groom, event_date, starts_at, ends_at, venue, address,
         window_start, window_end, default_lang, content, theme, rsvp
  from events where published and expired_at is null;
revoke all on public_events from anon, authenticated;
grant select on public_events to anon, authenticated;

-- Same as 20261006000000_rsvp_message.sql, plus "and rsvp"
create or replace function submit_rsvp(p_slug text, p_name text, p_attending boolean, p_guests int default 1, p_message text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_event uuid;
begin
  select id into v_event from events where slug = p_slug and published and rsvp and expired_at is null;
  if not found then raise exception 'not_found'; end if;
  insert into rsvps (event_id, name, attending, guests, message)
  values (v_event, trim(p_name), p_attending, case when p_attending then p_guests else 0 end, nullif(left(trim(p_message), 500), ''));
end $$;

-- Same as 20261005000000_init.sql, plus: pre-event wishes only come from the invitation
create or replace function start_upload(p_slug text, p_kind text, p_source text, p_ext text, p_name text, p_device text, p_duration real default null)
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
  if p_source = 'pre' and not e.rsvp then raise exception 'closed'; end if;
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

-- create or replace keeps grants, but restate them so this file is safe to run on its own
revoke execute on function submit_rsvp, start_upload from public;
grant execute on function submit_rsvp, start_upload to anon, authenticated;
