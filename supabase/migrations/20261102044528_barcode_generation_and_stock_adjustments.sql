-- Generated barcodes + quantity tracking by scan (Phase 1).
--
-- 1. generate_item_barcode(item): gives an item without a barcode its own
--    EAN-13 in the GS1 "restricted circulation" range 29xxxxxxxxxxC. That
--    range is reserved for in-store use, so it can never collide with a
--    manufacturer's real product barcode. Codes come from a sequence and are
--    checked for uniqueness across all stores; assignment is atomic and
--    idempotent (an item that already has a barcode keeps it).
-- 2. stock_adjustments + adjust_stock(): set an exact count (stock take) or
--    remove units (damaged, expired, …) atomically, with an audit row holding
--    the before/after quantity and who did it. Restocks keep using
--    restock_item()/restock_logs.

create sequence if not exists public.internal_barcode_seq start 1;

create or replace function public.ean13_check_digit(p_first12 text)
 returns text
 language sql
 immutable
 set search_path = public, pg_temp
as $function$
  select ((10 - (sum(
    substr(p_first12, i, 1)::int * case when i % 2 = 0 then 3 else 1 end
  ) % 10)) % 10)::text
  from generate_series(1, 12) as i;
$function$;

create or replace function public.generate_item_barcode(p_item_id uuid)
 returns menu_items
 language plpgsql
 set search_path = public, pg_temp
as $function$
declare
  v_item menu_items;
  v_base text;
  v_code text;
begin
  select * into v_item from menu_items where id = p_item_id for update;
  if not found then
    raise exception 'ITEM_NOT_FOUND';
  end if;
  if v_item.barcode is not null then
    return v_item;
  end if;

  loop
    v_base := '29' || lpad(nextval('internal_barcode_seq')::text, 10, '0');
    v_code := v_base || ean13_check_digit(v_base);
    exit when not exists (select 1 from menu_items where barcode = v_code);
  end loop;

  update menu_items set barcode = v_code, updated_at = now()
    where id = p_item_id
    returning * into v_item;
  return v_item;
end;
$function$;

create table if not exists public.stock_adjustments (
  id           uuid primary key default gen_random_uuid(),
  vendor_id    uuid not null references public.vendors (id),
  menu_item_id uuid not null references public.menu_items (id),
  user_id      uuid references auth.users (id) on delete set null,
  reason       text not null check (reason in ('count', 'damaged', 'expired', 'correction', 'other')),
  previous_qty integer not null check (previous_qty >= 0),
  new_qty      integer not null check (new_qty >= 0),
  delta        integer generated always as (new_qty - previous_qty) stored,
  note         text check (char_length(note) <= 140),
  at           timestamptz not null default now()
);
create index if not exists stock_adjustments_item_at_idx on public.stock_adjustments (menu_item_id, at desc);
create index if not exists stock_adjustments_vendor_at_idx on public.stock_adjustments (vendor_id, at desc);
alter table public.stock_adjustments enable row level security;
revoke all on public.stock_adjustments from anon, authenticated;

-- p_mode 'set': stock becomes p_qty (stock take).
-- p_mode 'remove': stock drops by p_qty (cannot go below zero).
create or replace function public.adjust_stock(p_item_id uuid, p_mode text, p_qty integer, p_reason text, p_user_id uuid default null, p_note text default null)
 returns jsonb
 language plpgsql
 set search_path = public, pg_temp
as $function$
declare
  v_item menu_items;
  v_new integer;
  v_adj stock_adjustments;
begin
  if p_qty is null or p_qty < 0 or p_qty > 100000 then
    raise exception 'INVALID_QTY';
  end if;

  select * into v_item from menu_items where id = p_item_id for update;
  if not found then
    raise exception 'ITEM_NOT_FOUND';
  end if;

  if p_mode = 'set' then
    v_new := p_qty;
  elsif p_mode = 'remove' then
    if p_qty < 1 then
      raise exception 'INVALID_QTY';
    end if;
    if p_qty > v_item.stock_qty then
      raise exception 'NOT_ENOUGH_STOCK:%', v_item.stock_qty;
    end if;
    v_new := v_item.stock_qty - p_qty;
  else
    raise exception 'INVALID_MODE';
  end if;

  insert into stock_adjustments (vendor_id, menu_item_id, user_id, reason, previous_qty, new_qty, note)
  values (v_item.vendor_id, v_item.id, p_user_id, p_reason, v_item.stock_qty, v_new, nullif(btrim(p_note), ''))
  returning * into v_adj;

  update menu_items set stock_qty = v_new, updated_at = now()
    where id = p_item_id
    returning * into v_item;

  return jsonb_build_object('item', to_jsonb(v_item), 'adjustment', to_jsonb(v_adj));
end;
$function$;

revoke execute on function public.ean13_check_digit(text) from public, anon, authenticated;
revoke execute on function public.generate_item_barcode(uuid) from public, anon, authenticated;
revoke execute on function public.adjust_stock(uuid, text, integer, text, uuid, text) from public, anon, authenticated;
grant execute on function public.ean13_check_digit(text) to service_role;
grant execute on function public.generate_item_barcode(uuid) to service_role;
grant execute on function public.adjust_stock(uuid, text, integer, text, uuid, text) to service_role;
revoke usage, select on sequence public.internal_barcode_seq from anon, authenticated;
grant usage, select on sequence public.internal_barcode_seq to service_role;
