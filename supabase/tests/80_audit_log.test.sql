-- Audit log: every change to a business table is recorded (who, when, what), personal data is
-- never copied into it, only Poolit admins can read it, and deleting an account leaves no trace
-- of the person. Uses the t.* helpers from 10_api_security.test.sql.

do $$
declare
  h uuid; v uuid; i uuid; own uuid; adm uuid; sA uuid; slot uuid; oA jsonb; r jsonb;
  mark bigint; n integer; a bigint; b bigint; page1 jsonb; page2 jsonb;
begin
  update vendors set accepting_orders = true;
  select coalesce(max(id), 0) into mark from audit_log;
  insert into hostels (name) values ('Audit Hostel') returning id into h;
  insert into vendors (name, hostel_id) values ('Audit Store', h) returning id into v;
  insert into menu_items (vendor_id, name, category, price, unit, stock_qty) values (v, 'Audit Chips', 'Snacks', 30, '50 g', 50) returning id into i;
  insert into auth.users (email) values ('a-owner@example.com') returning id into own;
  insert into auth.users (email) values ('a-admin@example.com') returning id into adm;
  insert into auth.users (email, phone) values (null, '+919500000001') returning id into sA;
  insert into vendor_users (user_id, vendor_id, role) values (own, v, 'owner');
  insert into platform_admins (user_id) values (adm);
  insert into t.ids values ('a_h', h), ('a_v', v), ('a_i', i), ('a_owner', own), ('a_admin', adm), ('a_A', sA);

  -- ---- changes made straight in the database are recorded too ----
  perform t.ok(exists (select 1 from audit_log where id > mark and table_name = 'vendors' and op = 'INSERT' and row_id = v::text and actor is null), 'a store created in the SQL editor is logged, with no signed-in user');
  perform t.ok(exists (select 1 from audit_log where id > mark and table_name = 'platform_admins' and op = 'INSERT' and row_id = adm::text), 'so is making someone a Poolit admin');
  perform t.ok(exists (select 1 from audit_log where id > mark and table_name = 'vendor_users' and op = 'INSERT' and row_id = own::text || ':' || v::text), 'and linking a login to a store');

  perform t.ok(not has_table_privilege('authenticated', 'public.audit_log', 'select,insert,update,delete')
           and not has_table_privilege('anon', 'public.audit_log', 'select,insert,update,delete'), 'the log is closed to the public roles');

  -- ---- an owner changes a price ----
  select coalesce(max(id), 0) into mark from audit_log;
  perform t.as_user('a_owner');
  perform api_update_menu_item(i, '{"price": 35}');
  perform t.as_admin();
  perform t.ok((select count(*) from audit_log where id > mark and table_name = 'menu_items' and op = 'UPDATE' and row_id = i::text and actor = own
                  and (old_values->>'price')::numeric = 30 and (new_values->>'price')::numeric = 35) = 1, 'a price change is logged with who, the old price and the new price');
  perform t.ok((select count(*) from audit_log where id > mark and table_name = 'menu_items') = 1 and (select not (new_values ? 'updated_at') from audit_log where id > mark and table_name = 'menu_items'), 'and only the columns that changed');

  select coalesce(max(id), 0) into mark from audit_log;
  perform t.as_user('a_owner');
  perform api_update_menu_item(i, '{"price": 35}');
  perform t.as_admin();
  perform t.ok((select count(*) from audit_log where id > mark) = 0, 'saving the same price again writes nothing');

  -- ---- a student places an order ----
  perform t.as_anon();
  slot := (api_current_slot(h)->'slot'->>'id')::uuid;
  perform t.as_admin();
  select coalesce(max(id), 0) into mark from audit_log;
  perform t.as_user('a_A');
  perform api_update_me('Anaya Sharma', h, 'A', '204');
  oA := api_place_order(slot, 'Anaya Sharma', jsonb_build_array(jsonb_build_object('menuItemId', i, 'qty', 2)), 'A', '204', 10, 'Cash on delivery', 'secret gate note');
  perform t.as_admin();
  perform t.ok((select count(*) from audit_log where id > mark and table_name = 'orders' and op = 'INSERT' and row_id = oA->>'id' and actor = sA) = 1, 'the order is logged against the student who placed it');
  perform t.ok((select new_values->>'student_name' = '***' and new_values->>'room' = '***' and new_values->>'note' = '***' and new_values->>'block' = '***' from audit_log where id > mark and table_name = 'orders' and op = 'INSERT'), 'with name, block, room and note masked');
  perform t.ok((select not (new_values ? 'items') and new_values->>'payment_method' = 'Cash on delivery' from audit_log where id > mark and table_name = 'orders' and op = 'INSERT'), 'the item list is left out, the payment method is kept');
  perform t.ok(exists (select 1 from audit_log where id > mark and table_name = 'students' and row_id = sA::text), 'the profile save is logged');
  perform t.ok(not exists (select 1 from audit_log where id > mark and (old_values::text like '%Anaya%' or new_values::text like '%Anaya%' or new_values::text like '%secret gate%' or new_values::text like '%919500000001%')), 'and no personal data is in the log');
  perform t.ok(not exists (select 1 from audit_log where id > mark and table_name = 'menu_items'), 'the stock count falling with each order is not logged as a change');

  -- ---- the store runs the order ----
  select coalesce(max(id), 0) into mark from audit_log;
  perform t.as_user('a_owner');
  perform api_restock_item(i, 10);
  perform t.as_user('a_admin');
  perform api_set_fee_terms(v, 'percent', 5);
  perform t.as_user('a_owner');
  perform api_close_slot(slot);
  perform api_dispatch_slot(slot);
  perform api_mark_delivered((oA->>'id')::uuid);
  perform t.as_admin();
  perform t.ok(exists (select 1 from audit_log where id > mark and table_name = 'restock_logs' and op = 'INSERT' and actor = own), 'a restock is logged');
  perform t.ok(exists (select 1 from audit_log where id > mark and table_name = 'vendor_fee_terms' and op = 'INSERT' and actor = adm and (new_values->>'fee_value')::numeric = 5), 'setting a store''s fee is logged against the admin');
  perform t.ok((select count(*) from audit_log where id > mark and table_name = 'orders' and op = 'UPDATE' and row_id = oA->>'id' and actor = own and new_values ? 'status') = 3, 'closing, dispatching and delivering are three logged steps by the owner');
  perform t.ok((select string_agg(new_values->>'status', ',' order by id) from audit_log where id > mark and table_name = 'orders' and op = 'UPDATE' and new_values ? 'status') = 'pooled,dispatched,delivered', 'in the right order');
  perform t.ok(exists (select 1 from audit_log where id > mark and table_name = 'order_fee_ledger' and op = 'INSERT' and row_id = oA->>'id'), 'the commission line is logged');
  perform t.ok(exists (select 1 from audit_log where id > mark and table_name = 'slots' and op = 'UPDATE' and row_id = slot::text and new_values->>'status' = 'dispatched'), 'and the pool changing state');

  -- ---- a database administrator editing directly ----
  select coalesce(max(id), 0) into mark from audit_log;
  update menu_items set name = 'Audit Chips Large' where id = i;
  perform t.ok((select count(*) from audit_log where id > mark and table_name = 'menu_items' and actor is null and old_values->>'name' = 'Audit Chips' and new_values->>'name' = 'Audit Chips Large') = 1, 'a direct edit is logged with no signed-in user');
  perform t.ok((select actor_role from audit_log where id > mark and table_name = 'menu_items') not in ('none', ''), 'and the database role that made it');
  delete from vendor_users where user_id = own and vendor_id = v;
  perform t.ok(exists (select 1 from audit_log where id > mark and table_name = 'vendor_users' and op = 'DELETE'), 'removing a store login is logged');
  insert into vendor_users (user_id, vendor_id, role) values (own, v, 'owner');

  -- ---- reading the log ----
  perform t.as_user('a_admin');
  perform t.ok(api_is_admin(), 'an admin is recognised');
  r := api_audit_log();
  perform t.ok(jsonb_array_length(r) between 1 and 100, 'the default page is at most 100 entries');
  perform t.ok((r->0->>'id')::bigint > (r->1->>'id')::bigint, 'newest first');
  r := api_audit_log('vendor_fee_terms', v::text);
  perform t.ok(jsonb_array_length(r) = 1 and r->0->>'actorEmail' = 'a-admin@example.com' and r->0->>'op' = 'INSERT', 'filtering by table and row shows who made the change by email');
  perform t.ok(jsonb_array_length(api_audit_log(null, null, sA)) >= 1 and not exists (select 1 from jsonb_array_elements(api_audit_log(null, null, sA)) e where e->>'actor' <> sA::text), 'filtering by person shows only theirs');
  perform t.ok(jsonb_array_length(api_audit_log(null, oA->>'id')) >= 4, 'filtering by row shows an order''s whole history');
  page1 := api_audit_log(null, null, null, null, 3);
  a := (page1->2->>'id')::bigint;
  page2 := api_audit_log(null, null, null, a, 3);
  perform t.ok(jsonb_array_length(page1) = 3 and jsonb_array_length(page2) = 3 and (page2->0->>'id')::bigint < a, 'paging backwards does not repeat entries');
  perform t.ok(jsonb_array_length(api_audit_log(null, null, null, null, 100000)) <= 500, 'a page is capped at 500 entries');
  perform t.ok(api_audit_log()::text not like '%Anaya%', 'the admin view holds no student names');

  perform t.as_user('a_owner');
  perform t.ok(not api_is_admin(), 'a store owner is not an admin');
  perform t.throws('PT403', 'select api_audit_log()');
  perform t.as_user('a_A');
  perform t.throws('PT403', 'select api_audit_log()');
  perform t.as_anon();
  perform t.throws('42501', 'select api_audit_log()');
  perform t.throws('42501', 'select api_is_admin()');

  -- ---- nobody can write to, or tidy, the log ----
  perform t.as_user('a_owner');
  perform t.throws('42501', $q$ insert into audit_log (table_name, op) values ('x', 'INSERT') $q$);
  perform t.throws('42501', 'select purge_audit_log()');
  perform t.throws('42501', 'delete from audit_log');

  -- ---- retention ----
  perform t.as_admin();
  insert into audit_log (at, table_name, op) values (now() - interval '181 days', 'old_test', 'INSERT'), (now() - interval '10 days', 'recent_test', 'INSERT');
  n := purge_audit_log();
  perform t.ok(n >= 1 and not exists (select 1 from audit_log where table_name = 'old_test') and exists (select 1 from audit_log where table_name = 'recent_test'), 'entries older than 180 days are purged, recent ones stay');
  perform t.ok(exists (select 1 from cron.job where jobname = 'poolit-purge-audit-log'), 'and the purge runs on a schedule');

  -- ---- deleting an account leaves no trace of the person ----
  select coalesce(max(id), 0) into mark from audit_log;
  perform t.ok(exists (select 1 from audit_log where actor = sA), 'before deletion the student''s actions are attributed to them');
  perform t.as_user('a_A');
  perform api_delete_my_account('DELETE');
  perform t.as_admin();
  perform t.ok(not exists (select 1 from audit_log where actor = sA), 'afterwards no log entry points at them');
  perform t.ok(not exists (select 1 from audit_log where table_name = 'students' and row_id = sA::text), 'nor holds their profile row id');
  perform t.ok(not exists (select 1 from audit_log where old_values::text like '%Anaya%' or new_values::text like '%Anaya%' or new_values::text like '%secret gate%'), 'nor any personal data');
  perform t.ok(exists (select 1 from audit_log where id > mark and table_name = 'students' and op = 'DELETE' and row_id is null and actor is null), 'but it records that an account was deleted');
  perform t.ok((select count(*) from audit_log where table_name = 'orders' and row_id = oA->>'id') >= 4, 'and the order''s history is kept for the accounts');
end $$;
