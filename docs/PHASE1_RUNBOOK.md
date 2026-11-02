# Phase 1 runbook — turning on the new safeguards

Status on 2 Nov 2026: **steps 0–3 are done** (database restored, history in
the repo, migrations applied, logins linked). **Only step 4 remains**, and it
needs someone with access to the backend's Vercel project.

## 0. Wake the database ✅ done

The Supabase project `icnkzzjnuoyfupaydian` was **paused (INACTIVE)** on
2 Nov 2026 — while paused, the deployed API and both apps cannot load data.
Restore it from the Supabase dashboard (Project → Restore). Free-tier projects
pause after a period of inactivity; Supabase Pro avoids this.

## 1. Capture the baseline schema ✅ done (exact migration history recovered into `supabase/migrations/`)

See [supabase/README.md](../supabase/README.md). Commit the generated
`supabase/migrations/20261101000000_baseline.sql`. Check in it that
`vendors.id` is `uuid`; if not, adjust `vendor_users.vendor_id` in
`20261102000100_vendor_users.sql` before step 2.

## 2. Apply the Phase 1 migrations ✅ done

```bash
npx supabase link --project-ref icnkzzjnuoyfupaydian
npx supabase db push
```

This creates `vendor_users` and the query indexes. Nothing changes for users
yet — enforcement is still off.

## 3. Link vendor logins to their stores ✅ done — `ariwala.dev19@gmail.com` is owner of all 5 stores, `devtest@poolit.local` is staff of all 5

For each vendor account (Supabase → Authentication → Users for the user id,
Table editor → `vendors` for the store id), in the SQL editor:

```sql
insert into public.vendor_users (user_id, vendor_id, role)
values ('<auth user uuid>', '<vendor uuid>', 'owner')
on conflict do nothing;
```

`owner` can change store settings and staff; `staff` can run orders and
inventory only. A login with no row will get "You don't have access to this
store" once step 4 is done.

## 4. Turn enforcement on

In the backend's Vercel project → Settings → Environment Variables, set
`ENFORCE_VENDOR_SCOPING=true` and redeploy. Check: sign in as a vendor and
restock an item in your store (works) and in another store (403 toast).

Rollback: set the variable back to `false` and redeploy.

## What's enforced

| Route | Who may call it |
| --- | --- |
| `PATCH /vendors/:id`, `POST/GET /vendors/:id/staff`, `PATCH/DELETE /staff/:id` | Owner of that store (GET staff: any linked user) |
| `POST /vendors/:id/menu-items`, `PATCH /menu-items/:id`, `POST /menu-items/:id/restock` | Owner or staff of the item's store |
| `POST /slots/:id/close`, `POST /slots/:id/dispatch`, `POST /orders/:id/deliver` | Owner or staff of the slot's store |
| `POST /slots/:id/orders` (public) | Anyone, max 30 per minute per IP |
