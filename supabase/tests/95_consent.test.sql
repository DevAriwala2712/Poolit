-- Proof of consent and the 18+ confirmation. Uses the t.* helpers from 10_api_security.test.sql.

do $$
declare
  sA uuid; sB uuid; r jsonb;
begin
  insert into auth.users (email, phone) values (null, '+919700000001') returning id into sA;
  insert into auth.users (email, phone) values (null, '+919700000002') returning id into sB;
  insert into t.ids values ('k_A', sA), ('k_B', sB);

  perform t.as_anon();
  perform t.throws('42501', $q$ select api_record_consent('2026-11', true) $q$);

  perform t.as_user('k_A');
  perform t.throws('PT400', $q$ select api_record_consent('2026-11', false) $q$);      -- must confirm 18+
  perform t.throws('PT400', $q$ select api_record_consent('2026-11', null) $q$);
  perform t.throws('PT400', $q$ select api_record_consent('', true) $q$);
  perform t.throws('PT400', format($q$ select api_record_consent(%L, true) $q$, repeat('x', 41)));

  r := api_record_consent('2026-11', true);
  perform t.ok(r->>'version' = '2026-11' and jsonb_typeof(r->'acceptedAt') = 'number', 'consent is recorded with the version and the time');
  perform t.as_admin();
  perform t.ok((select count(*) from student_consents where user_id = sA) = 1, 'one row');
  perform t.as_user('k_A');
  perform t.ok(api_record_consent('2026-11', true)->>'acceptedAt' = r->>'acceptedAt', 'recording the same version again changes nothing, the first time stays');
  perform api_record_consent('2027-02', true);
  perform t.as_admin();
  perform t.ok((select count(*) from student_consents where user_id = sA) = 2, 'a new version adds a row, so the history is kept');

  -- own data only
  perform t.as_user('k_B');
  perform t.ok(jsonb_array_length(api_export_my_data()->'consents') = 0, 'another student has no consents');
  perform t.as_user('k_A');
  r := api_export_my_data();
  perform t.ok(jsonb_array_length(r->'consents') = 2 and r->'consents'->0->>'version' = '2026-11' and (r->'consents'->0->>'ageConfirmed')::boolean, 'the export lists the student''s consents');

  perform t.as_admin();
  perform t.ok(not has_table_privilege('authenticated', 'public.student_consents', 'select,insert,update,delete')
           and not has_table_privilege('anon', 'public.student_consents', 'select'), 'the table is closed to the public roles');
  perform t.ok(exists (select 1 from audit_log where table_name = 'student_consents' and op = 'INSERT' and actor = sA), 'the consent is in the audit log');

  -- gone with the account
  perform t.as_user('k_A');
  perform api_delete_my_account('DELETE');
  perform t.as_admin();
  perform t.ok(not exists (select 1 from student_consents where user_id = sA), 'deleting the account removes the consents');
  perform t.ok(not exists (select 1 from audit_log where table_name = 'student_consents' and row_id = sA::text), 'and their trace in the audit log');
end $$;
