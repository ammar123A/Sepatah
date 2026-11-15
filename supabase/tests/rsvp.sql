-- Runnable check for the per-wedding RSVP switch. Paste into the SQL editor; changes are rolled back.
-- Prints "rsvp ok" on success, raises an assertion error otherwise.
begin;
do $$
declare
  s timestamptz := now() + interval '30 days';
  e timestamptz := now() + interval '30 days 6 hours';
  solo events;
  inv events;
begin
  insert into events (slug, bride, groom, event_date, window_start, window_end, published)
  values ('zz-rsvp-off', 'A', 'B', (s)::date, s, e, true) returning * into solo;
  assert not solo.rsvp, 'new weddings default to guestbook only';

  begin
    perform submit_rsvp('zz-rsvp-off', 'Tetamu', true, 2);
    assert false, 'rsvp off: submit_rsvp should raise';
  exception when raise_exception then
    assert sqlerrm = 'not_found', 'rsvp off: submit_rsvp raised ' || sqlerrm;
  end;

  begin
    perform start_upload('zz-rsvp-off', 'video', 'pre', 'mp4', 'Tetamu', 'device-test-1', 10);
    assert false, 'rsvp off: pre-event wish should raise';
  exception when raise_exception then
    assert sqlerrm = 'closed', 'rsvp off: start_upload raised ' || sqlerrm;
  end;

  insert into events (slug, bride, groom, event_date, window_start, window_end, published, rsvp)
  values ('zz-rsvp-on', 'C', 'D', (s)::date, s, e, true, true) returning * into inv;
  perform submit_rsvp('zz-rsvp-on', 'Tetamu', true, 2);
  assert (select count(*) from rsvps where event_id = inv.id) = 1, 'rsvp on: one reply saved';
  assert (select count(*) from rsvps where event_id = solo.id) = 0, 'rsvp off: nothing saved';
  perform start_upload('zz-rsvp-on', 'video', 'pre', 'mp4', 'Tetamu', 'device-test-1', 10);
  assert (select count(*) from wishes where event_id = inv.id and source = 'pre') = 1, 'rsvp on: pre-event wish reserved';

  assert (select rsvp from public_events where slug = 'zz-rsvp-on'), 'public_events exposes rsvp';

  raise notice 'rsvp ok';
end $$;
rollback;
