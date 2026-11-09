-- A student can cancel an order until the pool closes. Uses the t.* helpers from 10_api_security.test.sql.

do $$
declare
  h uuid; v uuid; i uuid; own uuid; sA uuid; sB uuid; sC uuid; slot uuid;
  oA jsonb; oB jsonb; oC jsonb; oD jsonb; r jsonb; stock0 integer;
begin
  update vendors set accepting_orders = true;
  insert into hostels (name) values ('Cancel Hostel') returning id into h;
  insert into vendors (name, hostel_id) values ('Cancel Store', h) returning id into v;
  insert into menu_items (vendor_id, name, category, price, unit, stock_qty) values (v, 'Cancel Chips', 'Snacks', 20, '50 g', 100) returning id into i;
  insert into auth.users (email) values ('cancel-owner@example.com') returning id into own;
  insert into vendor_users (user_id, vendor_id, role) values (own, v, 'owner');
  insert into auth.users (email, phone) values (null, '+919600000001') returning id into sA;
  insert into auth.users (email, phone) values (null, '+919600000002') returning id into sB;
  insert into auth.users (email, phone) values (null, '+919600000003') returning id into sC;
  insert into t.ids values ('x_h', h), ('x_v', v), ('x_i', i), ('x_owner', own), ('x_A', sA), ('x_B', sB), ('x_C', sC);
  perform t.as_anon();
  slot := (api_current_slot(h)->'slot'->>'id')::uuid;
  perform t.as_admin();

  perform t.as_user('x_A');
  oA := api_place_order(slot, 'Anaya', jsonb_build_array(jsonb_build_object('menuItemId', i, 'qty', 3)), 'A', '1', 0, 'UPI');
  perform t.as_user('x_B');
  oB := api_place_order(slot, 'Bharat', jsonb_build_array(jsonb_build_object('menuItemId', i, 'qty', 1)), 'A', '2', 0, 'UPI');
  perform t.as_user('x_C');
  oC := api_place_order(slot, 'Chirag', jsonb_build_array(jsonb_build_object('menuItemId', i, 'qty', 1)), 'A', '3', 0, 'UPI');
  perform t.as_admin();
  select stock_qty into stock0 from menu_items where id = i;
  perform t.ok(stock0 = 95, 'three orders took 5 units out of stock');

  -- who may cancel
  perform t.as_user('x_B');
  perform t.throws('PT404', format($q$ select api_cancel_order(%L) $q$, oA->>'id'));      -- not yours
  perform t.as_user('x_owner');
  perform t.throws('PT404', format($q$ select api_cancel_order(%L) $q$, oA->>'id'));      -- the store cannot cancel for the student
  perform t.as_anon();
  perform t.throws('42501', format($q$ select api_cancel_order(%L) $q$, oA->>'id'));
  perform t.as_user('x_A');
  perform t.throws('PT404', $q$ select api_cancel_order('00000000-0000-4000-8000-000000000000') $q$);

  -- A cancels
  r := api_cancel_order((oA->>'id')::uuid);
  perform t.ok(r->'order'->>'status' = 'cancelled', 'the order is cancelled');
  perform t.as_admin();
  perform t.ok((select stock_qty from menu_items where id = i) = 98, 'its 3 units went back into stock');
  perform t.as_user('x_A');
  perform t.ok(api_cancel_order((oA->>'id')::uuid)->>'message' = 'Order already cancelled', 'cancelling again is harmless');
  perform t.as_admin();
  perform t.ok((select stock_qty from menu_items where id = i) = 98, 'and does not return the stock twice');
  perform t.as_user('x_A');
  perform t.ok((select o->>'status' from jsonb_array_elements(api_my_orders()->'orders') o where o->>'id' = oA->>'id') = 'cancelled', 'the student still sees it, marked cancelled');

  -- the store never sees it
  perform t.as_user('x_owner');
  perform t.ok(not exists (select 1 from jsonb_array_elements(api_slot_orders(slot)) o where o->>'id' = oA->>'id'), 'not in the pool''s order list');
  perform t.ok(not exists (select 1 from jsonb_array_elements(api_vendor_orders(v)) o where o->>'id' = oA->>'id'), 'not in the store''s orders');
  perform t.ok(not exists (select 1 from jsonb_array_elements(api_vendor_overview()->'orders') o where o->>'id' = oA->>'id'), 'not in the console overview');
  perform t.ok((select coalesce(sum((p->>'totalQty')::int), 0) from jsonb_array_elements(api_pick_list(slot)) p) = 2, 'and the pick list counts only the 2 remaining units');

  -- the pool and the fee ignore it
  perform t.as_anon();
  perform t.ok((api_live_fee(slot)->>'orderCount')::int = 2 and (api_live_fee(slot)->>'fee')::numeric = 20, 'the live pool count is 2');
  perform t.as_user('x_owner');
  perform api_close_slot(slot);
  perform t.as_admin();
  perform t.ok((select delivery_fee_charged from orders where id = (oB->>'id')::uuid) = 20, 'the delivery fee is worked out for 2 orders (Rs 20), not 3 (Rs 10)');
  perform t.ok((select status from orders where id = (oA->>'id')::uuid) = 'cancelled' and (select delivery_fee_charged from orders where id = (oA->>'id')::uuid) is null, 'the cancelled order is not pooled and has no fee');

  -- too late once the pool has closed
  perform t.as_user('x_B');
  perform t.throws('PT409', format($q$ select api_cancel_order(%L) $q$, oB->>'id'));

  -- finish the pool; the cancellation is recorded
  perform t.as_user('x_owner');
  perform api_dispatch_slot(slot);
  perform t.as_admin();
  update slots set status = 'dispatched' where id = slot;
  perform t.ok(exists (select 1 from audit_log where table_name = 'orders' and row_id = oA->>'id' and new_values->>'status' = 'cancelled' and actor = sA), 'the cancellation is in the audit log, against the student');
end $$;
