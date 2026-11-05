-- Pool rotation: what the every-minute job (public.sweep_expired_slots, scheduled by migration 20261102075045) must do.

do $$
declare
  h uuid; v uuid; i uuid; u uuid; s1 uuid; s2 uuid; n integer;
begin
  insert into hostels (name) values ('Rotation Hostel') returning id into h;
  insert into vendors (name, hostel_id, pool_window_minutes) values ('Rot Store', h, 5) returning id into v;
  insert into menu_items (vendor_id, name, category, price, unit, stock_qty) values (v, 'Item', 'Snacks', 10, 'u', 100) returning id into i;
  insert into auth.users (email) values ('rot@example.com') returning id into u;

  -- 1. First run opens a pool.
  perform public.sweep_expired_slots();
  select id into s1 from slots where hostel_id = h and status = 'open';
  if s1 is null then raise exception 'FAILED: no pool was opened'; end if;

  -- 2. An expired pool with nobody in it just restarts its timer (no new row).
  update slots set closes_at = now() - interval '1 minute' where id = s1;
  perform public.sweep_expired_slots();
  select count(*) into n from slots where hostel_id = h;
  if n <> 1 then raise exception 'FAILED: an empty expired pool must not create extra rows (%)', n; end if;
  if not exists (select 1 from slots where id = s1 and status = 'open' and closes_at > now()) then
    raise exception 'FAILED: the empty pool''s timer should have restarted';
  end if;

  -- 3. An expired pool with orders is closed, fees locked, and a fresh pool opens.
  perform place_order(s1, 'A', null, null, 0, 'COD', null, jsonb_build_array(jsonb_build_object('menuItemId', i, 'qty', 1)), u);
  perform place_order(s1, 'B', null, null, 0, 'COD', null, jsonb_build_array(jsonb_build_object('menuItemId', i, 'qty', 1)), u);
  update slots set closes_at = now() - interval '1 minute' where id = s1;
  perform public.sweep_expired_slots();
  if not exists (select 1 from slots where id = s1 and status = 'closed') then raise exception 'FAILED: expired pool with orders should be closed'; end if;
  if (select count(*) from orders where slot_id = s1 and status = 'pooled' and delivery_fee_charged = 20) <> 2 then
    raise exception 'FAILED: fees should be locked at the 2-order price';
  end if;
  select id into s2 from slots where hostel_id = h and status = 'open';
  if s2 is null or s2 = s1 then raise exception 'FAILED: a new pool should have opened'; end if;

  -- 4. Running again changes nothing (the new pool is still open).
  perform public.sweep_expired_slots();
  if (select count(*) from slots where hostel_id = h) <> 2 then raise exception 'FAILED: rotation must be idempotent'; end if;

  -- 5. A paused store opens no pool.
  update vendors set accepting_orders = false where id = v;
  update slots set closes_at = now() - interval '1 minute' where id = s2;
  perform public.sweep_expired_slots();
  if exists (select 1 from slots where hostel_id = h and status = 'open') then raise exception 'FAILED: paused store must not have an open pool'; end if;

  -- 6. Back to accepting orders: a pool opens again.
  update vendors set accepting_orders = true where id = v;
  perform public.sweep_expired_slots();
  if not exists (select 1 from slots where hostel_id = h and status = 'open') then raise exception 'FAILED: a pool should open once the store accepts orders again'; end if;

  -- 7. The job is not callable from the API.
  if has_function_privilege('anon', 'public.sweep_expired_slots()', 'execute') or has_function_privilege('authenticated', 'public.sweep_expired_slots()', 'execute') then
    raise exception 'FAILED: sweep_expired_slots must not be callable by API roles';
  end if;
end $$;
