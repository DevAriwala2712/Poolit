-- Extensions
create extension if not exists pgcrypto;

-- ============ TABLES ============

create table hostels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  blocks text[] not null default array['Block A'],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hostel_id uuid not null unique references hostels(id),
  prep_minutes integer not null default 6 check (prep_minutes >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id),
  name text not null,
  category text not null check (category in ('Snacks', 'Instant Food', 'Drinks', 'Essentials', 'Fresh', 'Midnight Cravings')),
  price numeric not null check (price >= 0),
  mrp numeric check (mrp >= 0),
  unit text not null,
  rating numeric not null default 4.2 check (rating >= 0 and rating <= 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  is_veg boolean not null default true,
  art text not null default '📦',
  tint text not null default '#F1EDE6',
  stock_qty integer not null default 0 check (stock_qty >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index menu_items_vendor_category_idx on menu_items (vendor_id, category);
create index menu_items_vendor_stock_idx on menu_items (vendor_id, stock_qty);

create table slots (
  id uuid primary key default gen_random_uuid(),
  hostel_id uuid not null references hostels(id),
  vendor_id uuid not null references vendors(id),
  status text not null default 'open' check (status in ('open', 'closed', 'dispatched')),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index slots_hostel_status_idx on slots (hostel_id, status);
create index slots_status_closes_idx on slots (status, closes_at);

create table orders (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references slots(id),
  student_name text not null,
  block text,
  room text,
  tip numeric not null default 0 check (tip >= 0),
  payment_method text,
  note text check (char_length(note) <= 140),
  items jsonb not null,
  status text not null default 'placed' check (status in ('placed', 'pooled', 'dispatched', 'delivered')),
  delivery_fee_charged numeric check (delivery_fee_charged >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_items_nonempty check (jsonb_array_length(items) > 0)
);
create index orders_slot_status_idx on orders (slot_id, status);

create table restock_logs (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id),
  menu_item_id uuid not null references menu_items(id),
  amount integer not null check (amount >= 1),
  at timestamptz not null default now()
);
create index restock_logs_vendor_at_idx on restock_logs (vendor_id, at desc);

alter table hostels enable row level security;
alter table vendors enable row level security;
alter table menu_items enable row level security;
alter table slots enable row level security;
alter table orders enable row level security;
alter table restock_logs enable row level security;

-- ============ HELPERS ============

create or replace function fee_for_order_count(order_count integer)
returns numeric
language sql
immutable
as $$
  select case
    when order_count <= 0 then 20
    when order_count <= 2 then 20
    when order_count <= 5 then 10
    when order_count <= 10 then 5
    else 0
  end;
$$;

-- ============ TRANSACTIONAL RPCs ============

create or replace function close_slot(p_slot_id uuid)
returns jsonb
language plpgsql
as $$
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
$$;

create or replace function place_order(
  p_slot_id uuid,
  p_student_name text,
  p_block text,
  p_room text,
  p_tip numeric,
  p_payment_method text,
  p_note text,
  p_items jsonb
)
returns orders
language plpgsql
as $$
declare
  v_slot slots;
  v_item jsonb;
  v_menu_item_id uuid;
  v_qty integer;
  v_updated menu_items;
  v_order orders;
begin
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
$$;

create or replace function restock_item(p_item_id uuid, p_amount integer)
returns jsonb
language plpgsql
as $$
declare
  v_item menu_items;
  v_log restock_logs;
begin
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
$$;

create or replace function dispatch_slot(p_slot_id uuid)
returns slots
language plpgsql
as $$
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
$$;
