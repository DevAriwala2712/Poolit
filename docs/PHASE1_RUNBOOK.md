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

---

# Student phone login

Students sign in with an Indian mobile number and a 6-digit SMS code
(Supabase Auth phone OTP). Browsing stays open; checkout, "Your orders" and
order tracking need a sign-in. Orders are linked to the student's account
(`orders.student_id`) and the app fetches only `GET /me/orders`, so other
students' names and rooms no longer reach anyone's browser.

Database: done (`20261102010452_students_and_order_ownership` is applied).

## A. Turn on phone sign-in in Supabase

Dashboard → Authentication → Sign In / Providers → **Phone** → enable, then
pick an SMS provider and paste its credentials. For India, the SMS sender ID
and OTP template must be **DLT-registered** (TRAI rules) through that provider
— this takes days, so start early. Supabase's built-in providers include
Twilio, MessageBird, Textlocal and Vonage; an Indian gateway such as MSG91 can
be wired in with Supabase's "Send SMS" auth hook instead.

For testing before SMS is live: in the same Phone settings add **test phone
numbers** with fixed codes (e.g. `919876543210=123456`). No SMS is sent for
those numbers.

## B. Deploy, in this order

1. **Backend** (merge the PR; `STUDENT_LOGIN_REQUIRED` stays `false`). The
   currently deployed student app keeps working: anonymous orders are still
   accepted, and signed-in orders get linked to the student.
2. **Student app** (same merge, its Vercel project). Students now sign in at
   checkout.
3. Set **`STUDENT_LOGIN_REQUIRED=true`** on the backend's Vercel project and
   redeploy. This closes the privacy leak: order lists become vendor-only and
   anonymous orders are refused.

Rollback: set `STUDENT_LOGIN_REQUIRED=false` and redeploy the backend.

## Vendor accounts after this change

Because students now have Supabase accounts too, every vendor route checks
that the signed-in user is a **vendor** — i.e. has a row in `vendor_users` —
even while `ENFORCE_VENDOR_SCOPING` is off. Both existing vendor logins are
linked. When you create a new vendor login, also link it (step 3 above), or
its actions will return "This account isn't a vendor account".
