-- Real daily revenue for the Analytics screen (Phase 1).
-- Replaces the console's simulated trend. One row per calendar day (IST) in
-- the window, zero-filled, counting orders that weren't cancelled. Revenue =
-- sum of qty x the item's current price (orders don't yet store the price at
-- sale time; see PRODUCTION_PLAN "money in paise / price at time of sale").
create or replace function public.vendor_daily_revenue(p_vendor_id uuid, p_days integer)
 returns table (day date, orders bigint, revenue numeric)
 language sql
 stable
 set search_path = public, pg_temp
as $function$
  with days as (
    select generate_series(
      (now() at time zone 'Asia/Kolkata')::date - (least(greatest(p_days, 1), 92) - 1),
      (now() at time zone 'Asia/Kolkata')::date,
      interval '1 day'
    )::date as day
  ),
  vendor_orders as (
    select o.id, (o.created_at at time zone 'Asia/Kolkata')::date as day, o.items
    from orders o
    join slots s on s.id = o.slot_id
    where s.vendor_id = p_vendor_id
      and o.created_at >= now() - make_interval(days => least(greatest(p_days, 1), 92) + 1)
  ),
  per_order as (
    select vo.id, vo.day,
      coalesce(sum((line->>'qty')::int * mi.price), 0) as amount
    from vendor_orders vo
    cross join lateral jsonb_array_elements(vo.items) line
    left join menu_items mi on mi.id = (line->>'menuItemId')::uuid
    group by vo.id, vo.day
  )
  select d.day, count(p.id), coalesce(sum(p.amount), 0)
  from days d
  left join per_order p on p.day = d.day
  group by d.day
  order by d.day;
$function$;

revoke execute on function public.vendor_daily_revenue(uuid, integer) from public, anon, authenticated;
grant execute on function public.vendor_daily_revenue(uuid, integer) to service_role;
