-- A student's rights over their own data (India's DPDP Act): see everything held about them,
-- and have their account erased. Orders must survive for the store's accounts, but with the
-- student's name, room and note removed. Uses the t.* helpers from 10_api_security.test.sql.

do $$
declare
  h uuid; v uuid; i uuid; own uuid; sA uuid; sB uuid; sV uuid; slot uuid; oA jsonb; oB jsonb; r jsonb;
  orders_before integer;
begin
  update vendors set accepting_orders = true;
  insert into hostels (name) values ('Privacy Hostel') returning id into h;
  insert into vendors (name, hostel_id) values ('Privacy Store', h) returning id into v;
  insert into menu_items (vendor_id, name, category, price, unit, stock_qty) values (v, 'Privacy Chips', 'Snacks', 20, '50 g', 100) returning id into i;
  insert into auth.users (email) values ('privacy-owner@example.com') returning id into own;
  insert into vendor_users (user_id, vendor_id, role) values (own, v, 'owner');
  insert into auth.users (email, phone) values (null, '+919400000001') returning id into sA;
  insert into auth.users (email, phone) values (null, '+919400000002') returning id into sB;
  insert into t.ids values ('p_h', h), ('p_v', v), ('p_i', i), ('p_owner', own), ('p_A', sA), ('p_B', sB);

  perform t.as_anon();
  slot := (api_current_slot(h)->'slot'->>'id')::uuid;
  perform t.as_admin();
  insert into t.ids values ('p_slot', slot);

  -- A and B each have a profile and an order
  perform t.as_user('p_A');
  perform api_update_me('Anaya Sharma', h, 'A', '204');
  oA := api_place_order(slot, 'Anaya Sharma', jsonb_build_array(jsonb_build_object('menuItemId', i, 'qty', 2)), 'A', '204', 10, 'UPI', 'leave at the door', 'privacy-key-A1');
  perform t.as_user('p_B');
  perform api_update_me('Bharat Rao', h, 'B', '101');
  oB := api_place_order(slot, 'Bharat Rao', jsonb_build_array(jsonb_build_object('menuItemId', i, 'qty', 1)), 'B', '101', 0, 'Cash on delivery', null);

  -- ---- Seeing your own data ----
  perform t.as_user('p_A');
  r := api_export_my_data();
  perform t.ok(r->'account'->>'phone' = '+919400000001', 'the export has the account phone');
  perform t.ok(r->'profile'->>'name' = 'Anaya Sharma' and r->'profile'->>'room' = '204', 'and the saved profile');
  perform t.ok(jsonb_array_length(r->'orders') = 1 and r->'orders'->0->>'id' = oA->>'id', 'and the student''s own orders');
  perform t.ok(r->'orders'->0->>'note' = 'leave at the door', 'including the note they wrote');
  perform t.ok(jsonb_typeof(r->'exportedAt') = 'string', 'with the time of the export');
  perform t.ok(r::text not like '%Bharat%' and r::text not like '%919400000002%', 'and nothing about anyone else');
  perform t.as_user('p_B');
  perform t.ok(api_export_my_data()::text not like '%Anaya%', 'another student never sees it');
  perform t.as_anon();
  perform t.throws('42501', 'select api_export_my_data()');

  -- ---- Deleting needs an explicit confirmation ----
  perform t.as_user('p_A');
  perform t.throws('PT400', 'select api_delete_my_account()');
  perform t.throws('PT400', $q$ select api_delete_my_account('yes') $q$);
  perform t.as_anon();
  perform t.throws('42501', $q$ select api_delete_my_account('DELETE') $q$);

  -- ---- ...and is refused while an order is still on its way ----
  perform t.as_user('p_A');
  perform t.throws('PT409', $q$ select api_delete_my_account('DELETE') $q$);

  -- ---- a store account cannot delete itself this way ----
  perform t.as_user('p_owner');
  perform t.throws('PT403', $q$ select api_delete_my_account('DELETE') $q$);

  -- the order is delivered
  perform api_close_slot(slot);
  perform api_dispatch_slot(slot);
  perform api_mark_delivered((oA->>'id')::uuid);
  perform api_mark_delivered((oB->>'id')::uuid, 500);

  -- ---- Deleting: the account goes, the orders stay but are scrubbed ----
  perform t.as_admin();
  select count(*) into orders_before from orders where slot_id = slot;
  perform t.as_user('p_A');
  r := api_delete_my_account('DELETE');
  perform t.ok((r->>'deleted')::boolean, 'the deletion is confirmed');
  perform t.as_admin();
  perform t.ok(not exists (select 1 from auth.users where id = t.id('p_A')), 'the login account is gone');
  perform t.ok(not exists (select 1 from students where user_id = t.id('p_A')), 'and the saved profile');
  perform t.ok(not exists (select 1 from idempotency_keys where scope like t.id('p_A')::text || ':%'), 'and the retry keys');
  perform t.ok((select count(*) from orders where slot_id = slot) = orders_before, 'no order was lost (the store still needs its accounts)');
  perform t.ok((select student_name from orders where id = (oA->>'id')::uuid) = 'Deleted student', 'the student''s name is removed from the order');
  perform t.ok((select block is null and room is null and note is null and student_id is null from orders where id = (oA->>'id')::uuid), 'and the room, block, note and account link');
  perform t.ok((select subtotal_paise from orders where id = (oA->>'id')::uuid) = 4000 and (select status from orders where id = (oA->>'id')::uuid) = 'delivered', 'while the amounts and status stay for the accounts');
  perform t.ok((select count(*) from order_fee_ledger where order_id = (oA->>'id')::uuid) in (0, 1), 'the commission ledger is untouched');

  -- another student is not affected
  perform t.ok((select student_name from orders where id = (oB->>'id')::uuid) = 'Bharat Rao' and exists (select 1 from auth.users where id = t.id('p_B')), 'other students keep their data');
  perform t.as_user('p_B');
  perform t.ok(api_export_my_data()->'orders'->0->>'studentName' = 'Bharat Rao', 'and can still see it');

  -- store staff still see the scrubbed order, not the old name
  perform t.as_user('p_owner');
  perform t.ok(api_vendor_orders(t.id('p_v'))::text not like '%Anaya%', 'the store can no longer see the deleted student''s name');

  -- a second attempt with the old login finds nothing to delete
  perform t.as_user('p_A');
  perform t.throws('PT404', $q$ select api_delete_my_account('DELETE') $q$);
end $$;
