-- Couple gallery by secret token. Only the `gallery` Edge Function calls this (service role); it signs the paths.
-- Photos: approval gates the live screen, not the couple, so pending photos are included; hidden ones never are.
create function gallery(p_token text) returns json language plpgsql stable security definer set search_path = public as $$
declare e events;
begin
  select * into e from events where gallery_token = p_token;
  if not found then raise exception 'not_found'; end if;
  if e.expired_at is not null or e.expires_at <= now() then raise exception 'expired'; end if;
  return json_build_object(
    'bride', e.bride, 'groom', e.groom, 'event_date', e.event_date, 'expires_at', e.expires_at, 'default_lang', e.default_lang,
    'wishes', coalesce((select json_agg(json_build_object('id', id, 'source', source, 'guest_name', guest_name, 'duration', duration, 'created_at', created_at, 'path', path) order by created_at)
                        from wishes where event_id = e.id and status = 'visible'), '[]'),
    'photos', coalesce((select json_agg(json_build_object('id', id, 'guest_name', guest_name, 'created_at', created_at, 'path', path) order by created_at)
                        from photos where event_id = e.id and status in ('pending', 'approved')), '[]'));
end $$;

-- Supabase grants execute on new functions to anon/authenticated directly, so revoking from public alone isn't enough
revoke execute on function gallery from public, anon, authenticated;
grant execute on function gallery to service_role;
