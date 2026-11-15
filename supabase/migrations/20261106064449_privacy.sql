-- A student's rights over their own data (India's Digital Personal Data Protection Act):
--   api_export_my_data    everything Poolit holds about the signed-in student, as one JSON document
--   api_delete_my_account erase the account
--
-- Deleting removes the login account, the saved profile and the retry keys. The student's orders
-- are KEPT, because the store still needs them for its accounts and Poolit for its commission
-- records, but the name, block, room, note and the link to the account are removed, so what
-- remains no longer identifies the person: amounts, items, dates and status stay.
-- A student cannot delete while an order is still on its way; store and team accounts are
-- removed by the Poolit team, not through this call.

create or replace function public.api_export_my_data()
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
  v_email text;
begin
  select phone, email into v_phone, v_email from auth.users where id = v_uid;
  select * into s from students where user_id = v_uid;
  return jsonb_build_object(
    'exportedAt', now(),
    'account', jsonb_strip_nulls(jsonb_build_object('userId', v_uid, 'phone', v_phone, 'email', v_email)),
    'profile', case when s.user_id is null then null else jsonb_strip_nulls(jsonb_build_object(
        'name', s.name, 'hostelId', s.hostel_id, 'block', s.block, 'room', s.room, 'createdAt', s.created_at)) end,
    'orders', coalesce((select jsonb_agg(private.json_order(o) order by o.created_at desc)
                        from orders o where o.student_id = v_uid), '[]'::jsonb));
end;
$function$;

create or replace function public.api_delete_my_account(p_confirm text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := private.require_user();
begin
  if p_confirm is distinct from 'DELETE' then
    perform private.fail(400, 'Type DELETE to confirm that you want your account deleted');
  end if;
  if exists (select 1 from vendor_users where user_id = v_uid) or private.is_platform_admin() then
    perform private.fail(403, 'Store and team accounts are removed by the Poolit team');
  end if;
  if not exists (select 1 from auth.users where id = v_uid) then
    perform private.fail(404, 'Account not found');
  end if;
  if exists (select 1 from orders where student_id = v_uid and status in ('placed', 'pooled', 'dispatched')) then
    perform private.fail(409, 'You have an order in progress. You can delete your account once it is delivered.');
  end if;

  update orders
     set student_name = 'Deleted student', block = null, room = null, note = null, student_id = null, updated_at = now()
   where student_id = v_uid;
  delete from idempotency_keys where scope like v_uid::text || ':%';
  delete from students where user_id = v_uid;
  delete from auth.users where id = v_uid;
  return jsonb_build_object('deleted', true);
end;
$function$;

revoke all on function public.api_export_my_data() from public, anon, authenticated;
grant execute on function public.api_export_my_data() to authenticated;
revoke all on function public.api_delete_my_account(text) from public, anon, authenticated;
grant execute on function public.api_delete_my_account(text) to authenticated;
