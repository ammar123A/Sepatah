-- Runnable check for the couple gallery. Paste into the SQL editor; changes are rolled back.
-- Prints "gallery ok" on success, raises an assertion error otherwise.
begin;
do $$
declare
  ev events;
  g json;
  failed text;
begin
  insert into events (slug, bride, groom, event_date, window_start, window_end)
  values ('zz-gallery-test', 'A', 'B', '2026-12-01', now() - interval '2 days', now() - interval '1 day') returning * into ev;
  insert into wishes (event_id, source, path, status) values
    (ev.id, 'pre', 'zz/w1.mp4', 'visible'), (ev.id, 'event', 'zz/w2.webm', 'hidden'), (ev.id, 'event', 'zz/w3.webm', 'uploading');
  insert into photos (event_id, path, status) values
    (ev.id, 'zz/p1.jpg', 'pending'), (ev.id, 'zz/p2.jpg', 'approved'), (ev.id, 'zz/p3.jpg', 'hidden'), (ev.id, 'zz/p4.jpg', 'uploading');

  g := gallery(ev.gallery_token);
  assert json_array_length(g->'wishes') = 1, 'only visible wishes';
  assert json_array_length(g->'photos') = 2, 'pending + approved photos, not hidden or uploading';
  assert g->>'bride' = 'A', 'event fields returned';

  begin perform gallery('nope'); failed := 'none'; exception when others then failed := sqlerrm; end;
  assert failed = 'not_found', 'bad token: not_found';

  update events set expires_at = now() - interval '1 minute' where id = ev.id;
  begin perform gallery(ev.gallery_token); failed := 'none'; exception when others then failed := sqlerrm; end;
  assert failed = 'expired', 'past expires_at: expired';

  update events set expires_at = now() + interval '1 day', expired_at = now() where id = ev.id;
  begin perform gallery(ev.gallery_token); failed := 'none'; exception when others then failed := sqlerrm; end;
  assert failed = 'expired', 'expired_at set: expired';

  assert not has_function_privilege('anon', 'gallery(text)', 'execute'), 'anon cannot call gallery';
  raise notice 'gallery ok';
end $$;
rollback;
