-- Cash on delivery and per-store commission.
--   * a cash-on-delivery order records the cash handed over when it is delivered,
--     and each store gets a daily cash summary (expected vs collected vs still out);
--   * the platform's commission per store is stored as terms (percent of goods, or a
--     fixed amount per order), only a platform admin can set them, and every delivered
--     order writes a ledger row (a snapshot of the terms) that feeds a monthly statement.
-- Uses the t.* helpers from 10_api_security.test.sql (files run in name order).

do $$
declare
  h uuid; v uuid; v2 uuid; i uuid; own uuid; staff uuid; own2 uuid; adm uuid; sA uuid; sB uuid; sC uuid;
  slot uuid; oA jsonb; oB jsonb; oC jsonb; r jsonb; ids uuid[];
begin
  update vendors set accepting_orders = true;
  insert into hostels (name) values ('Cash Hostel') returning id into h;
  insert into vendors (name, hostel_id) values ('Cash Store', h) returning id into v;
  insert into t.ids values ('c_h', h);
  insert into hostels (name) values ('Other Cash Hostel') returning id into h;
  insert into vendors (name, hostel_id) values ('Other Cash Store', h) returning id into v2;
  insert into menu_items (vendor_id, name, category, price, unit, stock_qty) values (v, 'Cash Maggi', 'Instant Food', 56, 'pack', 100) returning id into i;
  insert into auth.users (email) values ('cash-owner@example.com') returning id into own;
  insert into auth.users (email) values ('cash-staff@example.com') returning id into staff;
  insert into auth.users (email) values ('cash-owner2@example.com') returning id into own2;
  insert into auth.users (email) values ('platform-admin@example.com') returning id into adm;
  insert into vendor_users (user_id, vendor_id, role) values (own, v, 'owner'), (staff, v, 'staff'), (own2, v2, 'owner');
  insert into platform_admins (user_id) values (adm);
  insert into auth.users (email, phone) values (null, '+919300000001') returning id into sA;
  insert into auth.users (email, phone) values (null, '+919300000002') returning id into sB;
  insert into auth.users (email, phone) values (null, '+919300000003') returning id into sC;
  insert into t.ids values ('c_v', v), ('c_v2', v2), ('c_i', i), ('c_owner', own), ('c_staff', staff), ('c_owner2', own2),
    ('c_admin', adm), ('c_A', sA), ('c_B', sB), ('c_C', sC);

  perform t.as_anon();
  slot := (api_current_slot(t.id('c_h'))->'slot'->>'id')::uuid;
  perform t.as_admin();
  insert into t.ids values ('c_slot', slot);

  -- ---- three orders: two cash on delivery, one UPI ----
  perform t.as_user('c_A');
  oA := api_place_order(slot, 'Anaya', jsonb_build_array(jsonb_build_object('menuItemId', i, 'qty', 2)), 'A', '101', 10, 'Cash on delivery');
  perform t.as_user('c_B');
  oB := api_place_order(slot, 'Bharat', jsonb_build_array(jsonb_build_object('menuItemId', i, 'qty', 1)), 'A', '102', 0, 'UPI');
  perform t.as_user('c_C');
  oC := api_place_order(slot, 'Chirag', jsonb_build_array(jsonb_build_object('menuItemId', i, 'qty', 1)), 'A', '103', 0, 'Cash on delivery');
  perform t.ok(not (oA ? 'amountDuePaise'), 'the amount due is unknown until the pool closes and the fee is locked');

  -- ---- close and dispatch ----
  perform t.as_user('c_owner');
  perform api_close_slot(slot);
  perform api_dispatch_slot(slot);
  -- 3 orders: delivery fee 10 each. A: goods 112 + fee 10 + platform 4 + tip 10 = 136 rupees
  r := api_slot_orders(slot);
  perform t.ok((select (o->>'amountDuePaise')::int from jsonb_array_elements(r) o where o->>'id' = oA->>'id') = 13600, 'A owes 136 rupees (goods 112 + delivery 10 + platform 4 + tip 10)');
  perform t.ok((select (o->>'amountDuePaise')::int from jsonb_array_elements(r) o where o->>'id' = oC->>'id') = 7000, 'C owes 70 rupees (56 + 10 + 4)');

  -- ---- cash is recorded when the order is handed over ----
  perform t.ok(api_mark_delivered((oA->>'id')::uuid)->'order'->>'cashCollectedPaise' = '13600', 'cash defaults to the amount due');
  perform t.ok((select jsonb_typeof(o->'cashCollectedAt') from jsonb_array_elements(api_slot_orders(slot)) o where o->>'id' = oA->>'id') = 'number', 'the time the cash was taken is recorded');
  perform t.ok(api_mark_delivered((oC->>'id')::uuid, 6500)->'order'->>'cashCollectedPaise' = '6500', 'the store can record a different amount (short by 5 rupees)');
  perform t.throws('PT400', format($q$ select api_mark_delivered(%L, 7000) $q$, oB->>'id'));            -- UPI: no cash
  perform t.ok(not (api_mark_delivered((oB->>'id')::uuid)->'order' ? 'cashCollectedPaise'), 'a UPI order records no cash');
  perform t.throws('PT409', format($q$ select api_mark_delivered(%L) $q$, oA->>'id'));                  -- twice

  -- limits
  perform t.as_admin();
  update orders set status = 'dispatched', cash_collected_paise = null where id = (oC->>'id')::uuid;
  perform t.as_user('c_owner');
  perform t.throws('PT400', format($q$ select api_mark_delivered(%L, -1) $q$, oC->>'id'));
  perform t.throws('PT400', format($q$ select api_mark_delivered(%L, 99999999) $q$, oC->>'id'));
  perform api_mark_delivered((oC->>'id')::uuid, 6500);

  -- ---- daily cash summary ----
  r := api_cash_summary(t.id('c_v'));
  perform t.ok((r->>'deliveredCount')::int = 2, 'two cash orders were delivered today');
  perform t.ok((r->>'expectedPaise')::int = 20600 and (r->>'collectedPaise')::int = 20100, 'expected 206, collected 201');
  perform t.ok((r->>'differencePaise')::int = -500, 'short by 5 rupees');
  perform t.ok((r->>'outstandingCount')::int = 0, 'nothing out with riders');
  perform t.as_user('c_staff');
  perform t.ok((api_cash_summary(t.id('c_v'))->>'deliveredCount')::int = 2, 'staff can see the summary');
  perform t.as_user('c_owner2');
  perform t.throws('PT403', format($q$ select api_cash_summary(%L) $q$, t.id('c_v')));
  perform t.as_user('c_A');
  perform t.throws('PT403', format($q$ select api_cash_summary(%L) $q$, t.id('c_v')));
  perform t.as_anon();
  perform t.throws('42501', format($q$ select api_cash_summary(%L) $q$, t.id('c_v')));

  -- outstanding: a cash order on the road
  perform t.as_admin();
  update orders set status = 'dispatched' where id = (oA->>'id')::uuid;
  perform t.as_user('c_owner');
  r := api_cash_summary(t.id('c_v'));
  perform t.ok((r->>'outstandingCount')::int = 1 and (r->>'outstandingPaise')::int = 13600, 'one cash order, 136 rupees, still out');
  perform t.ok(r->'outstanding'->0->>'studentName' = 'Anaya', 'with the student named so the store can chase it');
  perform t.as_admin();
  update orders set status = 'delivered' where id = (oA->>'id')::uuid;

  -- ---- commission: no terms, no ledger ----
  perform t.ok((select count(*) from order_fee_ledger) = 0, 'no terms set: nothing was written to the ledger');

  -- only a platform admin can set terms
  perform t.as_user('c_owner');
  perform t.throws('PT403', format($q$ select api_set_fee_terms(%L, 'percent', 5) $q$, t.id('c_v')));
  perform t.as_user('c_A');
  perform t.throws('PT403', format($q$ select api_set_fee_terms(%L, 'percent', 5) $q$, t.id('c_v')));
  perform t.as_user('c_admin');
  perform t.throws('PT400', format($q$ select api_set_fee_terms(%L, 'weird', 5) $q$, t.id('c_v')));
  perform t.throws('PT400', format($q$ select api_set_fee_terms(%L, 'percent', 51) $q$, t.id('c_v')));
  perform t.throws('PT400', format($q$ select api_set_fee_terms(%L, 'percent', -1) $q$, t.id('c_v')));
  perform t.throws('PT400', format($q$ select api_set_fee_terms(%L, 'fixed_per_order', 101) $q$, t.id('c_v')));
  perform t.throws('PT404', $q$ select api_set_fee_terms('00000000-0000-4000-8000-000000000000', 'percent', 5) $q$);
  r := api_set_fee_terms(t.id('c_v'), 'percent', 5);
  perform t.ok(r->>'feeType' = 'percent' and (r->>'feeValue')::numeric = 5, 'a platform admin sets 5 percent');
  perform t.as_anon();
  perform t.throws('42501', format($q$ select api_set_fee_terms(%L, 'percent', 5) $q$, t.id('c_v')));

  -- ---- with terms, delivery writes a ledger row (a snapshot) ----
  perform t.as_admin();
  update menu_items set stock_qty = 100 where id = i;
  perform t.as_user('c_A');
  oA := api_place_order((api_current_slot(t.id('c_h'))->'slot'->>'id')::uuid, 'Anaya', jsonb_build_array(jsonb_build_object('menuItemId', i, 'qty', 2)), 'A', '101', 0, 'Cash on delivery');
  perform t.as_user('c_owner');
  perform api_close_slot((oA->>'slotId')::uuid);
  perform api_dispatch_slot((oA->>'slotId')::uuid);
  perform api_mark_delivered((oA->>'id')::uuid);
  perform t.as_admin();
  perform t.ok((select fee_paise from order_fee_ledger where order_id = (oA->>'id')::uuid) = 560, '5 percent of 112 rupees of goods is 5.60 rupees (560 paise)');
  perform t.ok((select goods_paise from order_fee_ledger where order_id = (oA->>'id')::uuid) = 11200, 'the ledger keeps the goods value');
  perform t.ok((select fee_type || fee_value::text from order_fee_ledger where order_id = (oA->>'id')::uuid) = 'percent5', 'and the terms in force at the time');

  -- changing terms later does not change past rows
  perform t.as_user('c_admin');
  perform api_set_fee_terms(t.id('c_v'), 'fixed_per_order', 3);
  perform t.as_admin();
  perform t.ok((select fee_paise from order_fee_ledger where order_id = (oA->>'id')::uuid) = 560, 'past ledger rows keep the old terms');

  -- ---- statement ----
  perform t.as_user('c_owner');
  r := api_fee_statement(t.id('c_v'), current_date - 1, current_date + 1);
  perform t.ok((r->>'orders')::int = 1 and (r->>'goodsPaise')::int = 11200 and (r->>'commissionPaise')::int = 560, 'the owner sees orders, goods and commission');
  perform t.ok(r->'terms'->>'feeType' = 'fixed_per_order', 'and the current terms');
  perform t.as_user('c_staff');
  perform t.throws('PT403', format($q$ select api_fee_statement(%L, current_date, current_date) $q$, t.id('c_v')));        -- owner or admin only
  perform t.as_user('c_owner2');
  perform t.throws('PT403', format($q$ select api_fee_statement(%L, current_date, current_date) $q$, t.id('c_v')));
  perform t.as_user('c_admin');
  perform t.ok((api_fee_statement(t.id('c_v'), current_date - 1, current_date + 1)->>'orders')::int = 1, 'a platform admin can read any store''s statement');
  perform t.throws('PT400', format($q$ select api_fee_statement(%L, current_date, current_date - 5) $q$, t.id('c_v')));

  -- ---- who can touch the tables ----
  perform t.as_admin();
  perform t.ok(not has_table_privilege('authenticated', 'public.order_fee_ledger', 'select,insert,update,delete')
           and not has_table_privilege('authenticated', 'public.vendor_fee_terms', 'select,insert,update,delete')
           and not has_table_privilege('authenticated', 'public.platform_admins', 'select,insert,update,delete')
           and not has_table_privilege('anon', 'public.order_fee_ledger', 'select'), 'the new tables are closed to the public roles');
  perform t.ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.order_fee_ledger'::regclass, 'public.vendor_fee_terms'::regclass, 'public.platform_admins'::regclass)), 'with row security on');
end $$;
