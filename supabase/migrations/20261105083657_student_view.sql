-- One call for the whole student app (Phase 1, week 2).
--
-- The student app used to load its data with 2 + 2N + 1 requests on every poll
-- (hostels, stores, then each hostel's pool and pool size, then the student's
-- orders; N = hostels with a store: 13 requests with 5 hostels, 37 with 17),
-- although a student only ever uses their own hostel's pool. This returns
-- everything in one request:
--
--   hostels     every hostel (for the hostel pickers)
--   vendors     the chosen hostel's store with its menu, plus the stores of the
--               student's recent orders (so old orders can show names and art)
--   slots       the chosen hostel's current pool, plus the pools of the
--               student's recent orders
--   orders      the signed-in student's own latest 50 orders (none if signed out)
--   poolCounts  how many orders are in the current pool, for everyone
--   hostelId    the hostel that was actually used
--
-- With no hostel, or one that has no store, it uses the first hostel (by name)
-- that has a store. Opens or rotates the pool when needed, like api_current_slot.
-- Other students' orders and names are never included, only the pool's count.

create or replace function public.api_student_view(p_hostel_id uuid default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_hostel uuid;
  v_slot slots;
  v_count integer;
  v_vendor_ids uuid[];
  v_slot_ids uuid[];
  v_order_ids uuid[] := '{}';
begin
  select h.id into v_hostel from hostels h
    where h.id = p_hostel_id and exists (select 1 from vendors v where v.hostel_id = h.id);
  if v_hostel is null then
    select h.id into v_hostel from hostels h
      where exists (select 1 from vendors v where v.hostel_id = h.id)
      order by h.name limit 1;
  end if;

  if v_hostel is not null then
    begin
      v_slot := ensure_open_slot(v_hostel);
    exception when others then
      raise warning 'api_student_view: pool for % failed: %', v_hostel, sqlerrm;
    end;
  end if;

  if v_slot.id is not null then
    select count(*) into v_count from orders where slot_id = v_slot.id and status in ('placed', 'pooled');
  end if;

  if v_uid is not null then
    select coalesce(array_agg(id), '{}') into v_order_ids from (
      select id from orders where student_id = v_uid order by created_at desc limit 50) x;
  end if;

  select array_agg(distinct s.id) into v_slot_ids from slots s
    where s.id = v_slot.id or s.id in (select slot_id from orders where id = any(v_order_ids));
  select array_agg(distinct vid) into v_vendor_ids from (
    select id as vid from vendors where hostel_id = v_hostel
    union
    select vendor_id from slots where id = any(coalesce(v_slot_ids, '{}'))) x;

  return jsonb_build_object(
    'hostelId', to_jsonb(v_hostel),
    'hostels', coalesce((select jsonb_agg(private.json_hostel(h) order by h.name) from hostels h), '[]'::jsonb),
    'vendors', coalesce((select jsonb_agg(private.json_vendor_with_menu(v) order by v.name) from vendors v
                         where v.id = any(coalesce(v_vendor_ids, '{}'))), '[]'::jsonb),
    'slots', coalesce((select jsonb_agg(private.json_slot(s) order by s.opens_at desc) from slots s
                       where s.id = any(coalesce(v_slot_ids, '{}'))), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(private.json_order(o) order by o.created_at desc) from orders o
                        where o.id = any(v_order_ids)), '[]'::jsonb),
    'poolCounts', case when v_slot.id is null then '{}'::jsonb
                       else jsonb_build_object(v_slot.id::text, v_count) end);
end;
$function$;

revoke all on function public.api_student_view(uuid) from public, anon, authenticated;
grant execute on function public.api_student_view(uuid) to anon, authenticated;
