-- Gallery expiry. The `expire` Edge Function runs hourly (pg_cron below): it emails the couple a day before,
-- then deletes the files through the Storage API, the wish/photo rows, and marks the event expired.

-- ponytail: 24 h reminder lead is fixed; make it a column if couples need more notice
create function reminder_due(p_at timestamptz default now()) returns setof events language sql stable as $$
  select * from events
  where published and couple_email is not null and reminded_at is null and expired_at is null
    and expires_at > p_at and expires_at <= p_at + interval '24 hours'
$$;

create function expiry_due(p_at timestamptz default now()) returns setof events language sql stable as $$
  select * from events where expired_at is null and expires_at <= p_at
$$;

revoke execute on function reminder_due, expiry_due from public, anon, authenticated;
grant execute on function reminder_due, expiry_due to service_role;

-- Same trigger as before, plus: a moved deletion date (an extension) gets a fresh reminder
create or replace function set_expires_at() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.expires_at := coalesce(new.expires_at, new.window_end + interval '3 days');
  else
    if new.window_end <> old.window_end and new.expires_at is not distinct from old.expires_at then
      new.expires_at := new.expires_at + (new.window_end - old.window_end);
    end if;
    if new.expires_at is distinct from old.expires_at then new.reminded_at := null; end if;
  end if;
  return new;
end $$;

-- Hourly run. Reads its URL and secret from Vault at run time, so create both secrets (README) before it's useful.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('sepatah-expire', '7 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/expire',
    headers := jsonb_build_object('x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    timeout_milliseconds := 60000)
$$);
