-- Student accounts (phone OTP via Supabase Auth) and order ownership (Phase 1).
--
-- Until now an order was "yours" if it carried the name you typed. Orders now
-- record the signed-in student's auth user id, so the app can fetch only the
-- caller's orders and stop sending everyone's orders to every browser.

create table if not exists public.students (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  phone      text,
  hostel_id  uuid references public.hostels (id),
  block      text check (char_length(block) <= 40),
  room       text check (char_length(room) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.students enable row level security;
revoke all on public.students from anon, authenticated;

alter table public.orders
  add column if not exists student_id uuid references auth.users (id) on delete set null;
create index if not exists orders_student_created_idx on public.orders (student_id, created_at desc);

-- place_order gains an optional p_student_id. Callers that don't pass it
-- (the API version currently deployed) keep working.
drop function if exists public.place_order(uuid, text, text, text, numeric, text, text, jsonb);

create or replace function public.place_order(p_slot_id uuid, p_student_name text, p_block text, p_room text, p_tip numeric, p_payment_method text, p_note text, p_items jsonb, p_student_id uuid default null)
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

  insert into orders (slot_id, student_name, block, room, tip, payment_method, note, items, status, student_id)
  values (p_slot_id, p_student_name, p_block, p_room, coalesce(p_tip, 0), p_payment_method, p_note, p_items, 'placed', p_student_id)
  returning * into v_order;

  return v_order;
end;
$function$;

revoke execute on function public.place_order(uuid, text, text, text, numeric, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.place_order(uuid, text, text, text, numeric, text, text, jsonb, uuid) to service_role;
