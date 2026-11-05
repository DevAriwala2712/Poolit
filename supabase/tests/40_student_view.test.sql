-- api_student_view: everything the student app needs, in ONE call.
-- Uses the t.* helpers from 10_api_security.test.sql (files run in name order).

do $$
declare
  h3 uuid; h4 uuid; v3 uuid; i3 uuid; sA uuid; sB uuid; slot3 uuid;
  r jsonb; oa jsonb;
begin
  -- Earlier test files leave one store paused; this file wants every store open.
  update vendors set accepting_orders = true;

  -- Fresh fixtures: a hostel with a store (and a menu), and a hostel with no store.
  insert into hostels (name) values ('Zeta Hostel') returning id into h3;
  insert into hostels (name) values ('Empty Hostel, no store') returning id into h4;
  insert into vendors (name, hostel_id) values ('Zeta Store', h3) returning id into v3;
  insert into menu_items (vendor_id, name, category, price, unit, stock_qty) values (v3, 'Zeta Chips', 'Snacks', 20, '50 g', 50) returning id into i3;
  insert into t.ids values ('h3', h3), ('h4', h4), ('v3', v3), ('i3z', i3);

  -- ---- Anonymous visitor, no hostel chosen ----
  perform t.as_anon();
  r := api_student_view();
  perform t.ok(jsonb_array_length(r->'hostels') >= 4, 'all hostels are listed for the picker');
  perform t.ok(jsonb_typeof(r->'hostelId') = 'string', 'a hostel with a store is picked when none is given');
  perform t.ok((select count(*) from jsonb_array_elements(r->'vendors')) = 1, 'only the chosen hostel''s store is returned, not every store');
  perform t.ok(jsonb_array_length(r->'vendors'->0->'menu') >= 1, 'the store comes with its menu');
  perform t.ok(jsonb_array_length(r->'slots') = 1 and r->'slots'->0->>'status' = 'open', 'the current pool is returned');
  perform t.ok(r->'orders' = '[]'::jsonb, 'a visitor has no orders');
  perform t.ok((r->'poolCounts'->>(r->'slots'->0->>'id'))::int = 0, 'pool size is reported');

  -- ---- A chosen hostel ----
  r := api_student_view(t.id('h3'));
  perform t.ok(r->>'hostelId' = t.id('h3')::text, 'the requested hostel is used');
  perform t.ok(r->'vendors'->0->>'id' = t.id('v3')::text, 'its store is returned');
  slot3 := (r->'slots'->0->>'id')::uuid;
  perform t.as_admin();
  insert into t.ids values ('slot3', slot3);

  -- A hostel with no store, and a made-up one, fall back instead of failing.
  perform t.as_anon();
  perform t.ok(jsonb_typeof(api_student_view(t.id('h4'))->'hostelId') = 'string' and api_student_view(t.id('h4'))->>'hostelId' <> t.id('h4')::text, 'a hostel with no store falls back');
  perform t.ok(jsonb_typeof(api_student_view('00000000-0000-0000-0000-000000000000')->'hostelId') = 'string', 'an unknown hostel falls back');
  perform t.as_admin();

  -- ---- Two students order in that pool ----
  insert into auth.users (email, phone) values (null, '+919100000001') returning id into sA;
  insert into auth.users (email, phone) values (null, '+919100000002') returning id into sB;
  insert into t.ids values ('sA', sA), ('sB', sB);
  perform t.as_user('sA');
  oa := api_place_order(slot3, 'Anaya', jsonb_build_array(jsonb_build_object('menuItemId', i3, 'qty', 2)));
  perform t.as_user('sB');
  perform api_place_order(slot3, 'Bharat', jsonb_build_array(jsonb_build_object('menuItemId', i3, 'qty', 1)));

  -- A sees only A's order, but the pool size counts everyone.
  perform t.as_user('sA');
  r := api_student_view(t.id('h3'));
  perform t.ok(jsonb_array_length(r->'orders') = 1 and r->'orders'->0->>'id' = oa->>'id', 'a student sees only their own order');
  perform t.ok(r::text not like '%Bharat%', 'another student''s name never appears');
  perform t.ok((r->'poolCounts'->>slot3::text)::int = 2, 'the pool size counts every student''s order');
  perform t.ok(jsonb_array_length(r->'slots') = 1, 'the pool is returned once even though it is also the student''s order pool');

  -- B likewise
  perform t.as_user('sB');
  r := api_student_view(t.id('h3'));
  perform t.ok(jsonb_array_length(r->'orders') = 1 and r->'orders'->0->>'studentName' = 'Bharat', 'B sees only B''s order');
  perform t.ok(r::text not like '%Anaya%', 'A''s name never appears for B');

  -- ---- Browsing another hostel still shows past orders with their store and pool ----
  r := api_student_view(t.id('h1'));
  perform t.ok(r->>'hostelId' = t.id('h1')::text, 'student can browse another hostel');
  perform t.ok(jsonb_array_length(r->'orders') = 1, 'own orders still come back');
  perform t.ok(exists (select 1 from jsonb_array_elements(r->'slots') s where s->>'id' = slot3::text), 'the pool of an earlier order is included');
  perform t.ok(exists (select 1 from jsonb_array_elements(r->'vendors') v where v->>'id' = t.id('v3')::text and jsonb_array_length(v->'menu') >= 1), 'and so is its store with menu');
  perform t.as_admin();

  -- ---- What it never contains ----
  perform t.as_user('sA');
  r := api_student_view(t.id('h3'));
  perform t.ok(r::text not like '%@%', 'no email addresses');
  perform t.ok(r::text not like '%+91%', 'no phone numbers');
  perform t.ok(not (r::text ~ '"(userId|vendorUsers|role)"'), 'no account or role data');
  perform t.as_admin();

  -- ---- Paused store: still answers ----
  update vendors set accepting_orders = false where id = v3;
  perform t.as_anon();
  perform t.ok(api_student_view(t.id('h3')) ? 'slots', 'a paused store still returns a view');
  perform t.as_admin();
  update vendors set accepting_orders = true where id = v3;

  -- ---- It is one call: the function does the work, not the client ----
  perform t.ok(has_function_privilege('anon', 'public.api_student_view(uuid)', 'execute'), 'visitors may call it');
end $$;
