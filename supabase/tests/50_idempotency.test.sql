-- Retry safety: the same order sent twice (a lost reply, a double tap, a retry on
-- bad Wi-Fi) must create ONE order and take stock ONCE.
-- Uses the t.* helpers from 10_api_security.test.sql (files run in name order).

do $$
declare
  h uuid; v uuid; i uuid; own uuid; sA uuid; sB uuid; slot uuid;
  o1 jsonb; o2 jsonb; k text := 'order-0001-aaaa';
  stock0 integer;
begin
  update vendors set accepting_orders = true;
  insert into hostels (name) values ('Idem Hostel') returning id into h;
  insert into vendors (name, hostel_id) values ('Idem Store', h) returning id into v;
  insert into menu_items (vendor_id, name, category, price, unit, stock_qty) values (v, 'Idem Chips', 'Snacks', 20, '50 g', 20) returning id into i;
  insert into auth.users (email) values ('idem-owner@example.com') returning id into own;
  insert into vendor_users (user_id, vendor_id, role) values (own, v, 'owner');
  insert into auth.users (email, phone) values (null, '+919200000001') returning id into sA;
  insert into auth.users (email, phone) values (null, '+919200000002') returning id into sB;
  insert into t.ids values ('idem_h', h), ('idem_v', v), ('idem_i', i), ('idem_owner', own), ('idem_A', sA), ('idem_B', sB);

  perform t.as_anon();
  slot := (api_current_slot(h)->'slot'->>'id')::uuid;
  perform t.as_admin();
  insert into t.ids values ('idem_slot', slot);

  -- ---- order: the same key twice gives one order and one stock deduction ----
  perform t.as_user('idem_A');
  o1 := api_place_order(slot, 'Anaya', jsonb_build_array(jsonb_build_object('menuItemId', i, 'qty', 2)),
                        null, null, 0, 'UPI', null, k);
  o2 := api_place_order(slot, 'Anaya', jsonb_build_array(jsonb_build_object('menuItemId', i, 'qty', 2)),
                        null, null, 0, 'UPI', null, k);
  perform t.ok(o1->>'id' = o2->>'id', 'a retry with the same key returns the same order');
  perform t.ok(o1 = o2, 'and the identical answer');
  perform t.as_admin();
  perform t.ok((select count(*) from orders where slot_id = slot and student_id = t.id('idem_A')) = 1, 'only one order was created');
  perform t.ok((select stock_qty from menu_items where id = i) = 18, 'stock was taken once (20 - 2)');

  -- ---- the same key with a different order is refused ----
  perform t.as_user('idem_A');
  perform t.throws('PT422', format($q$ select api_place_order(%L, 'Anaya', '[{"menuItemId":"%s","qty":5}]', null, null, 0, 'UPI', null, %L) $q$, slot, i, k));

  -- ---- another student using the same key text is independent ----
  perform t.as_user('idem_B');
  o2 := api_place_order(slot, 'Bharat', jsonb_build_array(jsonb_build_object('menuItemId', i, 'qty', 1)), null, null, 0, 'UPI', null, k);
  perform t.ok(o2->>'id' <> o1->>'id' and o2->>'studentName' = 'Bharat', 'keys are per student');
  perform t.as_admin();
  perform t.ok((select stock_qty from menu_items where id = i) = 17, 'stock 17 after the second student');

  -- ---- no key: nothing changes (two identical orders are two orders) ----
  perform t.as_user('idem_B');
  perform api_place_order(slot, 'Bharat', jsonb_build_array(jsonb_build_object('menuItemId', i, 'qty', 1)));
  perform api_place_order(slot, 'Bharat', jsonb_build_array(jsonb_build_object('menuItemId', i, 'qty', 1)));
  perform t.as_admin();
  perform t.ok((select count(*) from orders where slot_id = slot and student_id = t.id('idem_B')) = 3, 'without a key every call is a new order');

  -- ---- a failed order is not remembered: retry after fixing the cause works ----
  perform t.as_user('idem_A');
  perform t.throws('PT409', format($q$ select api_place_order(%L, 'Anaya', '[{"menuItemId":"%s","qty":99}]', null, null, 0, 'UPI', null, 'order-fail-0001') $q$, slot, i));
  perform t.as_admin();
  update menu_items set stock_qty = 500 where id = i;
  perform t.as_user('idem_A');
  o1 := api_place_order(slot, 'Anaya', jsonb_build_array(jsonb_build_object('menuItemId', i, 'qty', 99)), null, null, 0, 'UPI', null, 'order-fail-0001');
  perform t.ok(o1->>'status' = 'placed', 'the same key works once the problem is gone (the failure was not stored)');

  -- ---- bad keys ----
  perform t.throws('PT400', format($q$ select api_place_order(%L, 'A', '[{"menuItemId":"%s","qty":1}]', null, null, 0, 'UPI', null, 'x') $q$, slot, i));
  perform t.throws('PT400', format($q$ select api_place_order(%L, 'A', '[{"menuItemId":"%s","qty":1}]', null, null, 0, 'UPI', null, %L) $q$, slot, i, repeat('k', 129)));
  perform t.throws('PT400', format($q$ select api_place_order(%L, 'A', '[{"menuItemId":"%s","qty":1}]', null, null, 0, 'UPI', null, 'has spaces and ; semicolons') $q$, slot, i));

  -- ---- restock: a double tap adds once ----
  perform t.as_admin();
  update menu_items set stock_qty = 10 where id = i;
  perform t.as_user('idem_owner');
  o1 := api_restock_item(i, 25, 'restock-0001-aa');
  o2 := api_restock_item(i, 25, 'restock-0001-aa');
  perform t.ok(o1 = o2, 'a repeated restock returns the same answer');
  perform t.as_admin();
  perform t.ok((select stock_qty from menu_items where id = i) = 35, 'stock rose by 25 once');
  perform t.ok((select count(*) from restock_logs where menu_item_id = i) = 1, 'one restock log row');
  perform t.as_user('idem_owner');
  perform t.throws('PT422', format($q$ select api_restock_item(%L, 30, 'restock-0001-aa') $q$, i));
  perform t.ok((api_restock_item(i, 5)->'item'->>'stockQty')::int = 40, 'without a key it works as before');

  -- ---- stock adjustment: a double tap removes once ----
  o1 := api_adjust_stock(i, 'remove', 3, 'damaged', null, 'adjust-0001-aa');
  o2 := api_adjust_stock(i, 'remove', 3, 'damaged', null, 'adjust-0001-aa');
  perform t.ok(o1 = o2, 'a repeated adjustment returns the same answer');
  perform t.as_admin();
  perform t.ok((select stock_qty from menu_items where id = i) = 37, 'stock fell by 3 once (40 - 3)');
  perform t.ok((select count(*) from stock_adjustments where menu_item_id = i) = 1, 'one adjustment row');

  -- ---- who sees what ----
  perform t.ok(not has_table_privilege('authenticated', 'public.idempotency_keys', 'select,insert,update,delete'), 'the key table stays closed');
  perform t.ok((select count(*) from idempotency_keys where scope like t.id('idem_A')::text || ':%') >= 1, 'keys are stored per student and function');

  -- ---- cleanup job still works ----
  update idempotency_keys set created_at = now() - interval '2 days' where key = 'order-0001-aaaa' and scope like t.id('idem_A')::text || '%';
  perform t.ok(purge_idempotency_keys() >= 1, 'old keys are purged by the daily job');
end $$;
