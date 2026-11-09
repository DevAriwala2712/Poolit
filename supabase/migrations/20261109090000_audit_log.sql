-- Audit log: a durable record of every change to the business tables.
--
-- WHY TRIGGERS: every write to a table is recorded here no matter how it got there: an api_*
-- function called by the apps, the cron jobs, or someone editing in the Supabase SQL editor.
-- Nothing has to remember to log, so nothing can forget.
--
-- WHAT IS RECORDED: who (the signed-in user, or null for the database itself), when, which table
-- and row, the operation, and for updates only the columns that changed (old and new value).
-- Reads are not recorded here; sign-ins are in Supabase's own Auth logs.
--
-- WHAT IS DELIBERATELY NOT RECORDED
--   * Personal data. A student's name, phone, block, room and order note are replaced by '***'
--     (the change is still visible, the value is not), so deleting an account (api_delete_my_account)
--     does not leave personal data behind in this log. api_delete_my_account also clears the
--     user id from older entries.
--   * The order's item list (it lives on the order row) and menu stock_qty, which changes on every
--     order. Stock a store changes by hand is recorded through stock_adjustments and restock_logs.
--   * idempotency_keys (retry bookkeeping).
--
-- KEPT FOR 180 DAYS (purge job below), the period commonly required for security logs. At large
-- scale this table grows by roughly 1.5 KB per order: export it before purging, or move to a paid plan.
-- Readable only by Poolit admins, through api_audit_log.

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_role text,
  table_name text not null,
  op text not null check (op in ('INSERT', 'UPDATE', 'DELETE')),
  row_id text,
  old_values jsonb,
  new_values jsonb
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_row_idx on public.audit_log (table_name, row_id, at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor, at desc) where actor is not null;

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;

-- ============ The trigger ============

-- Drops the skipped columns and replaces the masked ones with '***'.
create or replace function private.audit_clean(j jsonb, p_mask text[], p_skip text[])
 returns jsonb language sql immutable set search_path = public, pg_temp
as $function$
  select coalesce(jsonb_object_agg(e.k, case when e.k = any(p_mask) then to_jsonb('***'::text) else e.v end), '{}'::jsonb)
    from jsonb_each(j) e(k, v)
   where e.k <> all(p_skip)
$function$;

-- Arguments: 0 = comma list of columns to mask, 1 = comma list of columns to leave out.
create or replace function private.audit_row()
 returns trigger
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_mask text[] := string_to_array(coalesce(TG_ARGV[0], ''), ',');
  v_skip text[] := string_to_array(coalesce(TG_ARGV[1], ''), ',');
  v_old jsonb;
  v_new jsonb;
  v_src jsonb;
  v_actor uuid;
  v_role text;
  v_id text;
  v_old_diff jsonb;
  v_new_diff jsonb;
begin
  if TG_OP in ('UPDATE', 'DELETE') then v_old := private.audit_clean(to_jsonb(OLD), v_mask, v_skip); end if;
  if TG_OP in ('INSERT', 'UPDATE') then v_new := private.audit_clean(to_jsonb(NEW), v_mask, v_skip); end if;

  v_src := coalesce(to_jsonb(NEW), to_jsonb(OLD));
  v_id := coalesce(v_src->>'id', v_src->>'order_id',
                   case when v_src ? 'user_id' and v_src ? 'vendor_id' then (v_src->>'user_id') || ':' || (v_src->>'vendor_id') end,
                   v_src->>'user_id', v_src->>'vendor_id');

  if TG_OP = 'UPDATE' then
    -- only what changed; a write that changes nothing but updated_at is not worth a row
    select jsonb_object_agg(e.k, v_old->e.k), jsonb_object_agg(e.k, e.v)
      into v_old_diff, v_new_diff
      from jsonb_each(v_new) e(k, v)
     where e.k <> 'updated_at' and (v_old->e.k) is distinct from e.v;
    if v_new_diff is null then return null; end if;
    v_old := v_old_diff;
    v_new := v_new_diff;
  end if;

  begin v_actor := auth.uid(); exception when others then v_actor := null; end;
  begin
    v_role := nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role';
  exception when others then v_role := null; end;
  -- 'none' is what Postgres reports when no role has been switched to (the SQL editor, cron)
  v_role := coalesce(v_role, case when coalesce(current_setting('role', true), '') in ('', 'none') then null else current_setting('role', true) end, session_user);

  begin
    insert into audit_log (actor, actor_role, table_name, op, row_id, old_values, new_values)
    values (v_actor, v_role, TG_TABLE_NAME, TG_OP, v_id, v_old, v_new);
  exception when others then
    -- A logging fault must never stop an order or a restock; it shows up in the Postgres logs.
    raise warning 'audit_row failed on %: %', TG_TABLE_NAME, sqlerrm;
  end;
  return null;
end;
$function$;

revoke all on all functions in schema private from public, anon, authenticated;

-- ============ Attach it to every business table ============

do $do$
declare
  t record;
begin
  for t in
    select * from (values
      ('orders',            'student_name,block,room,note,student_id', 'items'),
      ('students',          'name,phone,block,room',                   ''),
      ('slots',             '',                                        ''),
      ('menu_items',        '',                                        'stock_qty'),
      ('vendors',           '',                                        ''),
      ('staff',             'name,email',                              ''),
      ('vendor_users',      '',                                        ''),
      ('vendor_fee_terms',  '',                                        ''),
      ('order_fee_ledger',  '',                                        ''),
      ('platform_admins',   '',                                        ''),
      ('stock_adjustments', '',                                        ''),
      ('restock_logs',      '',                                        ''),
      ('hostels',           '',                                        '')
    ) as x(tbl, mask, skip)
  loop
    execute format('drop trigger if exists audit_row_ins_del on public.%I', t.tbl);
    execute format('drop trigger if exists audit_row_upd on public.%I', t.tbl);
    execute format(
      'create trigger audit_row_ins_del after insert or delete on public.%I for each row execute function private.audit_row(%L, %L)',
      t.tbl, t.mask, t.skip);
    execute format(
      'create trigger audit_row_upd after update on public.%I for each row when (old.* is distinct from new.*) execute function private.audit_row(%L, %L)',
      t.tbl, t.mask, t.skip);
  end loop;
end
$do$;

-- ============ Reading it (Poolit admins only) ============

create or replace function public.api_is_admin()
 returns boolean
 language plpgsql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
begin
  perform private.require_user();
  return private.is_platform_admin();
end;
$function$;

-- Newest first. Page backwards by passing the smallest id of the previous page as p_before.
create or replace function public.api_audit_log(
  p_table text default null, p_row_id text default null, p_actor uuid default null,
  p_before bigint default null, p_limit integer default 100)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  perform private.require_user();
  if not private.is_platform_admin() then
    perform private.fail(403, 'Only the Poolit team can read the activity log');
  end if;
  return coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'id', x.id, 'at', private.ms(x.at), 'actor', x.actor, 'actorEmail', x.email, 'actorRole', x.actor_role,
             'table', x.table_name, 'op', x.op, 'rowId', x.row_id, 'old', x.old_values, 'new', x.new_values))
           order by x.id desc)
      from (select a.*, u.email
              from audit_log a left join auth.users u on u.id = a.actor
             where (p_table is null or a.table_name = p_table)
               and (p_row_id is null or a.row_id = p_row_id)
               and (p_actor is null or a.actor = p_actor)
               and (p_before is null or a.id < p_before)
             order by a.id desc limit v_limit) x), '[]'::jsonb);
end;
$function$;

revoke all on function public.api_is_admin() from public, anon, authenticated;
grant execute on function public.api_is_admin() to authenticated;
revoke all on function public.api_audit_log(text, text, uuid, bigint, integer) from public, anon, authenticated;
grant execute on function public.api_audit_log(text, text, uuid, bigint, integer) to authenticated;

-- ============ Retention ============

create or replace function public.purge_audit_log()
 returns integer
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  n integer;
begin
  delete from audit_log where at < now() - interval '180 days';
  get diagnostics n = row_count;
  return n;
end;
$function$;

revoke all on function public.purge_audit_log() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'poolit-purge-audit-log';
select cron.schedule('poolit-purge-audit-log', '30 3 * * *', $$select public.purge_audit_log()$$);

-- ============ Deleting an account leaves no personal data in the log ============

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

  -- The log keeps that this happened, not who it was.
  update audit_log set actor = null where actor = v_uid;
  delete from audit_log where table_name = 'students' and row_id = v_uid::text;
  insert into audit_log (actor, actor_role, table_name, op, row_id)
  values (null, 'authenticated', 'students', 'DELETE', null);
  return jsonb_build_object('deleted', true);
end;
$function$;

revoke all on function public.api_delete_my_account(text) from public, anon, authenticated;
grant execute on function public.api_delete_my_account(text) to authenticated;
