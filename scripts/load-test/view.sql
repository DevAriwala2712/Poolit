-- One student's app refresh: the real api_student_view for their hostel (the call the app makes every 15 s).
\set n random(1, 20000)
\set h random(1, 17)
select id as sid from load.students where n = :n \gset
select hostel_id as hid from load.pools where h = :h \gset
begin;
select set_config('request.jwt.claims', json_build_object('sub', ':sid', 'role', 'authenticated')::text, true);
set local role authenticated;
select api_student_view(':hid'::uuid);
commit;
