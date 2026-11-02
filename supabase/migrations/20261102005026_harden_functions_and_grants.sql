-- Security hardening (Phase 1).
--
-- 1. Pin search_path on every function (advisor lint 0011).
-- 2. Validate quantities inside the database too, not only in the API:
--    a negative qty in place_order would otherwise ADD stock.
-- 3. Only the API's service role may execute the functions or touch the
--    tables. Both apps use Supabase for login only; all data goes through
--    the Express API with the service-role key.

create or replace function public.fee_for_order_count(order_count integer)
 returns numeric
 language sql
 immutable
 set search_path = public, pg_temp
as $function$
  select case
    when order_count <= 0 then 20
    when order_count <= 2 then 20
    when order_count <= 5 then 10
    when order_count <= 10 then 5
    else 0
  end;
$function$;

create or replace function public.close_slot(p_slot_id uuid)
 returns jsonb
 language plpgsql
 set search_path = public, pg_temp
as $function$
declare
  v_slot slots;
  v_order_count integer;
  v_fee numeric;
begin
  select * into v_slot from slots where id = p_slot_id for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND';
  end if;

  if v_slot.status <> 'open' then
    return jsonb_build_object('slot', to_jsonb(v_slot), 'alreadyClosed', true);
  end if;

  select count(*) into v_order_count from orders where slot_id = v_slot.id and status = 'placed';
  v_fee := fee_for_order_count(v_order_count);

  update orders
    set delivery_fee_charged = v_fee, status = 'pooled', updated_at = now()
    where slot_id = v_slot.id and status = 'placed';

  update slots set status = 'closed', updated_at = now() where id = v_slot.id
    returning * into v_slot;

  return jsonb_build_object(
    'slot', to_jsonb(v_slot),
    'fee', v_fee,
    'orderCount', v_order_count,
    'alreadyClosed', false
  );
end;
$function$;

create or replace function public.dispatch_slot(p_slot_id uuid)
 returns slots
 language plpgsql
 set search_path = public, pg_temp
as $function$
declare
  v_slot slots;
begin
  select * into v_slot from slots where id = p_slot_id for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND';
  end if;

  if v_slot.status <> 'closed' then
    raise exception 'SLOT_NOT_CLOSED:%', v_slot.status;
  end if;

  update slots set status = 'dispatched', updated_at = now() where id = p_slot_id
    returning * into v_slot;

  update orders set status = 'dispatched', updated_at = now()
    where slot_id = p_slot_id and status = 'pooled';

  return v_slot;
end;
$function$;

create or replace function public.place_order(p_slot_id uuid, p_student_name text, p_block text, p_room text, p_tip numeric, p_payment_method text, p_note text, p_items jsonb)
 returns orders
 language plpgsql
 set search_path = public, pg_temp
as $function$
declare
  v_slot slots;
  v_item jsonb;
  v_menu_item_id uuid;
  v_qty integer;
  v_updated menu_items;
  v_order orders;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'INVALID_ITEMS';
  end if;

  select * into v_slot from slots where id = p_slot_id for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND';
  end if;

  if v_slot.status = 'open' and now() >= v_slot.closes_at then
    perform close_slot(v_slot.id);
    select * into v_slot from slots where id = p_slot_id;
  end if;

  if v_slot.status <> 'open' then
    raise exception 'SLOT_NOT_OPEN:%', v_slot.status;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_menu_item_id := (v_item->>'menuItemId')::uuid;
    v_qty := (v_item->>'qty')::integer;

    -- Without this a negative qty would increase stock.
    if v_qty is null or v_qty < 1 or v_qty > 100 then
      raise exception 'INVALID_QTY';
    end if;

    update menu_items
      set stock_qty = stock_qty - v_qty, updated_at = now()
      where id = v_menu_item_id and stock_qty >= v_qty
      returning * into v_updated;

    if not found then
      raise exception 'INSUFFICIENT_STOCK:%', v_menu_item_id;
    end if;

    if v_updated.vendor_id <> v_slot.vendor_id then
      raise exception 'WRONG_VENDOR:%', v_updated.name;
    end if;
  end loop;

  insert into orders (slot_id, student_name, block, room, tip, payment_method, note, items, status)
  values (p_slot_id, p_student_name, p_block, p_room, coalesce(p_tip, 0), p_payment_method, p_note, p_items, 'placed')
  returning * into v_order;

  return v_order;
end;
$function$;

create or replace function public.restock_item(p_item_id uuid, p_amount integer)
 returns jsonb
 language plpgsql
 set search_path = public, pg_temp
as $function$
declare
  v_item menu_items;
  v_log restock_logs;
begin
  if p_amount is null or p_amount < 1 or p_amount > 10000 then
    raise exception 'INVALID_AMOUNT';
  end if;

  update menu_items
    set stock_qty = stock_qty + p_amount, updated_at = now()
    where id = p_item_id
    returning * into v_item;

  if not found then
    raise exception 'ITEM_NOT_FOUND';
  end if;

  insert into restock_logs (vendor_id, menu_item_id, amount, at)
  values (v_item.vendor_id, v_item.id, p_amount, now())
  returning * into v_log;

  return jsonb_build_object('item', to_jsonb(v_item), 'restockLog', to_jsonb(v_log));
end;
$function$;

-- Functions: server only.
revoke execute on function public.fee_for_order_count(integer) from public, anon, authenticated;
revoke execute on function public.close_slot(uuid) from public, anon, authenticated;
revoke execute on function public.dispatch_slot(uuid) from public, anon, authenticated;
revoke execute on function public.place_order(uuid, text, text, text, numeric, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.restock_item(uuid, integer) from public, anon, authenticated;
grant execute on function public.fee_for_order_count(integer) to service_role;
grant execute on function public.close_slot(uuid) to service_role;
grant execute on function public.dispatch_slot(uuid) to service_role;
grant execute on function public.place_order(uuid, text, text, text, numeric, text, text, jsonb) to service_role;
grant execute on function public.restock_item(uuid, integer) to service_role;

-- Tables: hidden from the public anon key and from signed-in users
-- (advisor lints 0026/0027). vendor_users keeps a read of one's own links.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.vendor_users to authenticated;

-- Same for tables created later by the dashboard/migrations.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
