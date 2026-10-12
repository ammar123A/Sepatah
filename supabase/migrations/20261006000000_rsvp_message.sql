-- Written wish for the couple, sent with the RSVP. Optional, attending or not.
alter table rsvps add column message text check (length(message) <= 500);

-- New signature, so drop the old one instead of leaving an ambiguous overload
drop function submit_rsvp(text, text, boolean, int);
create function submit_rsvp(p_slug text, p_name text, p_attending boolean, p_guests int default 1, p_message text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_event uuid;
begin
  select id into v_event from events where slug = p_slug and published and expired_at is null;
  if not found then raise exception 'not_found'; end if;
  insert into rsvps (event_id, name, attending, guests, message)
  values (v_event, trim(p_name), p_attending, case when p_attending then p_guests else 0 end, nullif(left(trim(p_message), 500), ''));
end $$;

revoke execute on function submit_rsvp from public;
grant execute on function submit_rsvp to anon, authenticated;
