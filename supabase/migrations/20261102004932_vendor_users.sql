-- Per-store vendor access control (Phase 1).
-- Links Supabase Auth users to the store(s) they may operate. Enforced by
-- backend/middleware/requireVendorAccess.js when ENFORCE_VENDOR_SCOPING=true.

create table if not exists public.vendor_users (
  user_id    uuid not null references auth.users (id) on delete cascade,
  vendor_id  uuid not null references public.vendors (id) on delete cascade,
  role       text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (user_id, vendor_id)
);

create index if not exists vendor_users_vendor_id_idx on public.vendor_users (vendor_id);

alter table public.vendor_users enable row level security;

drop policy if exists "vendor_users: read own links" on public.vendor_users;
create policy "vendor_users: read own links"
  on public.vendor_users for select
  to authenticated
  using (user_id = (select auth.uid()));
