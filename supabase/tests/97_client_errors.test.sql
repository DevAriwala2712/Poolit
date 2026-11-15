-- Error reports from the apps: anyone may report, duplicates merge, size and rate are capped,
-- only Poolit admins read. Uses the t.* helpers from 10_api_security.test.sql.

do $$
declare
  sA uuid; adm uuid; r jsonb; n integer;
begin
  insert into auth.users (email, phone) values (null, '+919800000001') returning id into sA;
  insert into auth.users (email) values ('err-admin@example.com') returning id into adm;
  insert into platform_admins (user_id) values (adm);
  insert into t.ids values ('e_A', sA), ('e_admin', adm);
  delete from client_errors;

  -- a visitor can report
  perform t.as_anon();
  perform api_report_error('student', 'TypeError: x is undefined', 'at a (app.js:1)', 'https://poolit.app/cart?token=secret', 'Mozilla/5.0');
  perform t.as_admin();
  perform t.ok((select count(*) from client_errors) = 1, 'a visitor''s report is stored');
  perform t.ok((select page from client_errors) = 'https://poolit.app/cart', 'the query string (which can hold secrets) is dropped from the page');
  perform t.ok((select user_id is null from client_errors), 'with no user when nobody is signed in');

  -- the same error merges
  perform t.as_user('e_A');
  perform api_report_error('student', 'TypeError: x is undefined', 'at a (app.js:1)', 'https://poolit.app/cart?x=1');
  perform api_report_error('student', 'TypeError: x is undefined', null, 'https://poolit.app/cart');
  perform t.as_admin();
  perform t.ok((select count(*) from client_errors) = 1 and (select occurrences from client_errors) = 3, 'the same error is one row with a count of 3');
  perform t.as_user('e_A');
  perform api_report_error('student', 'TypeError: x is undefined', null, 'https://poolit.app/orders');
  perform api_report_error('vendor', 'TypeError: x is undefined', null, 'https://poolit.app/cart');
  perform t.as_admin();
  perform t.ok((select count(*) from client_errors) = 3, 'a different page or app is a different error');
  perform t.ok((select user_id from client_errors where page like '%/orders') = sA, 'the user id is kept only when signed in');

  -- size limits and junk
  perform t.as_anon();
  perform api_report_error('student', repeat('m', 5000), repeat('s', 9000), repeat('p', 900), repeat('u', 900));
  perform api_report_error('nonsense', 'x');
  perform api_report_error('student', '   ');
  perform api_report_error('student', null);
  perform t.as_admin();
  perform t.ok((select length(message) = 300 and length(stack) = 2000 and length(page) = 200 and length(user_agent) = 200 from client_errors where length(message) = 300), 'long text is cut to fixed lengths');
  perform t.ok((select count(*) from client_errors) = 4, 'an unknown app and empty messages are ignored');

  -- flood brake: 300 new kinds a minute
  perform t.as_anon();
  for n in 1..320 loop perform api_report_error('student', 'flood ' || n); end loop;
  perform t.as_admin();
  perform t.ok((select count(*) from client_errors where first_at > now() - interval '1 minute') <= 300, 'no more than 300 new kinds of error are accepted a minute');
  perform t.ok((select count(*) from client_errors) < 330, 'so a flood cannot fill the table');

  -- reading
  perform t.as_user('e_admin');
  r := api_client_errors(5);
  perform t.ok(jsonb_array_length(r) = 5 and (r->0->>'lastAt')::bigint >= (r->1->>'lastAt')::bigint, 'an admin reads the newest first, up to the limit');
  perform t.as_user('e_A');
  perform t.throws('PT403', 'select api_client_errors()');
  perform t.as_anon();
  perform t.throws('42501', 'select api_client_errors()');
  perform t.as_user('e_A');
  perform t.throws('42501', 'select purge_client_errors()');
  perform t.throws('42501', 'select * from client_errors');

  -- retention
  perform t.as_admin();
  update client_errors set last_at = now() - interval '31 days' where message = 'flood 1';
  n := purge_client_errors();
  perform t.ok(n >= 0 and not exists (select 1 from client_errors where last_at < now() - interval '30 days'), 'reports older than 30 days are purged');
end $$;
