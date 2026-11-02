#!/usr/bin/env bash
# Builds a throwaway database that looks enough like Supabase for the
# migrations to run (auth schema, API roles, a stand-in for pg_cron), then
# applies every migration in order. Used by the backend DB integration tests
# and CI. Usage: DATABASE_URL=postgres://... scripts/db-test-setup.sh
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL}"
cd "$(dirname "$0")/.."

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
drop schema if exists public cascade; create schema public;
grant usage on schema public to anon, authenticated, service_role;
create schema if not exists extensions;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text, phone text);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
-- Stand-in for pg_cron so the scheduling migration applies.
create schema if not exists cron;
create table if not exists cron.job (jobid serial primary key, jobname text, schedule text, command text);
create or replace function cron.schedule(n text, s text, c text) returns int language sql as $$ insert into cron.job(jobname, schedule, command) values (n, s, c) returning jobid $$;
create or replace function cron.unschedule(j int) returns boolean language sql as $$ delete from cron.job where jobid = j returning true $$;
SQL

for f in supabase/migrations/*.sql; do
  # pg_cron is a Supabase-hosted extension; the stub above replaces it.
  sed 's/^create extension if not exists pg_cron;//' "$f" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f - >/dev/null
done
echo "migrations applied"
