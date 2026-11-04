-- Pools rotate by themselves, every minute (Phase 1, week 1).
--
-- Replaces the in-process scheduler (backend/utils/poolScheduler.js) and the
-- POST /internal/sweep-slots route, which needed a Vercel cron job (daily at
-- best on the free plan). pg_cron runs inside the database instead.
--
-- private.rotate_pools() does what the sweep did: for every store, close an
-- expired pool (locking fees) and open the next one. One failing store never
-- stops the others.
--
-- The schedule is created only where the pg_cron extension is available
-- (Supabase: yes; plain Postgres in CI: no). Without it, pools still rotate
-- whenever someone reads them (api_current_slot, api_vendor_overview).

create or replace function private.rotate_pools()
 returns integer
 language plpgsql
 set search_path = public, pg_temp
as $function$
declare
  v_hostel uuid;
  v_ok integer := 0;
begin
  for v_hostel in select hostel_id from vendors loop
    begin
      perform ensure_open_slot(v_hostel);
      v_ok := v_ok + 1;
    exception when others then
      raise warning 'rotate_pools: hostel % failed: %', v_hostel, sqlerrm;
    end;
  end loop;
  return v_ok;
end;
$function$;

revoke all on function private.rotate_pools() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    -- A named job is replaced if it already exists, so re-running is safe.
    perform cron.schedule('poolit-rotate-pools', '* * * * *', 'select private.rotate_pools()');
  else
    raise notice 'pg_cron is not available here; pools rotate on read only';
  end if;
end $$;
