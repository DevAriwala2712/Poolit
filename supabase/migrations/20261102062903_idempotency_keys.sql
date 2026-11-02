-- Idempotency keys (Phase 1): lets clients safely retry order placement,
-- restock and stock adjustments on flaky Wi-Fi. The API stores the response
-- of the first request under (scope, key) and replays it for retries.
-- Service-role only, like every other table.

create table if not exists public.idempotency_keys (
  scope        text not null,            -- "<user id or ip>:<METHOD> <route pattern>"
  key          text not null,
  request_hash text not null,
  status       text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  response_status int,
  response_body   jsonb,
  created_at   timestamptz not null default now(),
  primary key (scope, key)
);

create index if not exists idempotency_keys_created_at_idx on public.idempotency_keys (created_at);

alter table public.idempotency_keys enable row level security;
revoke all on public.idempotency_keys from anon, authenticated;

-- Keys only need to live long enough to cover client retries.
create or replace function public.purge_idempotency_keys()
 returns int
 language sql
 set search_path = public, pg_temp
as $function$
  with d as (delete from idempotency_keys where created_at < now() - interval '24 hours' returning 1)
  select count(*)::int from d;
$function$;
revoke execute on function public.purge_idempotency_keys() from public, anon, authenticated;
