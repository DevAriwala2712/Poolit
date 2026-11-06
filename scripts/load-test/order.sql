-- One student places an order, exactly as the app does (the real api_place_order, as a signed-in student).
\set n random(1, 20000)
\set h random(1, 17)
select id as sid from load.students where n = :n \gset
select slot_id, item_id from load.pools where h = :h \gset
begin;
select set_config('request.jwt.claims', json_build_object('sub', ':sid', 'role', 'authenticated')::text, true);
set local role authenticated;
select api_place_order(':slot_id'::uuid, 'Load Student', jsonb_build_array(jsonb_build_object('menuItemId', ':item_id', 'qty', 1)), 'A', '101', 0, 'UPI', null, md5(random()::text));
commit;
