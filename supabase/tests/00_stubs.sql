-- Minimal stand-ins for the parts of a Supabase project that the migrations
-- rely on, so the database can be tested on a plain Postgres (local or CI).
-- NOT applied to a real project.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text
);

-- Same behaviour as Supabase's auth.uid(): the "sub" claim of the request JWT.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(coalesce(
    current_setting('request.jwt.claim.sub', true),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  ), '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- pg_cron is a Supabase extension that plain Postgres (local, CI) lacks. The
-- test runner drops the `create extension pg_cron` line and these stand-ins
-- let the scheduling statements in the migrations run as no-ops.
create schema if not exists cron;
create table if not exists cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create or replace function cron.schedule(p_name text, p_schedule text, p_command text) returns bigint language sql as
  $$ insert into cron.job (jobname, schedule, command) values (p_name, p_schedule, p_command) returning jobid $$;
create or replace function cron.unschedule(p_jobid bigint) returns boolean language sql as
  $$ delete from cron.job where jobid = p_jobid returning true $$;
