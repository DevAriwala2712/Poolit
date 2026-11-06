-- Cash on delivery and per-store commission (Phase 1, week 2).
--
-- CASH ON DELIVERY
--   Store staff deliver the orders, so cash changes hands at the door. When a cash on
--   delivery order is handed over, the cash received is recorded against the order
--   (by default the amount due; staff can enter a different amount if the student paid
--   less or more). api_cash_summary gives each store its day: how much cash it should
--   have, how much it recorded, and which cash orders are still out.
--   Amount due = goods (frozen at the time of sale) + the locked delivery fee + the
--   platform fee + tip. The platform fee must match PLATFORM_FEE in
--   frontend/packages/domain/src/constants.ts.
--
-- COMMISSION
--   How Poolit is paid by each store is not decided yet (a percentage of goods, or a
--   fixed amount per order), so both are supported per store and may be changed at
--   any time. Only a platform admin (a row in platform_admins, added by the Poolit
--   team in the database) can set a store's terms. Every order that is delivered while
--   terms are in force writes one ledger row with a snapshot of the terms, so past rows
--   never change when terms change. api_fee_statement totals the ledger for a date
--   range: the basis of a monthly statement to a store. With no terms, nothing is written.

-- ============ Tables ============

alter table public.orders
  add column if not exists cash_collected_paise integer check (cash_collected_paise is null or cash_collected_paise >= 0),
  add column if not exists cash_collected_at timestamptz,
  add column if not exists cash_collected_by uuid references auth.users (id) on delete set null;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.vendor_fee_terms (
  vendor_id uuid primary key references public.vendors (id) on delete cascade,
  fee_type text not null check (fee_type in ('percent', 'fixed_per_order')),
  fee_value numeric not null check (fee_value >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table if not exists public.order_fee_ledger (
  order_id uuid primary key references public.orders (id),
  vendor_id uuid not null references public.vendors (id),
  goods_paise integer not null check (goods_paise >= 0),
  fee_paise integer not null check (fee_paise >= 0),
  fee_type text not null,
  fee_value numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists order_fee_ledger_vendor_created_idx on public.order_fee_ledger (vendor_id, created_at);

alter table public.platform_admins enable row level security;
alter table public.vendor_fee_terms enable row level security;
alter table public.order_fee_ledger enable row level security;
revoke all on public.platform_admins from anon, authenticated;
revoke all on public.vendor_fee_terms from anon, authenticated;
revoke all on public.order_fee_ledger from anon, authenticated;

-- ============ Helpers ============

-- Must match PLATFORM_FEE (rupees) in frontend/packages/domain/src/constants.ts.
create or replace function private.platform_fee_paise()
 returns integer language sql immutable set search_path = public, pg_temp
as $function$ select 400 $function$;

create or replace function private.is_cod(p_payment_method text)
 returns boolean language sql immutable set search_path = public, pg_temp
as $function$
  select p_payment_method is not null
     and (lower(btrim(p_payment_method)) = 'cod' or lower(btrim(p_payment_method)) like 'cash%')
$function$;

-- What the student pays in total, once the pool has closed and the delivery fee is locked.
create or replace function private.amount_due_paise(o orders)
 returns integer language sql stable set search_path = public, pg_temp
as $function$
  select case when o.delivery_fee_charged is null or o.subtotal_paise is null then null
    else o.subtotal_paise + round((o.delivery_fee_charged + coalesce(o.tip, 0)) * 100)::integer + private.platform_fee_paise() end
$function$;

create or replace function private.is_platform_admin()
 returns boolean language sql stable set search_path = public, pg_temp
as $function$ select exists (select 1 from platform_admins where user_id = auth.uid()) $function$;

revoke all on all functions in schema private from public, anon, authenticated;

-- ============ Orders now show what is due and what was collected ============

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
    'amountDuePaise', private.amount_due_paise(r),
    'cashCollectedPaise', r.cash_collected_paise,
    'cashCollectedAt', private.ms(r.cash_collected_at),
    'status', r.status, 'createdAt', private.ms(r.created_at),
    'deliveryFeeCharged', r.delivery_fee_charged))
$function$;

-- ============ Handing over an order: cash and commission ============

drop function if exists public.api_mark_delivered(uuid);

create or replace function public.api_mark_delivered(p_order_id uuid, p_cash_collected_paise integer default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_vendor uuid := private.vendor_of_order(p_order_id);
  v_order orders;
  v_status text;
  v_payment text;
  v_cod boolean;
  v_terms vendor_fee_terms;
  v_fee integer;
begin
  perform private.require_vendor(v_vendor);

  select payment_method into v_payment from orders where id = p_order_id;
  v_cod := private.is_cod(v_payment);
  if p_cash_collected_paise is not null then
    if not v_cod then
      perform private.fail(400, 'Cash can only be recorded for cash on delivery orders');
    end if;
    if p_cash_collected_paise < 0 or p_cash_collected_paise > 5000000 then
      perform private.fail(400, 'Cash collected must be between 0 and 50,000 rupees');
    end if;
  end if;

  -- One conditional update, so two taps at once cannot both succeed.
  update orders o set
      status = 'delivered', updated_at = now(),
      cash_collected_paise = case when v_cod then coalesce(p_cash_collected_paise, private.amount_due_paise(o)) end,
      cash_collected_at = case when v_cod then now() end,
      cash_collected_by = case when v_cod then auth.uid() end
    where o.id = p_order_id and o.status = 'dispatched'
    returning * into v_order;
  if not found then
    select status into v_status from orders where id = p_order_id;
    perform private.fail(409, 'Cannot mark delivered: order is currently "' || coalesce(v_status, '?') || '". Expected "dispatched".');
  end if;

  -- Commission: one ledger row per delivered order, a snapshot of the terms in force.
  select * into v_terms from vendor_fee_terms where vendor_id = v_vendor;
  if found then
    v_fee := case v_terms.fee_type
      when 'percent' then round(coalesce(v_order.subtotal_paise, 0) * v_terms.fee_value / 100)::integer
      else round(v_terms.fee_value * 100)::integer end;
    insert into order_fee_ledger (order_id, vendor_id, goods_paise, fee_paise, fee_type, fee_value)
    values (v_order.id, v_vendor, coalesce(v_order.subtotal_paise, 0), v_fee, v_terms.fee_type, v_terms.fee_value)
    on conflict (order_id) do nothing;
  end if;

  return jsonb_build_object('message', 'Order marked as delivered', 'order', private.json_order(v_order));
end;
$function$;

revoke all on function public.api_mark_delivered(uuid, integer) from public, anon, authenticated;
grant execute on function public.api_mark_delivered(uuid, integer) to authenticated;

-- ============ The store's daily cash summary ============

create or replace function public.api_cash_summary(p_vendor_id uuid, p_day date default null)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_day date := coalesce(p_day, (now() at time zone 'Asia/Kolkata')::date);
  v_count integer;
  v_expected bigint;
  v_collected bigint;
  v_out_count integer;
  v_out_paise bigint;
begin
  perform private.require_vendor(p_vendor_id);

  select count(*), coalesce(sum(private.amount_due_paise(o)), 0), coalesce(sum(o.cash_collected_paise), 0)
    into v_count, v_expected, v_collected
    from orders o join slots s on s.id = o.slot_id
    where s.vendor_id = p_vendor_id and private.is_cod(o.payment_method) and o.status = 'delivered'
      and (o.cash_collected_at at time zone 'Asia/Kolkata')::date = v_day;

  select count(*), coalesce(sum(private.amount_due_paise(o)), 0)
    into v_out_count, v_out_paise
    from orders o join slots s on s.id = o.slot_id
    where s.vendor_id = p_vendor_id and private.is_cod(o.payment_method) and o.status = 'dispatched';

  return jsonb_build_object(
    'day', v_day,
    'deliveredCount', v_count,
    'expectedPaise', v_expected,
    'collectedPaise', v_collected,
    'differencePaise', v_collected - v_expected,
    'outstandingCount', v_out_count,
    'outstandingPaise', v_out_paise,
    'outstanding', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'orderId', x.id, 'studentName', x.student_name, 'block', x.block, 'room', x.room,
               'amountDuePaise', private.amount_due_paise(x))) order by x.created_at)
        from (select o.* from orders o join slots s on s.id = o.slot_id
               where s.vendor_id = p_vendor_id and private.is_cod(o.payment_method) and o.status = 'dispatched'
               order by o.created_at limit 50) x), '[]'::jsonb));
end;
$function$;

revoke all on function public.api_cash_summary(uuid, date) from public, anon, authenticated;
grant execute on function public.api_cash_summary(uuid, date) to authenticated;

-- ============ Commission terms and statement ============

create or replace function public.api_set_fee_terms(p_vendor_id uuid, p_fee_type text, p_fee_value numeric)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_row vendor_fee_terms;
begin
  perform private.require_user();
  if not private.is_platform_admin() then
    perform private.fail(403, 'Only the Poolit team can set fees');
  end if;
  if p_fee_type is null or p_fee_type not in ('percent', 'fixed_per_order') then
    perform private.fail(400, 'fee type must be "percent" or "fixed_per_order"');
  end if;
  if p_fee_value is null or p_fee_value < 0
     or (p_fee_type = 'percent' and p_fee_value > 50)
     or (p_fee_type = 'fixed_per_order' and p_fee_value > 100) then
    perform private.fail(400, 'fee value out of range (percent 0 to 50, fixed 0 to 100 rupees)');
  end if;
  if not exists (select 1 from vendors where id = p_vendor_id) then
    perform private.fail(404, 'Vendor not found');
  end if;

  insert into vendor_fee_terms (vendor_id, fee_type, fee_value, updated_at, updated_by)
  values (p_vendor_id, p_fee_type, p_fee_value, now(), auth.uid())
  on conflict (vendor_id) do update
    set fee_type = excluded.fee_type, fee_value = excluded.fee_value, updated_at = now(), updated_by = auth.uid()
  returning * into v_row;

  return jsonb_build_object('vendorId', v_row.vendor_id, 'feeType', v_row.fee_type,
                            'feeValue', v_row.fee_value, 'updatedAt', v_row.updated_at);
end;
$function$;

revoke all on function public.api_set_fee_terms(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.api_set_fee_terms(uuid, text, numeric) to authenticated;

create or replace function public.api_fee_statement(p_vendor_id uuid, p_from date, p_to date)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_terms vendor_fee_terms;
  v_orders integer;
  v_goods bigint;
  v_fee bigint;
begin
  perform private.require_user();
  -- The store's owner, or the Poolit team.
  if not private.is_platform_admin() then
    perform private.require_vendor(p_vendor_id, true);
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    perform private.fail(400, 'Choose a date range of at most a year, start before end');
  end if;

  select * into v_terms from vendor_fee_terms where vendor_id = p_vendor_id;
  select count(*), coalesce(sum(goods_paise), 0), coalesce(sum(fee_paise), 0)
    into v_orders, v_goods, v_fee
    from order_fee_ledger
    where vendor_id = p_vendor_id
      and (created_at at time zone 'Asia/Kolkata')::date between p_from and p_to;

  return jsonb_build_object('vendorId', p_vendor_id, 'from', p_from, 'to', p_to,
    'terms', case when v_terms.vendor_id is null then null
                  else jsonb_build_object('feeType', v_terms.fee_type, 'feeValue', v_terms.fee_value) end,
    'orders', v_orders, 'goodsPaise', v_goods, 'commissionPaise', v_fee);
end;
$function$;

revoke all on function public.api_fee_statement(uuid, date, date) from public, anon, authenticated;
grant execute on function public.api_fee_statement(uuid, date, date) to authenticated;
