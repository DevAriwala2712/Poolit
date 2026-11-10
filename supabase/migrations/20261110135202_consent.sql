-- Proof of consent, as the Digital Personal Data Protection Act expects: when a student accepted
-- which version of the Terms and Privacy Policy, and that they confirmed they are 18 or older.
-- One row per student per version; recording the same version twice changes nothing. A new
-- policy version means a new row, so the history of what they agreed to is kept.
-- Part of the student's data export; removed with the account.

create table if not exists public.student_consents (
  user_id uuid not null references auth.users (id) on delete cascade,
  version text not null check (char_length(version) between 1 and 40),
  age_confirmed boolean not null check (age_confirmed),
  accepted_at timestamptz not null default now(),
  primary key (user_id, version)
);
alter table public.student_consents enable row level security;
revoke all on public.student_consents from anon, authenticated;

create or replace function public.api_record_consent(p_version text, p_age_confirmed boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := private.require_user();
  v_version text := btrim(coalesce(p_version, ''));
  v_row student_consents;
begin
  if p_age_confirmed is not true then
    perform private.fail(400, 'You must be 18 or older to use Poolit');
  end if;
  if v_version = '' or char_length(v_version) > 40 then
    perform private.fail(400, 'version is required (max 40 characters)');
  end if;
  insert into student_consents (user_id, version, age_confirmed) values (v_uid, v_version, true)
  on conflict (user_id, version) do nothing;
  select * into v_row from student_consents where user_id = v_uid and version = v_version;
  return jsonb_build_object('version', v_row.version, 'acceptedAt', private.ms(v_row.accepted_at));
end;
$function$;

revoke all on function public.api_record_consent(text, boolean) from public, anon, authenticated;
grant execute on function public.api_record_consent(text, boolean) to authenticated;

-- The export now includes the consents.
create or replace function public.api_export_my_data()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := private.require_user();
  s students;
  v_phone text;
  v_email text;
begin
  select phone, email into v_phone, v_email from auth.users where id = v_uid;
  select * into s from students where user_id = v_uid;
  return jsonb_build_object(
    'exportedAt', now(),
    'account', jsonb_strip_nulls(jsonb_build_object('userId', v_uid, 'phone', v_phone, 'email', v_email)),
    'profile', case when s.user_id is null then null else jsonb_strip_nulls(jsonb_build_object(
        'name', s.name, 'hostelId', s.hostel_id, 'block', s.block, 'room', s.room, 'createdAt', s.created_at)) end,
    'consents', coalesce((select jsonb_agg(jsonb_build_object('version', c.version, 'ageConfirmed', c.age_confirmed, 'acceptedAt', c.accepted_at) order by c.accepted_at)
                          from student_consents c where c.user_id = v_uid), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(private.json_order(o) order by o.created_at desc)
                        from orders o where o.student_id = v_uid), '[]'::jsonb));
end;
$function$;

revoke all on function public.api_export_my_data() from public, anon, authenticated;
grant execute on function public.api_export_my_data() to authenticated;

-- Changes to consents are audited, when the audit log is installed.
do $do$
begin
  if to_regprocedure('private.audit_row()') is not null then
    drop trigger if exists audit_row_ins_del on public.student_consents;
    create trigger audit_row_ins_del after insert or delete on public.student_consents
      for each row execute function private.audit_row('', '');
  end if;
end
$do$;
