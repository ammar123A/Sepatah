-- Couple gallery wears the wedding's design: same function as 20261012000000_gallery.sql, plus 'theme'.
create or replace function gallery(p_token text) returns json language plpgsql stable security definer set search_path = public as $$
declare e events;
begin
  select * into e from events where gallery_token = p_token;
  if not found then raise exception 'not_found'; end if;
  if e.expired_at is not null or e.expires_at <= now() then raise exception 'expired'; end if;
  return json_build_object(
    'bride', e.bride, 'groom', e.groom, 'event_date', e.event_date, 'expires_at', e.expires_at, 'default_lang', e.default_lang, 'theme', e.theme,
    'wishes', coalesce((select json_agg(json_build_object('id', id, 'source', source, 'guest_name', guest_name, 'duration', duration, 'created_at', created_at, 'path', path) order by created_at)
                        from wishes where event_id = e.id and status = 'visible'), '[]'),
    'photos', coalesce((select json_agg(json_build_object('id', id, 'guest_name', guest_name, 'created_at', created_at, 'path', path) order by created_at)
                        from photos where event_id = e.id and status in ('pending', 'approved')), '[]'));
end $$;

-- create or replace keeps grants, but restate them so this file is safe to run on its own
revoke execute on function gallery from public, anon, authenticated;
grant execute on function gallery to service_role;
