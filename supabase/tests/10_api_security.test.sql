-- Access-control tests for the api_* functions.
--
-- Signs in as: anonymous, two students (A and B), a signed-in user who is
-- neither, the owner and a staff member of store 1, and the owner of store 2.
-- Each must be able to do exactly what they own and nothing else. The suite
-- fails the build on any leak.

create schema t;
grant usage on schema t to public;

create table t.ids (name text primary key, id uuid not null);
grant select on t.ids to public;
create function t.id(p_name text) returns uuid language sql stable as $$ select id from t.ids where name = p_name $$;

create function t.as_user(p_name text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', t.id(p_name), 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create function t.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
end $$;

create function t.as_admin() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

create function t.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FAILED: %', p_msg; end if;
end $$;

-- Runs p_sql and checks it fails with exactly this SQLSTATE.
create function t.throws(p_state text, p_sql text) returns void language plpgsql as $$
declare v_state text; v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
  end;
  if v_state is distinct from p_state then
    raise exception 'FAILED: expected % but got % (%) for: %', p_state, coalesce(v_state, 'no error'), v_msg, p_sql;
  end if;
end $$;

-- Runs p_sql and checks that it succeeds.
create function t.works(p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
end $$;

grant execute on all functions in schema t to public;

-- ============ Fixtures (as the database owner) ============

do $$
declare
  h1 uuid; h2 uuid; v1 uuid; v2 uuid; i1 uuid; i2 uuid; i3 uuid;
  a uuid; b uuid; n uuid; x uuid; xs uuid; y uuid;
begin
  insert into hostels (name, blocks) values ('Ganga', array['A','B']) returning id into h1;
  insert into hostels (name, blocks) values ('Yamuna', array['A']) returning id into h2;
  insert into vendors (name, hostel_id) values ('Store One', h1) returning id into v1;
  insert into vendors (name, hostel_id) values ('Store Two', h2) returning id into v2;
  insert into menu_items (vendor_id, name, category, price, unit, stock_qty) values (v1, 'Maggi', 'Instant Food', 56, 'Pack of 4', 10) returning id into i1;
  insert into menu_items (vendor_id, name, category, price, unit, stock_qty) values (v1, 'Lays', 'Snacks', 20, '52 g', 5) returning id into i3;
  insert into menu_items (vendor_id, name, category, price, unit, stock_qty) values (v2, 'Oreo', 'Snacks', 35, '120 g', 10) returning id into i2;

  insert into auth.users (email, phone) values (null, '+919000000001') returning id into a;
  insert into auth.users (email, phone) values (null, '+919000000002') returning id into b;
  insert into auth.users (email) values ('nobody@example.com') returning id into n;
  insert into auth.users (email) values ('owner1@example.com') returning id into x;
  insert into auth.users (email) values ('staff1@example.com') returning id into xs;
  insert into auth.users (email) values ('owner2@example.com') returning id into y;
  insert into vendor_users (user_id, vendor_id, role) values (x, v1, 'owner'), (xs, v1, 'staff'), (y, v2, 'owner');

  insert into t.ids values ('h1', h1), ('h2', h2), ('v1', v1), ('v2', v2), ('i1', i1), ('i2', i2), ('i3', i3),
    ('A', a), ('B', b), ('nobody', n), ('owner1', x), ('staff1', xs), ('owner2', y);
end $$;

-- ============ 1. Structure: who may execute what ============

do $$
declare
  r record;
  v_public text[] := array['api_hostels','api_vendors','api_vendor','api_vendor_menu','api_current_slot','api_slot','api_live_fee','api_student_view','api_report_error'];
  n_api integer := 0;
begin
  for r in select p.proname, p.oid from pg_proc p join pg_namespace s on s.oid = p.pronamespace
           where s.nspname = 'public' and p.proname like 'api\_%' loop
    n_api := n_api + 1;
    perform t.ok(has_function_privilege('authenticated', r.oid, 'execute'), r.proname || ' must be callable by signed-in users');
    perform t.ok(not has_function_privilege('public', r.oid, 'execute'), r.proname || ' must not be granted to PUBLIC');
    perform t.ok(has_function_privilege('anon', r.oid, 'execute') = (r.proname = any(v_public)),
                 r.proname || ': anonymous access must match the public list');
  end loop;
  perform t.ok(n_api >= 30, 'expected the api_ functions to exist, found ' || n_api);

  -- Internal helpers are not reachable at all.
  perform t.ok(not has_schema_privilege('anon', 'private', 'usage'), 'anon must not use schema private');
  perform t.ok(not has_schema_privilege('authenticated', 'private', 'usage'), 'authenticated must not use schema private');

  -- The older write functions stay server-only.
  for r in select unnest(array['place_order','close_slot','dispatch_slot','restock_item','ensure_open_slot','adjust_stock','generate_item_barcode']) as n loop
    perform t.ok(not exists (select 1 from pg_proc p where p.proname = r.n
                  and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
                 r.n || ' must not be executable by anon or authenticated');
  end loop;

  -- No table is readable or writable by the public roles, and none has a policy that would open it.
  for r in select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
           where s.nspname = 'public' and c.relkind = 'r' loop
    perform t.ok(not has_table_privilege('anon', 'public.' || r.relname, 'select,insert,update,delete'), r.relname || ' must not be accessible to anon');
    perform t.ok(not has_table_privilege('authenticated', 'public.' || r.relname, 'select,insert,update,delete'), r.relname || ' must not be accessible to authenticated');
    perform t.ok((select relrowsecurity from pg_class where oid = ('public.' || r.relname)::regclass), r.relname || ' must have row level security on');
  end loop;
end $$;

-- ============ 2. Anonymous visitors ============

do $$
declare v_slot jsonb;
begin
  perform t.as_anon();
  perform t.works('select api_hostels()');
  perform t.works('select api_vendors()');
  perform t.works(format('select api_vendor(%L)', t.id('v1')));
  perform t.works(format('select api_vendor_menu(%L)', t.id('v1')));
  v_slot := api_current_slot(t.id('h1'));
  perform t.ok(v_slot->'slot'->>'status' = 'open', 'anon sees an open pool');
  perform t.ok(jsonb_array_length(v_slot->'vendor'->'menu') = 2, 'anon sees the menu');
  perform t.works(format('select api_slot(%L)', v_slot->'slot'->>'id'));
  perform t.works(format('select api_live_fee(%L)', v_slot->'slot'->>'id'));
  perform t.as_admin();
  insert into t.ids values ('slot1', (v_slot->'slot'->>'id')::uuid);

  perform t.as_anon();
  perform t.throws('42501', 'select * from orders');
  perform t.throws('42501', 'select * from students');
  perform t.throws('42501', 'select * from vendor_users');
  perform t.throws('42501', 'select * from menu_items');
  perform t.throws('42501', 'select * from staff');
  perform t.throws('42501', 'update menu_items set price = 1');
  perform t.throws('42501', format('select place_order(%L, ''x'', null, null, 0, null, null, ''[]'')', t.id('slot1')));
  perform t.throws('42501', format('select close_slot(%L)', t.id('slot1')));
  perform t.throws('42501', format('select api_me()'));
  perform t.throws('42501', format('select api_place_order(%L, ''x'', ''[]'')', t.id('slot1')));
  perform t.throws('42501', 'select api_vendor_overview()');
  perform t.throws('42501', format('select api_restock_item(%L, 5)', t.id('i1')));
  perform t.throws('42501', format('select api_slot_orders(%L)', t.id('slot1')));
  perform t.as_admin();

  -- Unknown ids give 404, not data.
  perform t.as_anon();
  perform t.throws('PT404', 'select api_vendor(''00000000-0000-0000-0000-000000000000'')');
  perform t.throws('PT404', 'select api_slot(''00000000-0000-0000-0000-000000000000'')');
  perform t.throws('PT404', 'select api_current_slot(''00000000-0000-0000-0000-000000000000'')');
  perform t.as_admin();
end $$;

-- ============ 3. Students ============

do $$
declare
  o jsonb;
  s text := t.id('slot1')::text;
  m1 text := t.id('i1')::text;
  m3 text := t.id('i3')::text;
  stock_before integer;
begin
  perform t.as_user('A');

  -- Profile
  perform t.ok((api_me()->'profile') = 'null'::jsonb, 'no profile yet');
  perform t.ok(api_me()->>'phone' = '+919000000001', 'phone comes from the login');
  perform t.ok(api_update_me('Aarav', t.id('h1'), 'A', '204')->'profile'->>'name' = 'Aarav', 'profile saved');
  perform t.throws('PT400', $q$ select api_update_me('   ') $q$);
  perform t.throws('PT400', $q$ select api_update_me('Aarav', '00000000-0000-0000-0000-000000000000') $q$);

  -- Order, with the exact JSON shape the apps expect
  o := api_place_order(s::uuid, 'Aarav', jsonb_build_array(jsonb_build_object('menuItemId', m1, 'qty', 2)), 'A', '204', 10, 'UPI', 'ring twice');
  perform t.ok(o->>'status' = 'placed', 'order is placed');
  perform t.ok(jsonb_typeof(o->'createdAt') = 'number', 'createdAt is epoch milliseconds');
  perform t.ok(o ? 'slotId' and o ? 'studentName' and o ? 'paymentMethod' and o ? 'note' and o ? 'tip', 'order has the camelCase keys');
  perform t.ok(not (o ? 'deliveryFeeCharged'), 'fee is not set until the pool closes');
  perform t.ok(o->'items'->0->>'menuItemId' = m1 and (o->'items'->0->>'qty')::int = 2, 'order lines kept');
  perform t.ok((o->'items'->0->>'unitPricePaise')::int = 5600 and o->'items'->0->>'name' = 'Maggi', 'order line carries the frozen name and price');
  perform t.ok((o->>'subtotalPaise')::int = 11200, 'order carries its subtotal in paise (2 x 56 rupees)');
  perform t.as_admin();
  perform t.ok((select stock_qty from menu_items where id = t.id('i1')) = 8, 'stock went down by 2');
  perform t.ok((select student_id from orders where id = (o->>'id')::uuid) = t.id('A'), 'order is tied to the student, not the typed name');

  -- Bad input is rejected and changes nothing
  perform t.as_user('A');
  perform t.throws('PT400', format($q$ select api_place_order(%L, 'x', '[]') $q$, s));
  perform t.throws('PT400', format($q$ select api_place_order(%L, 'x', '{}') $q$, s));
  perform t.throws('PT400', format($q$ select api_place_order(%L, '', '[{"menuItemId":"%s","qty":1}]') $q$, s, m1));
  perform t.throws('PT400', format($q$ select api_place_order(%L, 'x', '[{"menuItemId":"%s","qty":0}]') $q$, s, m1));
  perform t.throws('PT400', format($q$ select api_place_order(%L, 'x', '[{"menuItemId":"%s","qty":-3}]') $q$, s, m1));
  perform t.throws('PT400', format($q$ select api_place_order(%L, 'x', '[{"menuItemId":"%s","qty":101}]') $q$, s, m1));
  perform t.throws('PT400', format($q$ select api_place_order(%L, 'x', '[{"menuItemId":"%s","qty":1.5}]') $q$, s, m1));
  perform t.throws('PT400', format($q$ select api_place_order(%L, 'x', '[{"menuItemId":"%s","qty":"2"}]') $q$, s, m1));
  perform t.throws('PT400', format($q$ select api_place_order(%L, 'x', '[{"menuItemId":"not-a-uuid","qty":1}]') $q$, s));
  perform t.throws('PT400', format($q$ select api_place_order(%L, 'x', '[{"qty":1}]') $q$, s));
  perform t.throws('PT404', $q$ select api_place_order('00000000-0000-0000-0000-000000000000', 'x', '[{"menuItemId":"00000000-0000-0000-0000-000000000000","qty":1}]') $q$);
  perform t.throws('PT409', format($q$ select api_place_order(%L, 'x', '[{"menuItemId":"%s","qty":99}]') $q$, s, m1));
  -- an item from another store
  perform t.throws('PT400', format($q$ select api_place_order(%L, 'x', '[{"menuItemId":"%s","qty":1}]') $q$, s, t.id('i2')));
  -- a failing second line must not keep the first line's stock change
  perform t.throws('PT409', format($q$ select api_place_order(%L, 'x', '[{"menuItemId":"%s","qty":1},{"menuItemId":"%s","qty":50}]') $q$, s, m1, m3));
  perform t.as_admin();
  perform t.ok((select stock_qty from menu_items where id = t.id('i1')) = 8, 'rejected orders leave stock alone');
  perform t.ok((select stock_qty from menu_items where id = t.id('i3')) = 5, 'rejected orders leave stock alone (second item)');

  -- Per-pool limit: three orders, not four
  perform t.as_user('A');
  perform api_place_order(s::uuid, 'Aarav', jsonb_build_array(jsonb_build_object('menuItemId', m3, 'qty', 1)));
  perform api_place_order(s::uuid, 'Aarav', jsonb_build_array(jsonb_build_object('menuItemId', m3, 'qty', 1)));
  perform t.throws('PT409', format($q$ select api_place_order(%L, 'Aarav', '[{"menuItemId":"%s","qty":1}]') $q$, s, m3));

  -- Student B cannot see A's data and has no vendor powers
  perform t.as_user('B');
  perform t.ok(jsonb_array_length(api_my_orders()->'orders') = 0, 'B sees none of A''s orders');
  perform t.ok(api_me()->>'phone' = '+919000000002', 'B sees B''s phone');
  perform t.ok((api_me()->'profile') = 'null'::jsonb, 'B does not see A''s profile');
  perform t.as_user('A');
  perform t.ok(jsonb_array_length(api_my_orders()->'orders') = 3, 'A sees A''s three orders');
  perform t.ok(jsonb_array_length(api_my_orders()->'slots') = 1, 'A sees the pool those orders are in');
  perform t.as_admin();
end $$;

-- ============ 4. Signed-in users who are not vendors (students, strangers) ============

do $$
declare
  s text := t.id('slot1')::text;
  who text;
begin
  foreach who in array array['B', 'nobody'] loop
    perform t.as_user(who);
    perform t.throws('PT403', 'select api_vendor_overview()');
    perform t.throws('PT403', format('select api_vendor_orders(%L)', t.id('v1')));
    perform t.throws('PT403', format('select api_slot_orders(%L)', s));
    perform t.throws('PT403', format('select api_pick_list(%L)', s));
    perform t.throws('PT403', format('select api_close_slot(%L)', s));
    perform t.throws('PT403', format('select api_dispatch_slot(%L)', s));
    perform t.throws('PT403', format('select api_restock_item(%L, 5)', t.id('i1')));
    perform t.throws('PT403', format('select api_restock_log(%L)', t.id('i1')));
    perform t.throws('PT403', format('select api_update_menu_item(%L, ''{"price":1}'')', t.id('i1')));
    perform t.throws('PT403', format('select api_create_menu_item(%L, ''{"name":"x","category":"Snacks","price":5,"unit":"u"}'')', t.id('v1')));
    perform t.throws('PT403', format('select api_adjust_stock(%L, ''set'', 0)', t.id('i1')));
    perform t.throws('PT403', format('select api_stock_history(%L)', t.id('i1')));
    perform t.throws('PT403', format('select api_generate_barcode(%L)', t.id('i1')));
    perform t.throws('PT403', format('select api_generate_missing_barcodes(%L)', t.id('v1')));
    perform t.throws('PT403', format('select api_update_vendor(%L, ''{"acceptingOrders":false}'')', t.id('v1')));
    perform t.throws('PT403', format('select api_staff(%L)', t.id('v1')));
    perform t.throws('PT403', format('select api_create_staff(%L, ''X'', ''Cook'')', t.id('v1')));
    perform t.throws('PT403', 'select api_inventory()');
    perform t.throws('PT403', format('select api_inventory(%L)', t.id('v1')));
    perform t.as_admin();
  end loop;
end $$;

-- ============ 5. Vendors: own store only ============

do $$
declare
  s text := t.id('slot1')::text;
  res jsonb;
  staff_id uuid;
begin
  -- Owner of store 1
  perform t.as_user('owner1');
  res := api_vendor_overview();
  perform t.ok(jsonb_array_length(res->'vendors') = 1 and res->'vendors'->0->>'id' = t.id('v1')::text, 'owner 1 sees only store 1');
  perform t.ok(jsonb_array_length(res->'hostels') = 1, 'only store 1''s hostel');
  perform t.ok(jsonb_array_length(res->'orders') = 3, 'sees the three orders of their pool');
  perform t.ok(res ? 'days' and (res->>'days')::int = 7, 'days default to 7');
  perform t.ok(jsonb_array_length(api_slot_orders(s::uuid)) = 3, 'slot orders');
  perform t.ok((api_pick_list(s::uuid)->0->>'totalQty')::int >= 2, 'pick list totals');
  perform t.ok(api_restock_item(t.id('i1'), 5)->'item'->>'stockQty' = '13', 'restock works on own item');
  perform t.ok(api_restock_item(t.id('i1'), 5)->'restockLog' ? 'at', 'restock log has a timestamp');
  perform t.throws('PT400', format('select api_restock_item(%L, 0)', t.id('i1')));
  perform t.throws('PT400', format('select api_restock_item(%L, 10001)', t.id('i1')));
  perform t.ok(jsonb_array_length(api_restock_log(t.id('i1'))) = 2, 'restock log entries');
  perform t.ok(api_update_menu_item(t.id('i1'), '{"price": 60.4}')->>'price' = '60', 'price rounds like before');
  perform t.throws('PT400', format('select api_update_menu_item(%L, ''{"price": -5}'')', t.id('i1')));
  perform t.throws('PT400', format('select api_update_menu_item(%L, ''{}'')', t.id('i1')));
  perform t.ok(api_update_vendor(t.id('v1'), '{"prepMinutes": 9, "poolWindowMinutes": 15}')->>'prepMinutes' = '9', 'owner updates settings');
  perform t.throws('PT400', format('select api_update_vendor(%L, ''{"poolWindowMinutes": 2}'')', t.id('v1')));
  perform t.throws('PT400', format('select api_update_vendor(%L, ''{"acceptingOrders": "yes"}'')', t.id('v1')));
  perform t.ok(api_create_menu_item(t.id('v1'), '{"name":"Cola","category":"Drinks","price":45,"unit":"750 ml","stockQty":4}')->>'stockQty' = '4', 'create item');
  perform t.throws('PT400', format('select api_create_menu_item(%L, ''{"name":"Cola","category":"Nope","price":45,"unit":"u"}'')', t.id('v1')));
  perform t.ok(api_generate_barcode(t.id('i1'))->>'barcode' like '29%', 'barcode in the in-store range');
  perform t.ok((api_generate_missing_barcodes(t.id('v1'))->>'generated')::int >= 1, 'bulk barcodes');
  perform t.ok(api_adjust_stock(t.id('i1'), 'remove', 1, 'damaged')->'adjustment'->>'delta' = '-1', 'adjust stock');
  perform t.throws('PT409', format('select api_adjust_stock(%L, ''remove'', 9999)', t.id('i1')));
  perform t.throws('PT400', format('select api_adjust_stock(%L, ''swap'', 1)', t.id('i1')));
  perform t.ok(jsonb_array_length(api_stock_history(t.id('i1'))) = 3, 'stock history merges restocks and adjustments');
  perform t.ok(jsonb_array_length(api_inventory()) >= 3, 'inventory lists own items');
  perform t.ok(jsonb_array_length(api_inventory(t.id('v1'), 'out')) = 0, 'nothing out of stock');

  -- Owner of store 1 cannot touch store 2
  perform t.throws('PT403', format('select api_restock_item(%L, 5)', t.id('i2')));
  perform t.throws('PT403', format('select api_update_menu_item(%L, ''{"price":1}'')', t.id('i2')));
  perform t.throws('PT403', format('select api_update_vendor(%L, ''{"acceptingOrders":false}'')', t.id('v2')));
  perform t.throws('PT403', format('select api_vendor_orders(%L)', t.id('v2')));
  perform t.throws('PT403', format('select api_staff(%L)', t.id('v2')));
  perform t.throws('PT403', format('select api_create_menu_item(%L, ''{"name":"x","category":"Snacks","price":5,"unit":"u"}'')', t.id('v2')));
  perform t.throws('PT403', format('select api_inventory(%L)', t.id('v2')));

  -- Owner of store 1 manages staff; staff cannot
  staff_id := (api_create_staff(t.id('v1'), 'Ravi', 'Packer', 'ravi@example.com')->>'id')::uuid;
  perform t.ok(api_update_staff(staff_id, '{"status":"break"}')->>'status' = 'break', 'owner edits staff');
  perform t.throws('PT400', format('select api_update_staff(%L, ''{"status":"asleep"}'')', staff_id));
  perform t.as_admin();
  insert into t.ids values ('staff_row', staff_id);

  -- Staff member of store 1: can run the store, cannot change settings or staff
  perform t.as_user('staff1');
  perform t.ok(jsonb_array_length(api_staff(t.id('v1'))) = 1, 'staff can list staff');
  perform t.ok(api_restock_item(t.id('i1'), 1)->>'message' = 'Restocked successfully', 'staff can restock');
  perform t.throws('PT403', format('select api_update_vendor(%L, ''{"acceptingOrders":false}'')', t.id('v1')));
  perform t.throws('PT403', format('select api_create_staff(%L, ''X'', ''Cook'')', t.id('v1')));
  perform t.throws('PT403', format('select api_update_staff(%L, ''{"status":"active"}'')', t.id('staff_row')));
  perform t.throws('PT403', format('select api_delete_staff(%L)', t.id('staff_row')));

  -- Owner of store 2 cannot see store 1
  perform t.as_user('owner2');
  res := api_vendor_overview();
  perform t.ok(jsonb_array_length(res->'vendors') = 1 and res->'vendors'->0->>'id' = t.id('v2')::text, 'owner 2 sees only store 2');
  perform t.ok(jsonb_array_length(res->'orders') = 0, 'owner 2 sees none of store 1''s orders');
  perform t.throws('PT403', format('select api_slot_orders(%L)', s));
  perform t.throws('PT403', format('select api_pick_list(%L)', s));
  perform t.throws('PT403', format('select api_close_slot(%L)', s));
  perform t.throws('PT403', format('select api_restock_item(%L, 5)', t.id('i1')));
  perform t.throws('PT403', format('select api_staff(%L)', t.id('v1')));
  perform t.throws('PT403', format('select api_delete_staff(%L)', t.id('staff_row')));
  perform t.as_admin();
end $$;

-- ============ 6. Pool lifecycle: close, dispatch, deliver ============

do $$
declare
  s uuid := t.id('slot1');
  res jsonb;
  oid uuid;
begin
  perform t.as_user('owner1');
  perform t.throws('PT409', format('select api_dispatch_slot(%L)', s));          -- still open
  res := api_close_slot(s);
  perform t.ok(res->>'message' = 'Slot closed successfully', 'closed');
  perform t.ok((res->>'orderCount')::int = 3 and (res->>'fee')::int = 10, 'fee ladder: 3 orders cost 10 each');
  perform t.ok(res->'slot'->>'status' = 'closed' and jsonb_typeof(res->'slot'->'closesAt') = 'number', 'slot json');
  perform t.ok(api_close_slot(s)->>'message' = 'Slot was already closed', 'closing twice is harmless');
  perform t.ok(not (api_close_slot(s) ? 'fee'), 'no fee on a repeat close');

  oid := (api_slot_orders(s)->0->>'id')::uuid;
  perform t.throws('PT409', format('select api_mark_delivered(%L)', oid));        -- not dispatched yet
  perform t.ok(api_dispatch_slot(s)->'slot'->>'status' = 'dispatched', 'dispatched');
  perform t.throws('PT409', format('select api_dispatch_slot(%L)', s));
  perform t.as_user('owner2');
  perform t.throws('PT403', format('select api_mark_delivered(%L)', oid));        -- another store's order
  perform t.as_user('owner1');
  res := api_mark_delivered(oid);
  perform t.ok(res->'order'->>'status' = 'delivered', 'delivered');
  perform t.ok((res->'order'->>'deliveryFeeCharged')::int = 10, 'fee locked on the order');
  perform t.throws('PT409', format('select api_mark_delivered(%L)', oid));        -- cannot deliver twice
  perform t.throws('PT404', 'select api_mark_delivered(''00000000-0000-0000-0000-000000000000'')');
  perform t.ok(jsonb_array_length(api_vendor_orders(t.id('v1'), 'delivered')) = 1, 'filter by status');
  perform t.ok(jsonb_array_length(api_vendor_orders(t.id('v1'))) = 3, 'all orders for the store');
  perform t.as_admin();

  -- Students see the locked fee on their own order
  perform t.as_user('A');
  perform t.ok((select count(*) from jsonb_array_elements(api_my_orders()->'orders') o where o->>'deliveryFeeCharged' = '10') = 3, 'students see the fee');
  perform t.as_admin();

  -- Orders are refused once the pool is no longer open
  perform t.as_user('B');
  perform t.throws('PT409', format($q$ select api_place_order(%L, 'Bhumi', '[{"menuItemId":"%s","qty":1}]') $q$, s, t.id('i1')));
  perform t.as_admin();

  -- Unique barcodes per store
  perform t.as_user('owner1');
  perform api_update_menu_item(t.id('i3'), '{"barcode":"8901234567890"}');
  perform t.throws('PT409', format('select api_update_menu_item(%L, ''{"barcode":"8901234567890"}'')', t.id('i1')));
  perform t.as_admin();
end $$;

-- ============ 7. A paused store opens no pool; delete staff ============

do $$
begin
  perform t.as_user('owner1');
  perform api_update_vendor(t.id('v1'), '{"acceptingOrders": false}');
  perform t.as_admin();
  -- (ensure_open_slot keeps reporting the last pool and opens nothing new)
  perform t.as_anon();
  perform t.ok((api_current_slot(t.id('h1'))->'slot'->>'id')::uuid = t.id('slot1'), 'paused store opens no new pool');
  perform t.as_user('owner1');
  perform t.ok(api_delete_staff(t.id('staff_row'))->>'message' = 'Staff member removed', 'owner removes staff');
  perform t.throws('PT404', format('select api_delete_staff(%L)', t.id('staff_row')));
  perform t.as_admin();
end $$;
