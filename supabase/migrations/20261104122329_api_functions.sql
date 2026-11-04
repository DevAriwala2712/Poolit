-- Database access functions (Phase 1, week 1).
--
-- Replaces the Express API (backend/) with Postgres functions the apps call
-- directly through Supabase (`supabase.rpc('api_...')`). Each function:
--   * checks who is calling (`auth.uid()` and the `vendor_users` link) itself,
--     so access control no longer depends on a server in front of the database;
--   * returns the same camelCase JSON the Express routes returned, so the
--     frontend's types do not change;
--   * reports failures as PostgREST status codes (SQLSTATE PT401/PT403/PT404/
--     PT409/PT400 become HTTP 401/403/404/409/400) with the same messages.
--
-- Tables stay completely closed to the public roles (no grants, RLS on, no
-- policies): the ONLY way in is these functions. The older write functions
-- (place_order, close_slot, ...) remain service_role-only and are called from
-- here with the caller's identity already checked.
--
-- Nothing in the running system changes until the apps are switched over to
-- call these functions (VITE_BACKEND=supabase, week 2).

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ============ Internal helpers (not callable from the API) ============

create or replace function private.fail(p_status integer, p_message text)
 returns void
 language plpgsql
 set search_path = public, pg_temp
as $function$
begin
  raise exception '%', p_message using errcode = 'PT' || p_status::text;
end;
$function$;

create or replace function private.ms(p_ts timestamptz)
 returns bigint
 language sql
 immutable
 set search_path = public, pg_temp
as $function$
  select floor(extract(epoch from p_ts) * 1000)::bigint
$function$;

create or replace function private.json_hostel(r hostels)
 returns jsonb language sql stable set search_path = public, pg_temp
as $function$
  select jsonb_build_object('id', r.id, 'name', r.name, 'blocks', to_jsonb(r.blocks),
                            'createdAt', r.created_at, 'updatedAt', r.updated_at)
$function$;

create or replace function private.json_vendor(r vendors)
 returns jsonb language sql stable set search_path = public, pg_temp
as $function$
  select jsonb_build_object('id', r.id, 'name', r.name, 'hostelId', r.hostel_id,
                            'prepMinutes', r.prep_minutes, 'acceptingOrders', r.accepting_orders,
                            'poolWindowMinutes', r.pool_window_minutes,
                            'createdAt', r.created_at, 'updatedAt', r.updated_at)
$function$;

create or replace function private.json_menu_item(r menu_items)
 returns jsonb language sql stable set search_path = public, pg_temp
as $function$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', r.id, 'vendorId', r.vendor_id, 'name', r.name, 'category', r.category,
    'price', r.price, 'mrp', r.mrp, 'unit', r.unit, 'rating', r.rating,
    'ratingCount', r.rating_count, 'isVeg', r.is_veg, 'art', r.art, 'tint', r.tint,
    'stockQty', r.stock_qty, 'lowStockThreshold', r.low_stock_threshold,
    'barcode', r.barcode, 'createdAt', r.created_at, 'updatedAt', r.updated_at))
$function$;

create or replace function private.json_slot(r slots)
 returns jsonb language sql stable set search_path = public, pg_temp
as $function$
  select jsonb_build_object('id', r.id, 'hostelId', r.hostel_id, 'vendorId', r.vendor_id,
                            'status', r.status, 'opensAt', private.ms(r.opens_at),
                            'closesAt', private.ms(r.closes_at),
                            'createdAt', r.created_at, 'updatedAt', r.updated_at)
$function$;

create or replace function private.json_order(r orders)
 returns jsonb language sql stable set search_path = public, pg_temp
as $function$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', r.id, 'slotId', r.slot_id, 'studentName', r.student_name,
    'block', r.block, 'room', r.room, 'tip', r.tip,
    'paymentMethod', r.payment_method, 'note', r.note,
    -- name and unitPricePaise are the price frozen when the order was placed
    -- (absent on orders that predate it).
    'items', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                         'menuItemId', i->>'menuItemId', 'qty', (i->>'qty')::integer,
                         'name', i->>'name', 'unitPricePaise', (i->>'unitPricePaise')::integer)))
                       from jsonb_array_elements(r.items) i), '[]'::jsonb),
    'subtotalPaise', r.subtotal_paise,
    'status', r.status, 'createdAt', private.ms(r.created_at),
    'deliveryFeeCharged', r.delivery_fee_charged))
$function$;

create or replace function private.json_restock_log(r restock_logs)
 returns jsonb language sql stable set search_path = public, pg_temp
as $function$
  select jsonb_build_object('id', r.id, 'vendorId', r.vendor_id, 'menuItemId', r.menu_item_id,
                            'amount', r.amount, 'at', private.ms(r.at))
$function$;

create or replace function private.json_staff(r staff)
 returns jsonb language sql stable set search_path = public, pg_temp
as $function$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', r.id, 'vendorId', r.vendor_id, 'name', r.name, 'role', r.role, 'email', r.email,
    'status', r.status, 'createdAt', r.created_at, 'updatedAt', r.updated_at))
$function$;

create or replace function private.json_adjustment(r stock_adjustments)
 returns jsonb language sql stable set search_path = public, pg_temp
as $function$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', r.id, 'vendorId', r.vendor_id, 'menuItemId', r.menu_item_id, 'reason', r.reason,
    'previousQty', r.previous_qty, 'newQty', r.new_qty, 'delta', r.delta,
    'note', r.note, 'at', private.ms(r.at)))
$function$;

-- A store with its full menu, as the apps expect it.
create or replace function private.json_vendor_with_menu(r vendors)
 returns jsonb language sql stable set search_path = public, pg_temp
as $function$
  select private.json_vendor(r) || jsonb_build_object('menu', coalesce(
    (select jsonb_agg(private.json_menu_item(m) order by m.category, m.name)
       from menu_items m where m.vendor_id = r.id), '[]'::jsonb))
$function$;

-- Signed in? Returns the caller's id or fails with 401.
create or replace function private.require_user()
 returns uuid
 language plpgsql
 stable
 set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null then
    perform private.fail(401, 'Not signed in');
  end if;
  return auth.uid();
end;
$function$;

-- May the caller operate this store? Any linked user, or only owners.
create or replace function private.require_vendor(p_vendor_id uuid, p_owner_only boolean default false)
 returns text
 language plpgsql
 stable
 set search_path = public, pg_temp
as $function$
declare
  v_role text;
begin
  perform private.require_user();
  if p_vendor_id is null then
    perform private.fail(404, 'Not found');
  end if;
  select role into v_role from vendor_users where user_id = auth.uid() and vendor_id = p_vendor_id;
  if v_role is null or (p_owner_only and v_role <> 'owner') then
    perform private.fail(403, 'You don''t have access to this store');
  end if;
  return v_role;
end;
$function$;

create or replace function private.vendor_of_slot(p_slot_id uuid) returns uuid
 language sql stable set search_path = public, pg_temp
as $function$ select vendor_id from slots where id = p_slot_id $function$;

create or replace function private.vendor_of_item(p_item_id uuid) returns uuid
 language sql stable set search_path = public, pg_temp
as $function$ select vendor_id from menu_items where id = p_item_id $function$;

create or replace function private.vendor_of_order(p_order_id uuid) returns uuid
 language sql stable set search_path = public, pg_temp
as $function$
  select s.vendor_id from orders o join slots s on s.id = o.slot_id where o.id = p_order_id
$function$;

create or replace function private.vendor_of_staff(p_staff_id uuid) returns uuid
 language sql stable set search_path = public, pg_temp
as $function$ select vendor_id from staff where id = p_staff_id $function$;

-- Closes the pool if its timer has run out (what Express did on every read).
create or replace function private.close_if_expired(p_slot_id uuid)
 returns slots
 language plpgsql
 set search_path = public, pg_temp
as $function$
declare
  v_slot slots;
begin
  select * into v_slot from slots where id = p_slot_id;
  if found and v_slot.status = 'open' and now() >= v_slot.closes_at then
    perform close_slot(v_slot.id);
    select * into v_slot from slots where id = p_slot_id;
  end if;
  return v_slot;
end;
$function$;

-- A whole number inside [lo, hi] from a JSON value, else null.
create or replace function private.json_int(p_val jsonb, p_lo bigint, p_hi bigint)
 returns bigint
 language sql
 immutable
 set search_path = public, pg_temp
as $function$
  select case
    when p_val is not null and jsonb_typeof(p_val) = 'number'
         and (p_val #>> '{}')::numeric = trunc((p_val #>> '{}')::numeric)
         and (p_val #>> '{}')::numeric between p_lo and p_hi
    then (p_val #>> '{}')::numeric::bigint
  end
$function$;

revoke all on all functions in schema private from public, anon, authenticated;

-- ============ Public catalogue (anyone) ============

create or replace function public.api_hostels()
 returns jsonb
 language sql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
  select coalesce(jsonb_agg(private.json_hostel(h) order by h.name), '[]'::jsonb) from hostels h
$function$;

create or replace function public.api_vendors()
 returns jsonb
 language sql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
  select coalesce(jsonb_agg(private.json_vendor_with_menu(v) order by v.name), '[]'::jsonb) from vendors v
$function$;

create or replace function public.api_vendor(p_vendor_id uuid)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v vendors;
begin
  select * into v from vendors where id = p_vendor_id;
  if not found then
    perform private.fail(404, 'Vendor not found');
  end if;
  return private.json_vendor_with_menu(v);
end;
$function$;

create or replace function public.api_vendor_menu(p_vendor_id uuid)
 returns jsonb
 language sql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
  select coalesce(jsonb_agg(private.json_menu_item(m) order by m.category, m.name), '[]'::jsonb)
  from menu_items m where m.vendor_id = p_vendor_id
$function$;

-- The hostel's current pool and its store with menu. Opens or rotates the
-- pool if needed (same atomic ensure_open_slot() as before).
create or replace function public.api_current_slot(p_hostel_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_slot slots;
  v_vendor vendors;
begin
  begin
    v_slot := ensure_open_slot(p_hostel_id);
  exception when others then
    if sqlerrm like 'VENDOR_NOT_FOUND%' or sqlstate = '22P02' then
      perform private.fail(404, 'No store serves this hostel yet');
    end if;
    raise;
  end;
  if v_slot.id is null then
    perform private.fail(404, 'No slot found for this hostel');
  end if;
  select * into v_vendor from vendors where id = v_slot.vendor_id;
  if not found then
    perform private.fail(404, 'Vendor not found for slot');
  end if;
  return jsonb_build_object('slot', private.json_slot(v_slot), 'vendor', private.json_vendor_with_menu(v_vendor));
end;
$function$;

create or replace function public.api_slot(p_slot_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_slot slots;
begin
  v_slot := private.close_if_expired(p_slot_id);
  if v_slot.id is null then
    perform private.fail(404, 'Slot not found');
  end if;
  return private.json_slot(v_slot);
end;
$function$;

create or replace function public.api_live_fee(p_slot_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_slot slots;
  v_count integer;
begin
  v_slot := private.close_if_expired(p_slot_id);
  if v_slot.id is null then
    perform private.fail(404, 'Slot not found');
  end if;
  select count(*) into v_count from orders where slot_id = v_slot.id and status in ('placed', 'pooled');
  return jsonb_build_object('orderCount', v_count, 'fee', fee_for_order_count(v_count));
end;
$function$;

-- ============ Students (signed in) ============

create or replace function public.api_me()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := private.require_user();
  s students;
  v_phone text;
begin
  select phone into v_phone from auth.users where id = v_uid;
  select * into s from students where user_id = v_uid;
  return jsonb_build_object('userId', v_uid, 'phone', to_jsonb(v_phone),
    'profile', case when s.user_id is null then null else jsonb_strip_nulls(jsonb_build_object(
       'name', s.name, 'hostelId', s.hostel_id, 'block', s.block, 'room', s.room)) end);
end;
$function$;

create or replace function public.api_update_me(p_name text, p_hostel_id uuid default null, p_block text default null, p_room text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := private.require_user();
  v_name text := btrim(coalesce(p_name, ''));
  v_block text := nullif(btrim(coalesce(p_block, '')), '');
  v_room text := nullif(btrim(coalesce(p_room, '')), '');
begin
  if v_name = '' or char_length(v_name) > 60 then
    perform private.fail(400, 'name is required (max 60 characters)');
  end if;
  if char_length(coalesce(p_block, '')) > 40 then
    perform private.fail(400, 'block must be text (max 40 characters)');
  end if;
  if char_length(coalesce(p_room, '')) > 20 then
    perform private.fail(400, 'room must be text (max 20 characters)');
  end if;

  begin
    insert into students (user_id, name, phone, hostel_id, block, room, updated_at)
    values (v_uid, v_name, (select phone from auth.users where id = v_uid), p_hostel_id, v_block, v_room, now())
    on conflict (user_id) do update
      set name = excluded.name, phone = excluded.phone, hostel_id = excluded.hostel_id,
          block = excluded.block, room = excluded.room, updated_at = now();
  exception when foreign_key_violation then
    perform private.fail(400, 'Unknown hostel');
  end;
  return public.api_me();
end;
$function$;

create or replace function public.api_my_orders()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := private.require_user();
begin
  return jsonb_build_object(
    'orders', coalesce((select jsonb_agg(private.json_order(o) order by o.created_at desc)
                        from (select * from orders where student_id = v_uid order by created_at desc limit 50) o), '[]'::jsonb),
    'slots', coalesce((select jsonb_agg(private.json_slot(s))
                       from slots s where s.id in (select slot_id from (select slot_id from orders where student_id = v_uid
                                                    order by created_at desc limit 50) x)), '[]'::jsonb));
end;
$function$;

-- Most orders one student may have in a single pool. Stops one account from
-- flooding a pool, while still allowing a top-up if they forgot something.
-- Change the number here and re-run this function to adjust it.
create or replace function public.api_place_order(
  p_slot_id uuid,
  p_student_name text,
  p_items jsonb,
  p_block text default null,
  p_room text default null,
  p_tip numeric default 0,
  p_payment_method text default null,
  p_note text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  c_max_orders_per_pool constant integer := 3;
  v_uid uuid := private.require_user();
  v_name text := btrim(coalesce(p_student_name, ''));
  v_existing integer;
  v_clean jsonb;
  v_order orders;
begin
  if v_name = '' or char_length(v_name) > 60 then
    perform private.fail(400, 'studentName is required (max 60 characters)');
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    perform private.fail(400, 'items array is required and cannot be empty');
  end if;
  if char_length(coalesce(p_block, '')) > 40 or char_length(coalesce(p_room, '')) > 20 then
    perform private.fail(400, 'block or room is too long');
  end if;

  -- Keep only menuItemId and qty from each line, and check their shape.
  begin
    select jsonb_agg(jsonb_build_object('menuItemId', (i->>'menuItemId')::uuid, 'qty', private.json_int(i->'qty', 1, 100)))
      into v_clean
      from jsonb_array_elements(p_items) i;
    if exists (select 1 from jsonb_array_elements(v_clean) c where c->'qty' = 'null'::jsonb or c->'menuItemId' = 'null'::jsonb) then
      perform private.fail(400, 'Each item needs a quantity between 1 and 100 (max 50 lines)');
    end if;
  exception when invalid_text_representation or null_value_not_allowed or invalid_parameter_value then
    perform private.fail(400, 'Each item must have menuItemId and positive integer qty');
  end;

  -- Serialise orders for this pool (place_order takes the same lock), then
  -- apply the per-student limit.
  perform 1 from slots where id = p_slot_id for update;
  if not found then
    perform private.fail(404, 'Slot not found');
  end if;
  select count(*) into v_existing from orders
    where slot_id = p_slot_id and student_id = v_uid and status in ('placed', 'pooled');
  if v_existing >= c_max_orders_per_pool then
    perform private.fail(409, format('You can place up to %s orders in one pool', c_max_orders_per_pool));
  end if;

  begin
    v_order := place_order(
      p_slot_id, v_name, nullif(btrim(coalesce(p_block, '')), ''), nullif(btrim(coalesce(p_room, '')), ''),
      least(greatest(coalesce(p_tip, 0), 0), 500),
      nullif(left(btrim(coalesce(p_payment_method, '')), 30), ''),
      nullif(left(btrim(coalesce(p_note, '')), 140), ''),
      v_clean, v_uid);
  exception when others then
    if sqlstate like 'PT%' then raise; end if;
    if sqlerrm like 'SLOT_NOT_FOUND%' then
      perform private.fail(404, 'Slot not found');
    elsif sqlerrm like 'INVALID_QTY%' or sqlerrm like 'INVALID_ITEMS%' then
      perform private.fail(400, 'Each item needs a quantity between 1 and 100 (max 50 lines)');
    elsif sqlerrm like 'SLOT_NOT_OPEN%' then
      perform private.fail(409, 'Cannot place order: slot is "' || split_part(sqlerrm, ':', 2) || '"');
    elsif sqlerrm like 'INSUFFICIENT_STOCK%' then
      perform private.fail(409, 'Insufficient stock for one or more items');
    elsif sqlerrm like 'WRONG_VENDOR%' then
      perform private.fail(400, 'Menu item "' || split_part(sqlerrm, ':', 2) || '" does not belong to this vendor');
    end if;
    raise;
  end;
  return private.json_order(v_order);
end;
$function$;

-- ============ Vendors (signed in and linked to the store) ============

create or replace function public.api_vendor_overview(p_days integer default 7)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := private.require_user();
  v_days integer := least(31, greatest(1, coalesce(p_days, 7)));
  v_ids uuid[];
  v_since timestamptz;
  v_hostel uuid;
  v_slot_ids uuid[];
begin
  select array_agg(vendor_id) into v_ids from vendor_users where user_id = v_uid;
  if v_ids is null then
    perform private.fail(403, 'This account isn''t a vendor account');
  end if;
  v_since := now() - make_interval(days => v_days);

  -- Keep each store's pool cycling (opens or rotates it).
  for v_hostel in select hostel_id from vendors where id = any(v_ids) loop
    begin
      perform ensure_open_slot(v_hostel);
    exception when others then
      raise warning 'pool rotation failed for %: %', v_hostel, sqlerrm;
    end;
  end loop;

  select array_agg(id) into v_slot_ids from slots
    where vendor_id = any(v_ids) and (opens_at >= v_since or status in ('open', 'closed'));

  return jsonb_build_object(
    'hostels', coalesce((select jsonb_agg(private.json_hostel(h) order by h.name) from hostels h
                         where h.id in (select hostel_id from vendors where id = any(v_ids))), '[]'::jsonb),
    'vendors', coalesce((select jsonb_agg(private.json_vendor_with_menu(v) order by v.name) from vendors v
                         where v.id = any(v_ids)), '[]'::jsonb),
    'slots', coalesce((select jsonb_agg(private.json_slot(s) order by s.opens_at desc) from slots s
                       where s.id = any(coalesce(v_slot_ids, '{}'))), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(private.json_order(o) order by o.created_at desc) from orders o
                        where o.slot_id = any(coalesce(v_slot_ids, '{}'))), '[]'::jsonb),
    'days', v_days);
end;
$function$;

create or replace function public.api_update_vendor(p_vendor_id uuid, p_patch jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v vendors;
  v_accept boolean;
  v_prep bigint;
  v_window bigint;
  v_any boolean := false;
begin
  perform private.require_vendor(p_vendor_id, true);
  select * into v from vendors where id = p_vendor_id for update;
  if not found then
    perform private.fail(404, 'Vendor not found');
  end if;

  if p_patch ? 'acceptingOrders' then
    if jsonb_typeof(p_patch->'acceptingOrders') <> 'boolean' then
      perform private.fail(400, 'acceptingOrders must be a boolean');
    end if;
    v.accepting_orders := (p_patch->>'acceptingOrders')::boolean; v_any := true;
  end if;
  if p_patch ? 'prepMinutes' then
    v_prep := private.json_int(p_patch->'prepMinutes', 1, 1440);
    if v_prep is null then perform private.fail(400, 'prepMinutes must be a positive integer'); end if;
    v.prep_minutes := v_prep; v_any := true;
  end if;
  if p_patch ? 'poolWindowMinutes' then
    v_window := private.json_int(p_patch->'poolWindowMinutes', 3, 60);
    if v_window is null then perform private.fail(400, 'poolWindowMinutes must be a whole number from 3 to 60'); end if;
    v.pool_window_minutes := v_window; v_any := true;
  end if;
  if not v_any then
    perform private.fail(400, 'Nothing to update');
  end if;

  update vendors set accepting_orders = v.accepting_orders, prep_minutes = v.prep_minutes,
         pool_window_minutes = v.pool_window_minutes, updated_at = now()
    where id = p_vendor_id returning * into v;
  return private.json_vendor(v);
end;
$function$;

create or replace function public.api_vendor_orders(p_vendor_id uuid, p_status text default null)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
begin
  perform private.require_vendor(p_vendor_id);
  return coalesce((select jsonb_agg(private.json_order(o) order by o.created_at desc)
                   from orders o join slots s on s.id = o.slot_id
                   where s.vendor_id = p_vendor_id and (p_status is null or o.status = p_status)), '[]'::jsonb);
end;
$function$;

create or replace function public.api_slot_orders(p_slot_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
begin
  perform private.require_vendor(private.vendor_of_slot(p_slot_id));
  perform private.close_if_expired(p_slot_id);
  return coalesce((select jsonb_agg(private.json_order(o) order by o.created_at)
                   from orders o where o.slot_id = p_slot_id), '[]'::jsonb);
end;
$function$;

create or replace function public.api_pick_list(p_slot_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
begin
  perform private.require_vendor(private.vendor_of_slot(p_slot_id));
  perform private.close_if_expired(p_slot_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object('menuItemId', t.id, 'name', coalesce(m.name, 'Unknown item'),
                                        'art', coalesce(m.art, '📦'), 'totalQty', t.qty)
                     order by t.qty desc, m.name)
    from (select (i->>'menuItemId')::uuid as id, sum((i->>'qty')::integer) as qty
            from orders o, jsonb_array_elements(o.items) i
           where o.slot_id = p_slot_id group by 1) t
    left join menu_items m on m.id = t.id), '[]'::jsonb);
end;
$function$;

create or replace function public.api_close_slot(p_slot_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_res jsonb;
  v_slot slots;
begin
  perform private.require_vendor(private.vendor_of_slot(p_slot_id));
  v_res := close_slot(p_slot_id);
  select * into v_slot from slots where id = p_slot_id;
  return jsonb_strip_nulls(jsonb_build_object(
    'message', case when (v_res->>'alreadyClosed')::boolean then 'Slot was already closed' else 'Slot closed successfully' end,
    'slot', private.json_slot(v_slot), 'fee', v_res->'fee', 'orderCount', v_res->'orderCount'));
end;
$function$;

create or replace function public.api_dispatch_slot(p_slot_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_slot slots;
begin
  perform private.require_vendor(private.vendor_of_slot(p_slot_id));
  begin
    v_slot := dispatch_slot(p_slot_id);
  exception when others then
    if sqlerrm like 'SLOT_NOT_FOUND%' then
      perform private.fail(404, 'Slot not found');
    elsif sqlerrm like 'SLOT_NOT_CLOSED%' then
      perform private.fail(409, 'Cannot dispatch slot in status "' || split_part(sqlerrm, ':', 2) || '". Expected "closed".');
    end if;
    raise;
  end;
  return jsonb_build_object('message', 'Slot dispatched successfully', 'slot', private.json_slot(v_slot));
end;
$function$;

create or replace function public.api_mark_delivered(p_order_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_order orders;
  v_status text;
begin
  perform private.require_vendor(private.vendor_of_order(p_order_id));
  -- One conditional update, so two taps at once cannot both succeed.
  update orders set status = 'delivered', updated_at = now()
    where id = p_order_id and status = 'dispatched'
    returning * into v_order;
  if not found then
    select status into v_status from orders where id = p_order_id;
    perform private.fail(409, 'Cannot mark delivered: order is currently "' || coalesce(v_status, '?') || '". Expected "dispatched".');
  end if;
  return jsonb_build_object('message', 'Order marked as delivered', 'order', private.json_order(v_order));
end;
$function$;

create or replace function public.api_create_menu_item(p_vendor_id uuid, p_input jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  c_categories constant text[] := array['Snacks', 'Instant Food', 'Drinks', 'Essentials', 'Fresh', 'Midnight Cravings'];
  v_name text := btrim(coalesce(p_input->>'name', ''));
  v_unit text := btrim(coalesce(p_input->>'unit', ''));
  v_cat text := p_input->>'category';
  v_price numeric;
  v_stock bigint := 0;
  v_low bigint := 5;
  v_item menu_items;
begin
  perform private.require_vendor(p_vendor_id);
  if v_name = '' or jsonb_typeof(p_input->'name') <> 'string' then perform private.fail(400, 'name is required'); end if;
  if v_cat is null or not (v_cat = any(c_categories)) then
    perform private.fail(400, 'category must be one of: ' || array_to_string(c_categories, ', '));
  end if;
  if jsonb_typeof(p_input->'price') <> 'number' or (p_input->>'price')::numeric <= 0 then
    perform private.fail(400, 'price must be a positive number');
  end if;
  v_price := round((p_input->>'price')::numeric);
  if v_price <= 0 then perform private.fail(400, 'price must be a positive number'); end if;
  if v_unit = '' or jsonb_typeof(p_input->'unit') <> 'string' then perform private.fail(400, 'unit is required'); end if;
  if p_input ? 'stockQty' then
    v_stock := private.json_int(p_input->'stockQty', 0, 100000);
    if v_stock is null then perform private.fail(400, 'stockQty must be a non-negative integer'); end if;
  end if;
  if p_input ? 'lowStockThreshold' then
    v_low := private.json_int(p_input->'lowStockThreshold', 0, 100000);
    if v_low is null then perform private.fail(400, 'lowStockThreshold must be a non-negative integer'); end if;
  end if;

  begin
    insert into menu_items (vendor_id, name, category, price, unit, stock_qty, low_stock_threshold, is_veg, art, tint)
    values (p_vendor_id, left(v_name, 120), v_cat, v_price, left(v_unit, 60), v_stock, v_low,
            case when jsonb_typeof(p_input->'isVeg') = 'boolean' then (p_input->>'isVeg')::boolean else true end,
            coalesce(nullif(left(btrim(p_input->>'art'), 16), ''), '📦'),
            coalesce(nullif(left(btrim(p_input->>'tint'), 9), ''), '#F1EDE6'))
    returning * into v_item;
  exception when foreign_key_violation then
    perform private.fail(404, 'Vendor not found');
  end;
  return private.json_menu_item(v_item);
end;
$function$;

create or replace function public.api_update_menu_item(p_item_id uuid, p_patch jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_item menu_items;
  v_any boolean := false;
  v_low bigint;
begin
  perform private.require_vendor(private.vendor_of_item(p_item_id));
  select * into v_item from menu_items where id = p_item_id for update;
  if not found then perform private.fail(404, 'Menu item not found'); end if;

  if p_patch ? 'price' then
    if jsonb_typeof(p_patch->'price') <> 'number' or (p_patch->>'price')::numeric <= 0 or round((p_patch->>'price')::numeric) <= 0 then
      perform private.fail(400, 'price must be a positive number');
    end if;
    v_item.price := round((p_patch->>'price')::numeric); v_any := true;
  end if;
  if p_patch ? 'lowStockThreshold' then
    v_low := private.json_int(p_patch->'lowStockThreshold', 0, 100000);
    if v_low is null then perform private.fail(400, 'lowStockThreshold must be a non-negative integer'); end if;
    v_item.low_stock_threshold := v_low; v_any := true;
  end if;
  if p_patch ? 'barcode' then
    if jsonb_typeof(p_patch->'barcode') = 'null' then
      v_item.barcode := null;
    elsif jsonb_typeof(p_patch->'barcode') = 'string' and btrim(p_patch->>'barcode') <> '' and char_length(p_patch->>'barcode') <= 32 then
      v_item.barcode := btrim(p_patch->>'barcode');
    else
      perform private.fail(400, 'barcode must be a non-empty string or null');
    end if;
    v_any := true;
  end if;
  if not v_any then perform private.fail(400, 'Nothing to update'); end if;

  begin
    update menu_items set price = v_item.price, low_stock_threshold = v_item.low_stock_threshold,
           barcode = v_item.barcode, updated_at = now()
      where id = p_item_id returning * into v_item;
  exception when unique_violation then
    perform private.fail(409, 'This barcode is already assigned to another item for this store');
  end;
  return private.json_menu_item(v_item);
end;
$function$;

create or replace function public.api_restock_item(p_item_id uuid, p_amount integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_res jsonb;
begin
  perform private.require_vendor(private.vendor_of_item(p_item_id));
  if p_amount is null or p_amount <= 0 then
    perform private.fail(400, 'amount must be a positive integer');
  end if;
  begin
    v_res := restock_item(p_item_id, p_amount);
  exception when others then
    if sqlerrm like 'ITEM_NOT_FOUND%' then perform private.fail(404, 'Menu item not found');
    elsif sqlerrm like 'INVALID_AMOUNT%' then perform private.fail(400, 'amount must be between 1 and 10,000');
    end if;
    raise;
  end;
  return jsonb_build_object('message', 'Restocked successfully',
    'item', private.json_menu_item(jsonb_populate_record(null::menu_items, v_res->'item')),
    'restockLog', private.json_restock_log(jsonb_populate_record(null::restock_logs, v_res->'restockLog')));
end;
$function$;

create or replace function public.api_restock_log(p_item_id uuid)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
begin
  perform private.require_vendor(private.vendor_of_item(p_item_id));
  return coalesce((select jsonb_agg(private.json_restock_log(r) order by r.at desc)
                   from restock_logs r where r.menu_item_id = p_item_id), '[]'::jsonb);
end;
$function$;

create or replace function public.api_inventory(p_vendor_id uuid default null, p_status text default null)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := private.require_user();
begin
  if p_vendor_id is not null then
    perform private.require_vendor(p_vendor_id);
  elsif not exists (select 1 from vendor_users where user_id = v_uid) then
    perform private.fail(403, 'This account isn''t a vendor account');
  end if;
  return coalesce((
    select jsonb_agg(private.json_menu_item(m) order by m.stock_qty, m.name)
    from menu_items m
    where (case when p_vendor_id is not null then m.vendor_id = p_vendor_id
                else m.vendor_id in (select vendor_id from vendor_users where user_id = v_uid) end)
      and (p_status is null
           or (p_status = 'out' and m.stock_qty = 0)
           or (p_status = 'low' and m.stock_qty > 0 and m.stock_qty <= m.low_stock_threshold))), '[]'::jsonb);
end;
$function$;

create or replace function public.api_generate_barcode(p_item_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_item menu_items;
begin
  perform private.require_vendor(private.vendor_of_item(p_item_id));
  begin
    v_item := generate_item_barcode(p_item_id);
  exception when others then
    if sqlerrm like 'ITEM_NOT_FOUND%' then perform private.fail(404, 'Menu item not found'); end if;
    raise;
  end;
  return private.json_menu_item(v_item);
end;
$function$;

create or replace function public.api_generate_missing_barcodes(p_vendor_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_id uuid;
  v_item menu_items;
  v_items jsonb := '[]'::jsonb;
begin
  perform private.require_vendor(p_vendor_id);
  for v_id in select id from menu_items where vendor_id = p_vendor_id and barcode is null order by name loop
    v_item := generate_item_barcode(v_id);
    v_items := v_items || jsonb_build_array(private.json_menu_item(v_item));
  end loop;
  return jsonb_build_object('generated', jsonb_array_length(v_items), 'items', v_items);
end;
$function$;

create or replace function public.api_adjust_stock(p_item_id uuid, p_mode text, p_qty integer, p_reason text default null, p_note text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_why text;
  v_res jsonb;
begin
  perform private.require_vendor(private.vendor_of_item(p_item_id));
  if p_mode is null or p_mode not in ('set', 'remove') then
    perform private.fail(400, 'mode must be "set" or "remove"');
  end if;
  if p_qty is null or p_qty < (case when p_mode = 'remove' then 1 else 0 end) or p_qty > 100000 then
    perform private.fail(400, 'qty must be a whole number (0–100,000; at least 1 to remove)');
  end if;
  v_why := coalesce(p_reason, case when p_mode = 'set' then 'count' else 'damaged' end);
  if v_why not in ('count', 'damaged', 'expired', 'correction', 'other') then
    perform private.fail(400, 'reason must be one of: count, damaged, expired, correction, other');
  end if;
  if char_length(coalesce(p_note, '')) > 140 then
    perform private.fail(400, 'note must be text (max 140 characters)');
  end if;
  begin
    v_res := adjust_stock(p_item_id, p_mode, p_qty, v_why, auth.uid(), p_note);
  exception when others then
    if sqlerrm like 'ITEM_NOT_FOUND%' then perform private.fail(404, 'Menu item not found');
    elsif sqlerrm like 'NOT_ENOUGH_STOCK%' then
      perform private.fail(409, 'Only ' || split_part(sqlerrm, ':', 2) || ' in stock — can''t remove more than that');
    elsif sqlerrm like 'INVALID_QTY%' then perform private.fail(400, 'Invalid quantity');
    end if;
    raise;
  end;
  return jsonb_build_object(
    'item', private.json_menu_item(jsonb_populate_record(null::menu_items, v_res->'item')),
    'adjustment', private.json_adjustment(jsonb_populate_record(null::stock_adjustments, v_res->'adjustment')));
end;
$function$;

create or replace function public.api_stock_history(p_item_id uuid)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
begin
  perform private.require_vendor(private.vendor_of_item(p_item_id));
  return coalesce((
    select jsonb_agg(e.j order by e.at desc) from (
      (select jsonb_build_object('id', r.id, 'kind', 'restock', 'delta', r.amount, 'at', private.ms(r.at)) as j, r.at
         from restock_logs r where r.menu_item_id = p_item_id order by r.at desc limit 50)
      union all
      (select private.json_adjustment(a) || jsonb_build_object('kind', a.reason), a.at
         from stock_adjustments a where a.menu_item_id = p_item_id order by a.at desc limit 50)
      order by at desc limit 50) e), '[]'::jsonb);
end;
$function$;

-- ---- staff ----

create or replace function public.api_staff(p_vendor_id uuid)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
begin
  perform private.require_vendor(p_vendor_id);
  return coalesce((select jsonb_agg(private.json_staff(s) order by s.created_at)
                   from staff s where s.vendor_id = p_vendor_id), '[]'::jsonb);
end;
$function$;

create or replace function public.api_create_staff(p_vendor_id uuid, p_name text, p_role text, p_email text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_row staff;
begin
  perform private.require_vendor(p_vendor_id, true);
  if btrim(coalesce(p_name, '')) = '' or char_length(p_name) > 80 then perform private.fail(400, 'name is required'); end if;
  if btrim(coalesce(p_role, '')) = '' or char_length(p_role) > 60 then perform private.fail(400, 'role is required'); end if;
  if char_length(coalesce(p_email, '')) > 120 then perform private.fail(400, 'email is too long'); end if;
  begin
    insert into staff (vendor_id, name, role, email)
    values (p_vendor_id, btrim(p_name), btrim(p_role), nullif(btrim(coalesce(p_email, '')), ''))
    returning * into v_row;
  exception when foreign_key_violation then
    perform private.fail(404, 'Vendor not found');
  end;
  return private.json_staff(v_row);
end;
$function$;

create or replace function public.api_update_staff(p_staff_id uuid, p_patch jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_row staff;
  v_any boolean := false;
begin
  perform private.require_vendor(private.vendor_of_staff(p_staff_id), true);
  select * into v_row from staff where id = p_staff_id for update;
  if not found then perform private.fail(404, 'Staff member not found'); end if;

  if p_patch ? 'name' then
    if jsonb_typeof(p_patch->'name') <> 'string' or btrim(p_patch->>'name') = '' or char_length(p_patch->>'name') > 80 then
      perform private.fail(400, 'name must be a non-empty string');
    end if;
    v_row.name := btrim(p_patch->>'name'); v_any := true;
  end if;
  if p_patch ? 'role' then
    if jsonb_typeof(p_patch->'role') <> 'string' or btrim(p_patch->>'role') = '' or char_length(p_patch->>'role') > 60 then
      perform private.fail(400, 'role must be a non-empty string');
    end if;
    v_row.role := btrim(p_patch->>'role'); v_any := true;
  end if;
  if p_patch ? 'status' then
    if (p_patch->>'status') is null or (p_patch->>'status') not in ('active', 'break', 'inactive') then
      perform private.fail(400, 'status must be one of: active, break, inactive');
    end if;
    v_row.status := p_patch->>'status'; v_any := true;
  end if;
  if not v_any then perform private.fail(400, 'Nothing to update'); end if;

  update staff set name = v_row.name, role = v_row.role, status = v_row.status, updated_at = now()
    where id = p_staff_id returning * into v_row;
  return private.json_staff(v_row);
end;
$function$;

create or replace function public.api_delete_staff(p_staff_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
begin
  perform private.require_vendor(private.vendor_of_staff(p_staff_id), true);
  delete from staff where id = p_staff_id;
  if not found then perform private.fail(404, 'Staff member not found'); end if;
  return jsonb_build_object('message', 'Staff member removed');
end;
$function$;

-- ============ Who may call what ============

-- Start from nothing for every api_* function, then grant only what is listed.
do $$
declare
  r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'api\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

grant execute on function
  public.api_hostels(), public.api_vendors(), public.api_vendor(uuid), public.api_vendor_menu(uuid),
  public.api_current_slot(uuid), public.api_slot(uuid), public.api_live_fee(uuid)
  to anon, authenticated;

grant execute on function
  public.api_me(), public.api_update_me(text, uuid, text, text), public.api_my_orders(),
  public.api_place_order(uuid, text, jsonb, text, text, numeric, text, text),
  public.api_vendor_overview(integer), public.api_update_vendor(uuid, jsonb),
  public.api_vendor_orders(uuid, text), public.api_slot_orders(uuid), public.api_pick_list(uuid),
  public.api_close_slot(uuid), public.api_dispatch_slot(uuid), public.api_mark_delivered(uuid),
  public.api_create_menu_item(uuid, jsonb), public.api_update_menu_item(uuid, jsonb),
  public.api_restock_item(uuid, integer), public.api_restock_log(uuid), public.api_inventory(uuid, text),
  public.api_generate_barcode(uuid), public.api_generate_missing_barcodes(uuid),
  public.api_adjust_stock(uuid, text, integer, text, text), public.api_stock_history(uuid),
  public.api_staff(uuid), public.api_create_staff(uuid, text, text, text),
  public.api_update_staff(uuid, jsonb), public.api_delete_staff(uuid)
  to authenticated;
