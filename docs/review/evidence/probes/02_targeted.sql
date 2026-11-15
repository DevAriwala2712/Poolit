-- Targeted probes. Needs 01_access_matrix.sql to have run first (fixtures and rv schema).
-- Everything runs inside one transaction that is rolled back at the end.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
begin;

-- Run SQL as an actor and return its (text) result or the error.
create or replace function rv.run(p_actor text, p_sql text) returns text language plpgsql as $$
declare v text; v_state text; v_msg text;
begin
  begin
    if p_actor = 'anon' then
      perform set_config('request.jwt.claims', '', true); execute 'set local role anon';
    else
      perform set_config('request.jwt.claims', json_build_object('sub', rv.id(p_actor), 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
    end if;
    execute p_sql into v;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    v := 'ERROR ' || v_state || ': ' || v_msg;
  end;
  execute 'reset role'; perform set_config('request.jwt.claims', '', true);
  return v;
end $$;

\echo == P2 personal data in signed-out and other-student responses (expect all false)
select 'anon api_student_view leaks A: ' || (rv.run('anon', $q$select api_student_view(rv.id('hX'))::text$q$) ~ 'Anaya|9000000001|"room"');
select 'studentB api_student_view leaks A: ' || (rv.run('studentB', $q$select api_student_view(rv.id('hX'))::text$q$) ~ 'Anaya|9000000001|204');
select 'studentB api_my_orders leaks A: ' || (rv.run('studentB', $q$select api_my_orders()::text$q$) ~ 'Anaya');
select 'studentB api_export_my_data leaks A: ' || (rv.run('studentB', $q$select api_export_my_data()::text$q$) ~ 'Anaya|9000000001');
select 'anon api_vendors/api_vendor/api_current_slot leak A: ' || ((rv.run('anon', $q$select api_vendors()::text$q$) || rv.run('anon', $q$select api_vendor(rv.id('vX'))::text$q$) || rv.run('anon', $q$select api_current_slot(rv.id('hX'))::text$q$)) ~ 'Anaya|9000000001');
select 'ownerY api_vendor_overview leaks store X orders: ' || (rv.run('ownerY', $q$select api_vendor_overview()::text$q$) ~ 'Anaya|RV Store X');
\echo == P2b what a signed-out caller learns about a store (keys of a menu item)
select rv.run('anon', $q$select (select string_agg(k, ',') from jsonb_object_keys(api_vendor(rv.id('vX'))->'menu'->0) k)$q$);

\echo == P5 order abuse by one signed-in account
select 'UPI order accepted, stored as: ' || left(rv.run('studentB', $q$select api_place_order(rv.id('sOpen'), 'B', jsonb_build_array(jsonb_build_object('menuItemId', rv.id('iX'), 'qty', 1)), null, null, 0, 'UPI')->>'paymentMethod'$q$), 60);
select 'made-up payment method accepted, stored as: ' || left(rv.run('studentB', $q$select api_place_order(rv.id('sOpen'), 'B', jsonb_build_array(jsonb_build_object('menuItemId', rv.id('iX'), 'qty', 1)), null, null, 0, 'already paid, trust me')->>'paymentMethod'$q$), 60);
select 'tip 99999 stored as: ' || rv.run('studentB', $q$select api_place_order(rv.id('sOpen'), 'B', jsonb_build_array(jsonb_build_object('menuItemId', rv.id('iX'), 'qty', 1)), null, null, 99999)->>'tip'$q$);
select '4th order by the same student in the pool: ' || left(rv.run('studentB', $q$select api_place_order(rv.id('sOpen'), 'B', jsonb_build_array(jsonb_build_object('menuItemId', rv.id('iX'), 'qty', 1)))$q$), 70);
select 'consent rows for B before ordering: ' || (select count(*) from student_consents where user_id = rv.id('studentB'));
select '51 lines: ' || left(rv.run('stranger', $q$select api_place_order(rv.id('sOpen'), 'S', (select jsonb_agg(jsonb_build_object('menuItemId', rv.id('iX'), 'qty', 1)) from generate_series(1, 51)))$q$), 90);
update menu_items set stock_qty = 5000 where id = rv.id('iX');
select 'one order, 50 lines of the same item x 100, subtotal paise: ' || left(rv.run('stranger', $q$select api_place_order(rv.id('sOpen'), 'S', (select jsonb_agg(jsonb_build_object('menuItemId', rv.id('iX'), 'qty', 100)) from generate_series(1, 50)), null, null, 0, 'COD')->>'subtotalPaise'$q$), 80);
select 'stock left for everyone else: ' || (select stock_qty from menu_items where id = rv.id('iX'));
select 'the same account cancels, no cost: ' || left(rv.run('stranger', format($q$select api_cancel_order(%L)->>'message'$q$, (select id from orders where student_id = rv.id('stranger') order by created_at desc limit 1))), 60) || '; stock back to ' || 'see next line';
select 'stock after cancel: ' || (select stock_qty from menu_items where id = rv.id('iX'));
select 'cancelled orders do not count toward the limit of 3: active orders for stranger = ' || (select count(*) from orders where student_id = rv.id('stranger') and status in ('placed','pooled'));

\echo == P6 paused store with a pool still open
update vendors set accepting_orders = false where id = rv.id('vX');
select 'order into a paused store: ' || left(rv.run('studentA', $q$select api_place_order(rv.id('sOpen'), 'A', jsonb_build_array(jsonb_build_object('menuItemId', rv.id('iX'), 'qty', 1)))->>'status'$q$), 80);
update vendors set accepting_orders = true where id = rv.id('vX');

\echo == P15 delivery and cash
insert into orders (slot_id, student_name, tip, payment_method, items, subtotal_paise, status, student_id, delivery_fee_charged)
  values (rv.id('sDisp'), 'Upi Person', 0, 'UPI', jsonb_build_array(jsonb_build_object('menuItemId', rv.id('iX'), 'qty', 1, 'name', 'Chips', 'unitPricePaise', 2000)), 2000, 'dispatched', rv.id('stranger'), 20);
select 'recording cash on a UPI order: ' || left(rv.run('staffX', format($q$select api_mark_delivered(%L, 4400)$q$, (select id from orders where student_name = 'Upi Person'))), 90);
select 'delivering the UPI order with no payment record: ' || left(rv.run('staffX', format($q$select api_mark_delivered(%L)::text$q$, (select id from orders where student_name = 'Upi Person'))), 60);
select 'UPI order after delivery: cash_collected_paise=' || coalesce(cash_collected_paise::text, 'null') || ', in cash summary expected total? ' ||
   (rv.run('staffX', $q$select api_cash_summary(rv.id('vX'))->>'expectedPaise'$q$)) from orders where student_name = 'Upi Person';
select 'COD deliver records default cash (due = 2000 + 20*100 + 400): ' || rv.run('staffX', $q$select api_mark_delivered(rv.id('oD'))->'order'->>'cashCollectedPaise'$q$);
select 'second deliver: ' || left(rv.run('staffX', $q$select api_mark_delivered(rv.id('oD'))$q$), 80);

\echo == P7 idempotency
select 'first:  ' || left(rv.run('studentA', $q$select api_place_order(rv.id('sOpen'), 'A', jsonb_build_array(jsonb_build_object('menuItemId', rv.id('iX'), 'qty', 2)), null, null, 0, 'COD', null, 'key-12345678')->>'id'$q$), 36);
select 'replay: ' || left(rv.run('studentA', $q$select api_place_order(rv.id('sOpen'), 'A', jsonb_build_array(jsonb_build_object('menuItemId', rv.id('iX'), 'qty', 2)), null, null, 0, 'COD', null, 'key-12345678')->>'id'$q$), 36);
select 'orders created by those two calls: ' || (select count(*) from orders where student_id = rv.id('studentA') and items->0->>'qty' = '2');
select 'same key, other body: ' || left(rv.run('studentA', $q$select api_place_order(rv.id('sOpen'), 'A', jsonb_build_array(jsonb_build_object('menuItemId', rv.id('iX'), 'qty', 3)), null, null, 0, 'COD', null, 'key-12345678')$q$), 90);
select 'same key, other user gets their own order, name: ' || (rv.run('stranger', $q$select api_place_order(rv.id('sOpen'), 'Stranger', jsonb_build_array(jsonb_build_object('menuItemId', rv.id('iX'), 'qty', 2)), null, null, 0, 'COD', null, 'key-12345678')->>'studentName'$q$));

\echo == P16 account deletion leaves
update orders set status = 'delivered' where student_id = rv.id('studentB');
select 'B reports a crash while signed in: ' || (rv.run('studentB', $q$select api_report_error('student', 'B crash')::text$q$) is not null);
select 'delete: ' || rv.run('studentB', $q$select api_delete_my_account('DELETE')::text$q$);
select 'orders still naming B: ' || (select count(*) from orders where student_name = 'B' or student_id = rv.id('studentB'))
  || '; audit rows with B''s id: ' || (select count(*) from audit_log where actor = rv.id('studentB') or row_id = rv.id('studentB')::text or old_values::text like '%' || rv.id('studentB') || '%' or new_values::text like '%' || rv.id('studentB') || '%')
  || '; client_errors rows with B''s id: ' || (select count(*) from client_errors where user_id = rv.id('studentB'))
  || '; idempotency rows: ' || (select count(*) from idempotency_keys where scope like rv.id('studentB') || '%')
  || '; consents: ' || (select count(*) from student_consents where user_id = rv.id('studentB'));

\echo == P4 signed-out error reports
select rv.run('anon', $q$select api_report_error('vendor', 'frag', null, 'https://vendor.app/#access_token=SECRET&refresh_token=R')::text$q$) is null;
select 'page stored for a URL with a fragment: ' || (select page from client_errors where message = 'frag');
select count(*) || ' rows before the flood' from client_errors;
create or replace function rv.junk(n int) returns text language sql volatile as $$ select string_agg(md5(random()::text), '') from generate_series(1, n) $$;
grant execute on function rv.junk(int) to public;
select rv.run('anon', $q$select count(*)::text from (select api_report_error('student', 'flood ' || g || rv.junk(9), rv.junk(63), 'https://x/' || g, rv.junk(7)) from generate_series(1, 400) g) x$q$) || ' calls made by one signed-out caller';
select count(*) || ' rows after; average row bytes ' || round(avg(pg_column_size(c.*))) from client_errors c;
select rv.run('studentA', $q$select api_report_error('student', 'REAL CRASH')::text$q$) is null;
select 'a real new crash reported right after is stored: ' || exists (select 1 from client_errors where message = 'REAL CRASH');

rollback;
