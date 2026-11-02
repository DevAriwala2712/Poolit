-- Price snapshot on order lines (Phase 1).
--
-- Until now an order stored only { menuItemId, qty } and every bill was
-- recomputed from the CURRENT menu price, so editing a price silently changed
-- old orders, receipts and revenue. From now on place_order copies the
-- price (in integer paise) and the item name onto each line at the moment of
-- sale, and stores the order subtotal in paise.
--
--   items[]: { menuItemId, qty, name, unitPricePaise }
--   orders.subtotal_paise = sum(qty * unitPricePaise)
--
-- Existing orders are backfilled from the current menu (the best information
-- available: their original prices were never recorded). Money elsewhere
-- (menu_items.price, tip, delivery fee) stays in rupees for now; this change
-- only freezes what a customer was actually charged for goods.

alter table public.orders add column if not exists subtotal_paise integer;

-- 1. Backfill existing orders.
with enriched as (
  select o.id,
    jsonb_agg(
      line || jsonb_build_object(
        'name', coalesce(line->>'name', mi.name, 'Unknown item'),
        'unitPricePaise', coalesce((line->>'unitPricePaise')::int, round(coalesce(mi.price, 0) * 100)::int)
      ) order by ord
    ) as items,
    sum((line->>'qty')::int * coalesce((line->>'unitPricePaise')::int, round(coalesce(mi.price, 0) * 100)::int)) as subtotal
  from public.orders o
  cross join lateral jsonb_array_elements(o.items) with ordinality as l(line, ord)
  left join public.menu_items mi on mi.id = (line->>'menuItemId')::uuid
  where o.subtotal_paise is null
  group by o.id
)
update public.orders o
   set items = e.items, subtotal_paise = e.subtotal
  from enriched e
 where o.id = e.id;

-- Any order with an empty items array (should not exist) gets a zero subtotal.
update public.orders set subtotal_paise = 0 where subtotal_paise is null;

alter table public.orders alter column subtotal_paise set not null;
alter table public.orders add constraint orders_subtotal_paise_nonneg check (subtotal_paise >= 0);

-- 2. place_order snapshots name + price per line.
create or replace function public.place_order(
  p_slot_id uuid, p_student_name text, p_block text, p_room text, p_tip numeric,
  p_payment_method text, p_note text, p_items jsonb, p_student_id uuid default null
)
 returns orders
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_slot slots;
  v_item jsonb;
  v_menu_item_id uuid;
  v_qty integer;
  v_updated menu_items;
  v_order orders;
  v_lines jsonb := '[]'::jsonb;
  v_unit integer;
  v_subtotal bigint := 0;
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

    -- Freeze the price the customer is actually charged.
    v_unit := round(v_updated.price * 100)::integer;
    v_subtotal := v_subtotal + v_qty::bigint * v_unit;
    v_lines := v_lines || jsonb_build_object(
      'menuItemId', v_menu_item_id,
      'qty', v_qty,
      'name', v_updated.name,
      'unitPricePaise', v_unit
    );
  end loop;

  insert into orders (slot_id, student_name, block, room, tip, payment_method, note, items, subtotal_paise, status, student_id)
  values (p_slot_id, p_student_name, p_block, p_room, coalesce(p_tip, 0), p_payment_method, p_note, v_lines, v_subtotal, 'placed', p_student_id)
  returning * into v_order;

  return v_order;
end;
$function$;

-- create or replace keeps the existing grants, but be explicit: server only.
revoke execute on function public.place_order(uuid, text, text, text, numeric, text, text, jsonb, uuid) from public, anon, authenticated;

-- 3. Revenue reads the frozen price (falls back to the menu only for lines
--    that somehow lack one).
create or replace function public.vendor_daily_revenue(p_vendor_id uuid, p_days integer)
 returns table(day date, orders bigint, revenue numeric)
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  with days as (
    select generate_series(
      (now() at time zone 'Asia/Kolkata')::date - (least(greatest(p_days, 1), 92) - 1),
      (now() at time zone 'Asia/Kolkata')::date,
      interval '1 day'
    )::date as day
  ),
  vendor_orders as (
    select o.id, (o.created_at at time zone 'Asia/Kolkata')::date as day, o.subtotal_paise
    from orders o
    join slots s on s.id = o.slot_id
    where s.vendor_id = p_vendor_id
      and o.created_at >= now() - make_interval(days => least(greatest(p_days, 1), 92) + 1)
  )
  select d.day, count(vo.id), coalesce(sum(vo.subtotal_paise), 0)::numeric / 100
  from days d
  left join vendor_orders vo on vo.day = d.day
  group by d.day
  order by d.day;
$function$;
