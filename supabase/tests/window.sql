-- Runnable check for the upload window and expiry default. Paste into the SQL editor; changes are rolled back.
-- Prints "window ok" on success, raises an assertion error otherwise.
begin;
do $$
declare
  s timestamptz := '2026-12-01 10:00+08';
  e timestamptz := '2026-12-01 16:00+08';
  ev events;
begin
  assert upload_open('event', s, e, s), 'event: opens at window_start';
  assert upload_open('event', s, e, s + interval '1 hour'), 'event: open inside';
  assert upload_open('event', s, e, e), 'event: open at window_end';
  assert not upload_open('event', s, e, s - interval '1 second'), 'event: closed before';
  assert not upload_open('event', s, e, e + interval '1 second'), 'event: closed after';
  assert upload_open('pre', s, e, s - interval '30 days'), 'pre: open before event';
  assert not upload_open('pre', s, e, s), 'pre: closed once event window starts';
  assert not upload_open('bogus', s, e, s), 'unknown source closed';

  insert into events (slug, bride, groom, event_date, window_start, window_end)
  values ('zz-window-test', 'A', 'B', '2026-12-01', s, e) returning * into ev;
  assert ev.expires_at = e + interval '3 days', 'expires_at defaults to window_end + 3 days';
  update events set window_end = e + interval '2 hours' where id = ev.id returning * into ev;
  assert ev.expires_at = e + interval '3 days 2 hours', 'moving window_end shifts expires_at';

  raise notice 'window ok';
end $$;
rollback;
