-- A student can cancel an order while it is still waiting for the pool to close.
--
-- Once the pool closes the store starts packing and the delivery fee is fixed for everyone, so
-- after that the order can only be changed by talking to the store. Cancelling puts the items
-- back in stock, takes the order out of the pool count (so the delivery fee of the others is
-- worked out without it) and out of every store-facing list. Cancelling twice is harmless.

do $do$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.orders'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%status%'
  loop
    execute format('alter table public.orders drop constraint %I', c.conname);
  end loop;
end
$do$;
alter table public.orders add constraint orders_status_check
  check (status in ('placed', 'pooled', 'dispatched', 'delivered', 'cancelled'));

create or replace function public.api_cancel_order(p_order_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := private.require_user();
  o orders;
  line jsonb;
begin
  select * into o from orders where id = p_order_id and student_id = v_uid for update;
  if not found then
    perform private.fail(404, 'Order not found');
  end if;
  if o.status = 'cancelled' then
    return jsonb_build_object('message', 'Order already cancelled', 'order', private.json_order(o));
  end if;

  -- A pool whose time is up closes now, so a late cancel is judged on the real state.
  perform private.close_if_expired(o.slot_id);
  select * into o from orders where id = p_order_id;
  if o.status <> 'placed' then
    perform private.fail(409, 'The pool has closed and the store is preparing your order. Please contact the store to change it.');
  end if;

  for line in select * from jsonb_array_elements(o.items) loop
    update menu_items set stock_qty = stock_qty + (line->>'qty')::integer where id = (line->>'menuItemId')::uuid;
  end loop;
  update orders set status = 'cancelled', updated_at = now() where id = p_order_id returning * into o;
  return jsonb_build_object('message', 'Order cancelled', 'order', private.json_order(o));
end;
$function$;

revoke all on function public.api_cancel_order(uuid) from public, anon, authenticated;
grant execute on function public.api_cancel_order(uuid) to authenticated;

-- Store-facing lists leave cancelled orders out.

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
                        where o.slot_id = any(coalesce(v_slot_ids, '{}')) and o.status <> 'cancelled'), '[]'::jsonb),
    'days', v_days);
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
                   where s.vendor_id = p_vendor_id and o.status <> 'cancelled' and (p_status is null or o.status = p_status)), '[]'::jsonb);
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
                   from orders o where o.slot_id = p_slot_id and o.status <> 'cancelled'), '[]'::jsonb);
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
           where o.slot_id = p_slot_id and o.status <> 'cancelled' group by 1) t
    left join menu_items m on m.id = t.id), '[]'::jsonb);
end;
$function$;
