-- Automatic pool rotation (Phase 1).
--
-- Until now only the seed script ever created slots, so once a hostel's pool
-- closed no new one opened and students could not order. ensure_open_slot()
-- is called whenever a hostel's current pool is read (and by the sweep), and:
--   * returns the open pool if its timer is still running;
--   * an expired pool WITH orders is closed (fees locked) and a new one opens;
--   * an expired pool with NO orders just restarts its timer (no empty rows);
--   * while the store is paused (accepting_orders = false) nothing opens.
-- A per-hostel advisory lock plus a partial unique index guarantee at most
-- one open pool per hostel even under concurrent requests.

alter table public.vendors
  add column if not exists pool_window_minutes integer not null default 10
  check (pool_window_minutes between 3 and 60);

create unique index if not exists slots_one_open_per_hostel
  on public.slots (hostel_id) where status = 'open';

create or replace function public.ensure_open_slot(p_hostel_id uuid)
 returns slots
 language plpgsql
 set search_path = public, pg_temp
as $function$
declare
  v_vendor vendors;
  v_slot slots;
  v_has_orders boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('ensure_open_slot:' || p_hostel_id::text, 0));

  select * into v_vendor from vendors where hostel_id = p_hostel_id;
  if not found then
    raise exception 'VENDOR_NOT_FOUND';
  end if;

  select * into v_slot from slots
    where hostel_id = p_hostel_id and status = 'open'
    order by opens_at desc limit 1
    for update;

  if found then
    if v_slot.closes_at > now() then
      return v_slot;
    end if;

    select exists(select 1 from orders where slot_id = v_slot.id and status = 'placed') into v_has_orders;

    if not v_has_orders and v_vendor.accepting_orders then
      -- Nobody joined: keep the same pool and restart its timer.
      update slots
        set opens_at = now(),
            closes_at = now() + make_interval(mins => v_vendor.pool_window_minutes),
            updated_at = now()
        where id = v_slot.id
        returning * into v_slot;
      return v_slot;
    end if;

    perform close_slot(v_slot.id);
  end if;

  if not v_vendor.accepting_orders then
    -- Paused store: report its most recent pool, open nothing.
    select * into v_slot from slots where hostel_id = p_hostel_id order by opens_at desc limit 1;
    return v_slot;
  end if;

  insert into slots (hostel_id, vendor_id, status, opens_at, closes_at)
  values (p_hostel_id, v_vendor.id, 'open', now(), now() + make_interval(mins => v_vendor.pool_window_minutes))
  returning * into v_slot;
  return v_slot;
end;
$function$;

revoke execute on function public.ensure_open_slot(uuid) from public, anon, authenticated;
grant execute on function public.ensure_open_slot(uuid) to service_role;
