-- Scheduled jobs (Phase 1): run inside the database with pg_cron so pool
-- rotation does not depend on a Vercel Pro cron or an open browser tab.
--
--  * poolit-sweep-slots   every minute: closes expired pools (locking fees)
--    and opens the next one, for every hostel that has a store.
--  * poolit-purge-idempotency-keys   daily 03:00 UTC: drops keys older than 24 h.

create extension if not exists pg_cron;

create or replace function public.sweep_expired_slots()
 returns int
 language plpgsql
 set search_path = public, pg_temp
as $function$
declare
  v_hostel uuid;
  v_rotated int := 0;
  v_before uuid;
  v_after slots;
begin
  for v_hostel in select distinct hostel_id from vendors loop
    begin
      select id into v_before from slots
        where hostel_id = v_hostel and status = 'open' and closes_at <= now() limit 1;
      v_after := ensure_open_slot(v_hostel);
      if v_before is not null and v_after.id is distinct from v_before then
        v_rotated := v_rotated + 1;
      end if;
    exception when others then
      -- One bad hostel must not stop the others.
      raise warning 'sweep_expired_slots: hostel % failed: %', v_hostel, sqlerrm;
    end;
  end loop;
  return v_rotated;
end;
$function$;

revoke execute on function public.sweep_expired_slots() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname in ('poolit-sweep-slots', 'poolit-purge-idempotency-keys');
select cron.schedule('poolit-sweep-slots', '* * * * *', $$select public.sweep_expired_slots()$$);
select cron.schedule('poolit-purge-idempotency-keys', '0 3 * * *', $$select public.purge_idempotency_keys()$$);
