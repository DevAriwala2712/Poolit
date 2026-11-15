-- Access matrix probe: every api_* function, called by every kind of actor with
-- store X's resources. Each call runs in a subtransaction that is always rolled back.
-- Run against a throwaway database built from supabase/migrations (never a real project).
\set ON_ERROR_STOP on
drop schema if exists rv cascade;
create schema rv;
grant usage on schema rv to public;
create table rv.ids (name text primary key, id uuid not null);
grant select on rv.ids to public;
create function rv.id(n text) returns uuid language sql stable as $$ select id from rv.ids where name = n $$;
create table rv.result (fn text, actor text, outcome text, primary key (fn, actor));

do $$
declare hX uuid; hY uuid; vX uuid; vY uuid; iX uuid; iY uuid; sOpen uuid; sClosed uuid; sDisp uuid;
        a uuid; b uuid; st uuid; ow uuid; oy uuid; ad uuid; n uuid; oA uuid; oP uuid; oD uuid; stf uuid;
begin
  insert into hostels (name, blocks) values ('RV Ganga', array['A']) returning id into hX;
  insert into hostels (name, blocks) values ('RV Yamuna', array['A']) returning id into hY;
  insert into vendors (name, hostel_id) values ('RV Store X', hX) returning id into vX;
  insert into vendors (name, hostel_id) values ('RV Store Y', hY) returning id into vY;
  insert into menu_items (vendor_id, name, category, price, unit, stock_qty) values (vX, 'Chips', 'Snacks', 20, '1 pc', 500) returning id into iX;
  insert into menu_items (vendor_id, name, category, price, unit, stock_qty) values (vY, 'Cola', 'Drinks', 40, '1 pc', 500) returning id into iY;
  insert into auth.users (phone) values ('+919000000001') returning id into a;
  insert into auth.users (phone) values ('+919000000002') returning id into b;
  insert into auth.users (phone) values ('+919000000003') returning id into n;
  insert into auth.users (email) values ('staff-x@rv.test') returning id into st;
  insert into auth.users (email) values ('owner-x@rv.test') returning id into ow;
  insert into auth.users (email) values ('owner-y@rv.test') returning id into oy;
  insert into auth.users (email) values ('admin@rv.test') returning id into ad;
  insert into students (user_id, name, phone, hostel_id, block, room) values (a, 'Anaya Secret', '+919000000001', hX, 'A', '204');
  insert into students (user_id, name, phone, hostel_id, block, room) values (b, 'Bhavin Other', '+919000000002', hX, 'A', '101');
  insert into vendor_users values (st, vX, 'staff'), (ow, vX, 'owner'), (oy, vY, 'owner');
  insert into platform_admins (user_id) values (ad);
  insert into staff (vendor_id, name, role, email) values (vX, 'Roster Person', 'Packer', 'roster@rv.test') returning id into stf;
  insert into slots (hostel_id, vendor_id, status, opens_at, closes_at) values (hX, vX, 'dispatched', now() - interval '3 hours', now() - interval '170 minutes') returning id into sDisp;
  insert into slots (hostel_id, vendor_id, status, opens_at, closes_at) values (hX, vX, 'closed', now() - interval '2 hours', now() - interval '110 minutes') returning id into sClosed;
  insert into slots (hostel_id, vendor_id, status, opens_at, closes_at) values (hX, vX, 'open', now(), now() + interval '30 minutes') returning id into sOpen;
  insert into orders (slot_id, student_name, block, room, tip, payment_method, items, subtotal_paise, status, student_id, delivery_fee_charged)
    values (sDisp, 'Anaya Secret', 'A', '204', 0, 'COD', jsonb_build_array(jsonb_build_object('menuItemId', iX, 'qty', 1, 'name', 'Chips', 'unitPricePaise', 2000)), 2000, 'dispatched', a, 20) returning id into oD;
  insert into orders (slot_id, student_name, block, room, tip, payment_method, items, subtotal_paise, status, student_id, delivery_fee_charged)
    values (sClosed, 'Anaya Secret', 'A', '204', 0, 'COD', jsonb_build_array(jsonb_build_object('menuItemId', iX, 'qty', 1, 'name', 'Chips', 'unitPricePaise', 2000)), 2000, 'pooled', a, 20) returning id into oP;
  insert into orders (slot_id, student_name, block, room, tip, payment_method, items, subtotal_paise, status, student_id)
    values (sOpen, 'Anaya Secret', 'A', '204', 0, 'COD', jsonb_build_array(jsonb_build_object('menuItemId', iX, 'qty', 1, 'name', 'Chips', 'unitPricePaise', 2000)), 2000, 'placed', a) returning id into oA;
  insert into rv.ids values ('hX',hX),('hY',hY),('vX',vX),('vY',vY),('iX',iX),('iY',iY),('sOpen',sOpen),('sClosed',sClosed),('sDisp',sDisp),
    ('studentA',a),('studentB',b),('stranger',n),('staffX',st),('ownerX',ow),('ownerY',oy),('admin',ad),('oA',oA),('oP',oP),('oD',oD),('stf',stf);
end $$;

-- Run p_sql as p_actor, always roll it back, record what happened.
create function rv.probe(p_fn text, p_actor text, p_sql text) returns void language plpgsql as $$
declare v_state text; v_msg text; v_out text;
begin
  begin
    if p_actor = 'anon' then
      perform set_config('request.jwt.claims', '', true);
      execute 'set local role anon';
    else
      perform set_config('request.jwt.claims', json_build_object('sub', rv.id(p_actor), 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
    end if;
    execute p_sql;
    raise exception using errcode = 'RV000', message = 'ran';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  v_out := case v_state when 'RV000' then 'ALLOWED' when 'PT401' then '401' when 'PT403' then '403' when 'PT404' then '404'
                        when 'PT409' then 'ALLOWED(409)' when 'PT400' then 'ALLOWED(400)' when '42501' then 'denied' else v_state || ' ' || left(v_msg, 60) end;
  insert into rv.result values (p_fn, p_actor, v_out);
end $$;

create table rv.calls (fn text primary key, sql text, expect text);
insert into rv.calls values
 ('api_hostels',            $q$select api_hostels()$q$, 'all'),
 ('api_vendors',            $q$select api_vendors()$q$, 'all'),
 ('api_vendor',             $q$select api_vendor(rv.id('vX'))$q$, 'all'),
 ('api_vendor_menu',        $q$select api_vendor_menu(rv.id('vX'))$q$, 'all'),
 ('api_current_slot',       $q$select api_current_slot(rv.id('hX'))$q$, 'all'),
 ('api_slot',               $q$select api_slot(rv.id('sOpen'))$q$, 'all'),
 ('api_live_fee',           $q$select api_live_fee(rv.id('sOpen'))$q$, 'all'),
 ('api_student_view',       $q$select api_student_view(rv.id('hX'))$q$, 'all'),
 ('api_report_error',       $q$select api_report_error('student', 'probe')$q$, 'all'),
 ('api_me',                 $q$select api_me()$q$, 'signed-in'),
 ('api_update_me',          $q$select api_update_me('Probe Name')$q$, 'signed-in'),
 ('api_my_orders',          $q$select api_my_orders()$q$, 'signed-in'),
 ('api_place_order',        $q$select api_place_order(rv.id('sOpen'), 'Probe', jsonb_build_array(jsonb_build_object('menuItemId', rv.id('iX'), 'qty', 1)))$q$, 'signed-in'),
 ('api_record_consent',     $q$select api_record_consent('v1', true)$q$, 'signed-in'),
 ('api_export_my_data',     $q$select api_export_my_data()$q$, 'signed-in'),
 ('api_is_admin',           $q$select api_is_admin()$q$, 'signed-in'),
 ('api_cancel_order',       $q$select api_cancel_order(rv.id('oA'))$q$, 'studentA'),
 ('api_delete_my_account',  $q$select api_delete_my_account('DELETE')$q$, 'students'),
 ('api_vendor_overview',    $q$select api_vendor_overview()$q$, 'vendors'),
 ('api_vendor_orders',      $q$select api_vendor_orders(rv.id('vX'))$q$, 'storeX'),
 ('api_slot_orders',        $q$select api_slot_orders(rv.id('sOpen'))$q$, 'storeX'),
 ('api_pick_list',          $q$select api_pick_list(rv.id('sOpen'))$q$, 'storeX'),
 ('api_close_slot',         $q$select api_close_slot(rv.id('sOpen'))$q$, 'storeX'),
 ('api_dispatch_slot',      $q$select api_dispatch_slot(rv.id('sClosed'))$q$, 'storeX'),
 ('api_mark_delivered',     $q$select api_mark_delivered(rv.id('oD'))$q$, 'storeX'),
 ('api_cash_summary',       $q$select api_cash_summary(rv.id('vX'))$q$, 'storeX'),
 ('api_create_menu_item',   $q$select api_create_menu_item(rv.id('vX'), '{"name":"P","category":"Snacks","price":5,"unit":"1"}')$q$, 'storeX'),
 ('api_update_menu_item',   $q$select api_update_menu_item(rv.id('iX'), '{"lowStockThreshold":3}')$q$, 'storeX'),
 ('api_update_menu_item(price)', $q$select api_update_menu_item(rv.id('iX'), '{"price":1}')$q$, 'ownerX'),
 ('api_set_item_image',     $q$select api_set_item_image(rv.id('iX'), null)$q$, 'storeX'),
 ('api_restock_item',       $q$select api_restock_item(rv.id('iX'), 5)$q$, 'storeX'),
 ('api_restock_log',        $q$select api_restock_log(rv.id('iX'))$q$, 'storeX'),
 ('api_inventory',          $q$select api_inventory(rv.id('vX'))$q$, 'storeX'),
 ('api_inventory(no id)',   $q$select api_inventory()$q$, 'vendors'),
 ('api_generate_barcode',   $q$select api_generate_barcode(rv.id('iX'))$q$, 'storeX'),
 ('api_generate_missing_barcodes', $q$select api_generate_missing_barcodes(rv.id('vX'))$q$, 'storeX'),
 ('api_adjust_stock',       $q$select api_adjust_stock(rv.id('iX'), 'set', 7)$q$, 'storeX'),
 ('api_stock_history',      $q$select api_stock_history(rv.id('iX'))$q$, 'storeX'),
 ('api_staff',              $q$select api_staff(rv.id('vX'))$q$, 'storeX'),
 ('api_update_vendor',      $q$select api_update_vendor(rv.id('vX'), '{"prepMinutes":9}')$q$, 'ownerX'),
 ('api_create_staff',       $q$select api_create_staff(rv.id('vX'), 'N', 'R')$q$, 'ownerX'),
 ('api_update_staff',       $q$select api_update_staff(rv.id('stf'), '{"status":"break"}')$q$, 'ownerX'),
 ('api_delete_staff',       $q$select api_delete_staff(rv.id('stf'))$q$, 'ownerX'),
 ('api_fee_statement',      $q$select api_fee_statement(rv.id('vX'), current_date - 7, current_date)$q$, 'ownerX+admin'),
 ('api_set_fee_terms',      $q$select api_set_fee_terms(rv.id('vX'), 'percent', 5)$q$, 'admin'),
 ('api_audit_log',          $q$select api_audit_log()$q$, 'admin'),
 ('api_client_errors',      $q$select api_client_errors()$q$, 'admin');

select rv.probe(c.fn, a.actor, c.sql) from rv.calls c cross join (values ('anon'),('stranger'),('studentA'),('studentB'),('staffX'),('ownerX'),('ownerY'),('admin')) a(actor) order by c.fn, a.actor \g /dev/null

-- Who should get through, per expectation class.
create table rv.expected (expect text, actor text);
insert into rv.expected
 select 'all', a from unnest(array['anon','stranger','studentA','studentB','staffX','ownerX','ownerY','admin']) a
 union all select 'signed-in', a from unnest(array['stranger','studentA','studentB','staffX','ownerX','ownerY','admin']) a
 union all select 'studentA', 'studentA'
 union all select 'students', a from unnest(array['stranger','studentA','studentB']) a
 union all select 'vendors', a from unnest(array['staffX','ownerX','ownerY']) a
 union all select 'storeX', a from unnest(array['staffX','ownerX']) a
 union all select 'ownerX', 'ownerX'
 union all select 'ownerX+admin', a from unnest(array['ownerX','admin']) a
 union all select 'admin', 'admin';

\pset format unaligned
\pset fieldsep ' | '
\pset tuples_only off
select c.fn, c.expect,
  max(r.outcome) filter (where r.actor='anon') as anon, max(r.outcome) filter (where r.actor='stranger') as stranger,
  max(r.outcome) filter (where r.actor='studentA') as "studentA", max(r.outcome) filter (where r.actor='studentB') as "studentB",
  max(r.outcome) filter (where r.actor='staffX') as "staffX", max(r.outcome) filter (where r.actor='ownerX') as "ownerX",
  max(r.outcome) filter (where r.actor='ownerY') as "ownerY", max(r.outcome) filter (where r.actor='admin') as admin
from rv.calls c join rv.result r using (fn) group by c.fn, c.expect order by c.expect, c.fn;

\echo
\echo DEVIATIONS (allowed but not expected, or expected but refused):
select r.fn, r.actor, r.outcome, c.expect
from rv.result r join rv.calls c using (fn)
where (r.outcome like 'ALLOWED%') is distinct from exists (select 1 from rv.expected e where e.expect = c.expect and e.actor = r.actor)
order by 1, 2;
