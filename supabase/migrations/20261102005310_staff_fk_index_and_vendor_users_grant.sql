-- Covering index for staff.vendor_id (advisor lint 0001).
create index if not exists staff_vendor_id_idx on public.staff (vendor_id);

-- Nothing reads vendor_users from the browser; keep it server-only (lint 0027).
revoke select on public.vendor_users from authenticated;
drop policy if exists "vendor_users: read own links" on public.vendor_users;
