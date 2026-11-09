-- Error tracking on the free stack: the apps report crashes here, and Poolit admins read them.
--
-- Anyone may report (a crash can happen before sign-in), so the function is built to be hard
-- to abuse: text is cut to fixed lengths, the same error (same app, message and page) is
-- merged into one row with a counter, and no more than 300 distinct reports are accepted
-- a minute across the whole system. Nothing personal is stored: no name, number or room; the
-- page is stored without its query string, and the user id only when signed in. Kept 30 days.

create table if not exists public.client_errors (
  fingerprint text primary key,
  app text not null check (app in ('student', 'vendor')),
  message text not null,
  stack text,
  page text,
  user_agent text,
  user_id uuid,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  occurrences integer not null default 1
);
create index if not exists client_errors_last_at_idx on public.client_errors (last_at desc);
alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;

create or replace function public.api_report_error(
  p_app text, p_message text, p_stack text default null, p_page text default null, p_user_agent text default null)
 returns void
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_msg text := left(btrim(coalesce(p_message, '')), 300);
  v_page text := left(split_part(coalesce(p_page, ''), '?', 1), 200);
  v_fp text;
  v_uid uuid;
begin
  if p_app not in ('student', 'vendor') or v_msg = '' then return; end if;
  v_fp := md5(p_app || '|' || v_msg || '|' || v_page);
  begin v_uid := auth.uid(); exception when others then v_uid := null; end;

  if exists (select 1 from client_errors where fingerprint = v_fp) then
    update client_errors set occurrences = occurrences + 1, last_at = now() where fingerprint = v_fp;
    return;
  end if;
  -- system-wide brake on new kinds of error
  if (select count(*) from client_errors where first_at > now() - interval '1 minute') >= 300 then return; end if;

  insert into client_errors (fingerprint, app, message, stack, page, user_agent, user_id)
  values (v_fp, p_app, v_msg, left(p_stack, 2000), nullif(v_page, ''), left(p_user_agent, 200), v_uid)
  on conflict (fingerprint) do update set occurrences = client_errors.occurrences + 1, last_at = now();
end;
$function$;

create or replace function public.api_client_errors(p_limit integer default 100)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
begin
  perform private.require_user();
  if not private.is_platform_admin() then
    perform private.fail(403, 'Only the Poolit team can read error reports');
  end if;
  return coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'app', e.app, 'message', e.message, 'stack', e.stack, 'page', e.page, 'userAgent', e.user_agent,
             'firstAt', private.ms(e.first_at), 'lastAt', private.ms(e.last_at), 'occurrences', e.occurrences))
           order by e.last_at desc)
      from (select * from client_errors order by last_at desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) e), '[]'::jsonb);
end;
$function$;

create or replace function public.purge_client_errors()
 returns integer
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare n integer;
begin
  delete from client_errors where last_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$function$;

revoke all on function public.api_report_error(text, text, text, text, text) from public;
grant execute on function public.api_report_error(text, text, text, text, text) to anon, authenticated;
revoke all on function public.api_client_errors(integer) from public, anon, authenticated;
grant execute on function public.api_client_errors(integer) to authenticated;
revoke all on function public.purge_client_errors() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'poolit-purge-client-errors';
select cron.schedule('poolit-purge-client-errors', '40 3 * * *', $$select public.purge_client_errors()$$);
