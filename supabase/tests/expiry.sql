-- Runnable check for which galleries get a reminder or get deleted. Paste into the SQL editor; changes are rolled back.
-- Prints "expiry ok" on success, raises an assertion error otherwise.
begin;
do $$
declare
  t0 timestamptz := '2026-12-05 12:00+08';
  ev events;
  due uuid[];
  ins events;
begin
  insert into events (slug, bride, groom, event_date, window_start, window_end, published, couple_email, expires_at)
  values ('zz-exp-soon', 'A', 'B', '2026-12-01', t0 - interval '5 days', t0 - interval '4 days', true, 'a@b.my', t0 + interval '12 hours')
  returning * into ev;

  select array_agg(id) into due from reminder_due(t0);
  assert ev.id = any(due), 'deleted within 24 h: reminder due';
  assert not ev.id = any(coalesce((select array_agg(id) from reminder_due(t0 - interval '1 day')), '{}')), 'more than 24 h out: no reminder yet';
  assert not ev.id = any(coalesce((select array_agg(id) from expiry_due(t0)), '{}')), 'not past expires_at: not deleted';

  update events set reminded_at = t0 where id = ev.id;
  assert not ev.id = any(coalesce((select array_agg(id) from reminder_due(t0)), '{}')), 'reminded once only';

  update events set expires_at = t0 + interval '20 hours' where id = ev.id returning * into ev;
  assert ev.reminded_at is null, 'moving expires_at resets the reminder';

  assert ev.id = any((select array_agg(id) from expiry_due(t0 + interval '20 hours'))), 'at expires_at: deleted';
  update events set expired_at = t0 where id = ev.id;
  assert not ev.id = any(coalesce((select array_agg(id) from expiry_due(t0 + interval '1 day')), '{}')), 'already expired: not deleted again';

  insert into events (slug, bride, groom, event_date, window_start, window_end, published, expires_at)
  values ('zz-exp-nomail', 'A', 'B', '2026-12-01', t0 - interval '5 days', t0 - interval '4 days', true, t0 + interval '1 hour') returning * into ins;
  assert not ins.id = any(coalesce((select array_agg(id) from reminder_due(t0)), '{}')), 'no couple email: no reminder';

  assert not has_function_privilege('anon', 'expiry_due(timestamptz)', 'execute'), 'anon cannot call expiry_due';
  raise notice 'expiry ok';
end $$;
rollback;
