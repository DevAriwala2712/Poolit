-- Daily orders and goods revenue for the signed-in vendor's stores (the console's Analytics
-- chart), so the chart works without the Express backend. Same shape as GET /vendor/revenue.
-- Uses the prices frozen at sale; cancelled orders are not revenue and are left out.

create or replace function public.api_vendor_revenue(p_days integer default 7)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := private.require_user();
  v_days integer := least(greatest(coalesce(p_days, 7), 1), 92);
  v_ids uuid[];
begin
  select array_agg(vendor_id order by vendor_id) into v_ids from vendor_users where user_id = v_uid;
  if v_ids is null then
    perform private.fail(403, 'This account isn''t a vendor account');
  end if;
  return jsonb_build_object('days', v_days, 'stores', (
    select jsonb_agg(jsonb_build_object('vendorId', v.id, 'days', (
             select jsonb_agg(jsonb_build_object('day', d.day, 'orders', coalesce(x.orders, 0), 'revenue', coalesce(x.revenue, 0)) order by d.day)
               from generate_series((now() at time zone 'Asia/Kolkata')::date - (v_days - 1),
                                    (now() at time zone 'Asia/Kolkata')::date, interval '1 day') as d(day)
               left join (
                 select (o.created_at at time zone 'Asia/Kolkata')::date as day, count(*) as orders,
                        coalesce(sum(o.subtotal_paise), 0)::numeric / 100 as revenue
                   from orders o join slots s on s.id = o.slot_id
                  where s.vendor_id = v.id and o.status <> 'cancelled'
                    and o.created_at >= now() - make_interval(days => v_days + 1)
                  group by 1) x on x.day = d.day::date))
           order by v.id)
      from unnest(v_ids) as v(id)));
end;
$function$;

revoke all on function public.api_vendor_revenue(integer) from public, anon, authenticated;
grant execute on function public.api_vendor_revenue(integer) to authenticated;
