# 1. Inventory

Everything that can be reached, called, stored or deployed. Later steps check each row; the
coverage matrix (`07-coverage-matrix.md`) records the verdict per row. Built from code and
catalogs, not from the docs. Generated listings: [evidence/functions.md](evidence/functions.md),
[evidence/schema.md](evidence/schema.md), [evidence/drift-check.md](evidence/drift-check.md).

## Branch state

| Fact | Detail |
| --- | --- |
| Merge base of `main` and pull request 9 | `c7b89ed` (5 Nov) |
| On `main`, not in pull request 9 | 15 commits: the Phase 1 final batch (zod validation, idempotency middleware, local token verification, rate limiter with Redis, team members, Sentry) |
| In pull request 9, not on `main` | 18 commits (see [00-status-and-scope.md](00-status-and-scope.md)) |
| Trial merge | **5 conflicts**: `frontend/apps/student/src/main.tsx`, `frontend/apps/vendor/src/main.tsx`, `frontend/package-lock.json`, `frontend/packages/domain/src/format.ts`, `frontend/packages/domain/src/rpcApi.ts` |
| `ci.yml` after merge | Merges without conflict, so it keeps `main`'s duplicate `database` job and stays broken |
| Consequence | The code that will ship is neither tip. The backend seen by pull request 9's own tests is the older one, without `main`'s validation and token checks |

## Doors into the system

| # | Door | Who can use it | Where defined |
| --- | --- | --- | --- |
| D1 | Supabase REST `POST /rest/v1/rpc/<fn>` | Anyone with the public key (shipped in both apps) | grants in migrations |
| D2 | Supabase GraphQL `/graphql/v1` (`pg_graphql` 1.5.11 installed; `anon` has usage on `graphql_public`) | Same callers as D1; exposes the same executable functions a second way | live catalog. Whether the endpoint is switched on: owner checklist |
| D3 | Supabase Auth `/auth/v1/*` (sign-up, OTP, password, recovery, invite) | Anyone | dashboard settings; owner checklist |
| D4 | Supabase Storage `/storage/v1/object/*`, bucket `product-images` | Read: anyone. Insert: signed-in, by policy | `20261105065756_product_images.sql` |
| D5 | Supabase Realtime | Publication `supabase_realtime` has **no tables**; nothing is broadcast | live catalog |
| D6 | Express API on Vercel, 38 routes | Anyone; per-route checks | `backend/routes/*.js@891e435` |
| D7 | `POST /internal/sweep-slots` | Holder of `CRON_SECRET` | `backend/routes/internal.js` |
| D8 | `pg_cron`, 4 jobs as `postgres` | Database only | migrations, live `cron.job` |
| D9 | Supabase dashboard, SQL editor, service-role key, database password | Project owner; anyone holding the key | not in repo |
| D10 | GitHub Actions (3 workflows) with repository secrets | Anyone who can push a branch or edit a workflow | `.github/workflows/` |
| D11 | Android app WebView (`app.poolit.student`) | Device user; other apps via exported activity | `frontend/apps/student/android/` @ `396345d` |
| D12 | Vendor PWA service worker | Device user | `frontend/apps/vendor/public/sw.js` |

## Database functions (D1, D2)

87 functions: 59 in `public`, 27 in `private`, 1 in `app_policy`. Full table with mode,
volatility and grants: [evidence/functions.md](evidence/functions.md).

**Callable signed-out (9):**

| Function | Writes? |
| --- | --- |
| `api_hostels`, `api_vendors`, `api_vendor`, `api_vendor_menu` | No |
| `api_current_slot`, `api_student_view` | Yes: may open or rotate a pool |
| `api_slot`, `api_live_fee` | Yes: may close an expired pool and lock fees |
| `api_report_error` | Yes: inserts or updates `client_errors` |

**Callable signed-in only (36):** by group, each to be reviewed line by line in step 3.

| Group | Functions |
| --- | --- |
| Student | `api_me`, `api_update_me`, `api_my_orders`, `api_place_order`, `api_cancel_order`, `api_record_consent`, `api_export_my_data`, `api_delete_my_account` |
| Store, any linked user | `api_vendor_overview`, `api_vendor_orders`, `api_slot_orders`, `api_pick_list`, `api_close_slot`, `api_dispatch_slot`, `api_mark_delivered`, `api_cash_summary`, `api_create_menu_item`, `api_update_menu_item`, `api_set_item_image`, `api_restock_item`, `api_restock_log`, `api_inventory`, `api_generate_barcode`, `api_generate_missing_barcodes`, `api_adjust_stock`, `api_stock_history`, `api_staff` |
| Store, owner only | `api_update_vendor`, `api_create_staff`, `api_update_staff`, `api_delete_staff`, `api_fee_statement` (owner or admin) |
| Platform admin | `api_set_fee_terms`, `api_audit_log`, `api_client_errors`, `api_is_admin` (anyone may ask) |

**Not callable from outside (41):** the `private` helpers; the older write functions
(`place_order`, `close_slot`, `dispatch_slot`, `restock_item`, `adjust_stock`,
`ensure_open_slot`, `generate_item_barcode`, `sweep_expired_slots`, `vendor_daily_revenue`,
`fee_for_order_count`, `ean13_check_digit`); the three `purge_*` jobs.

`app_policy.can_upload_product_image` is executable by signed-in users (needed by the storage
policy). Whether the `app_policy` schema is exposed through REST: owner checklist.

All 45 `api_*` functions are `SECURITY DEFINER`, owned by `postgres`, with
`search_path = public, pg_temp`. One exposed function is not called by either app:
`api_vendor_menu`.

## Tables and personal data

17 tables in `public`. Columns, keys, constraints and indexes: [evidence/schema.md](evidence/schema.md).

| Table | Personal data | Notes |
| --- | --- | --- |
| `students` | name, phone, hostel, block, room | Deleted with the auth user (cascade) |
| `orders` | student name, block, room, note, `student_id`; cash collected and by whom | `student_id` set null when the user is deleted; the name and room columns stay |
| `student_consents` | user id, policy version, time | Cascade |
| `staff` | name, email | Roster, not logins |
| `vendor_users` | user id ↔ store, role | Logins |
| `platform_admins` | user id | |
| `audit_log` | actor id and role, old and new row values (masked columns per table) | 180-day purge job |
| `client_errors` | message, stack, page URL, user agent, user id | Purge job |
| `idempotency_keys` | scope (user id or IP), stored response body (an order, so name and room) | 24-hour purge job |
| `stock_adjustments`, `vendor_fee_terms` | acting user id | |
| `hostels`, `vendors`, `menu_items`, `slots`, `restock_logs`, `order_fee_ledger` | none | |
| `auth.users` (Supabase) | phone, email, password hash | Read by `api_me`, `api_update_me` |

Grants: `anon` and `authenticated` hold no privilege on any table. Sequences are the
exception: on live both roles hold privileges on `public.audit_log_id_seq` and
`public.internal_barcode_seq` (the default privileges for sequences were never revoked).
Checked in step 3.

Triggers: 27 audit triggers on 14 tables calling `private.audit_row` (the only
`SECURITY DEFINER` function in `private`). Not audited: `audit_log`, `client_errors`,
`idempotency_keys`.

## Scheduled jobs (D8)

| Job | Schedule (UTC) | Runs |
| --- | --- | --- |
| `poolit-sweep-slots` | every minute | `sweep_expired_slots()` |
| `poolit-purge-idempotency-keys` | 03:00 daily | `purge_idempotency_keys()` |
| `poolit-purge-audit-log` | 03:30 daily | `purge_audit_log()` |
| `poolit-purge-client-errors` | 03:40 daily | `purge_client_errors()` |

## Role limits on live

| Role | Setting |
| --- | --- |
| `anon` | `statement_timeout = 3s` |
| `authenticated` | `statement_timeout = 8s` |
| `authenticator` | `statement_timeout = 8s`, `lock_timeout = 8s` |

Extensions: `pg_cron` 1.6.4, `pg_graphql` 1.5.11, `pgcrypto` 1.3, `pg_stat_statements`,
`supabase_vault`, `uuid-ossp`. Edge Functions: none.

## Express routes (D6), `backend/routes/*.js @ 891e435`

38 routes plus the health check. "Public" means no sign-in check at all.

| Route | Checks today (both rollout flags off) |
| --- | --- |
| `GET /`, `GET /hostels`, `GET /hostels/:id/current-slot`, `GET /vendors`, `GET /vendors/:id`, `GET /vendors/:id/menu`, `GET /slots/:id`, `GET /slots/:id/live-fee`, `GET /inventory`, `GET /menu-items/:id/restock-log` | Public |
| `GET /vendors/:id/orders`, `GET /slots/:id/orders`, `GET /slots/:id/pick-list` | **Public until `STUDENT_LOGIN_REQUIRED=true`**; return student names, blocks and rooms |
| `POST /slots/:id/orders` | Public, 30 per minute per IP, validated, idempotent; sign-in optional until the flag |
| `GET /me`, `PUT /me`, `GET /me/orders` | Signed-in |
| `GET /vendor/overview`, `GET /vendor/revenue` | Signed-in; scoped to the caller's stores in the controller |
| `POST /slots/:id/close`, `/dispatch`, `POST /orders/:id/deliver`, `PATCH /menu-items/:id`, `POST /menu-items/:id/restock`, `/barcode`, `/adjust`, `GET /menu-items/:id/stock-history`, `POST /vendors/:id/menu-items`, `/barcodes`, `GET /vendors/:id/staff` | Signed-in and "is a vendor of some store"; **store-scoped only when `ENFORCE_VENDOR_SCOPING=true`** |
| `PATCH /vendors/:id`, `POST /vendors/:id/staff`, `PATCH /staff/:id`, `DELETE /staff/:id` | Same, plus owner role when scoping is on |
| `GET/POST /vendors/:id/members`, `PATCH/DELETE /vendors/:id/members/:userId` | Signed-in, owner of that store, always scoped |
| `POST /internal/sweep-slots` | Shared secret, constant-time compare |

Routes with no database-function equivalent: the four `members` routes (they need the Auth
admin API) and `GET /vendor/revenue` (`vendor_daily_revenue` is service-role only).

The Express app holds the **service-role key** (`backend/config/supabaseClient.js`), which
bypasses every database check.

## Client call sites

| App | Calls |
| --- | --- |
| Both, data | `frontend/packages/domain/src/api.ts` (Express, `fetch`) or `rpcApi.ts` (44 `api_*` functions), chosen by `VITE_BACKEND` at build time |
| Student, auth | `signInWithOtp` (SMS), `verifyOtp`, `signOut` — `frontend/apps/student/src/state/AuthContext.tsx` |
| Vendor, auth | `signInWithPassword`, `signOut` — `frontend/apps/vendor/src/state/AuthContext.tsx` |
| Vendor, storage | Upload to `product-images` — `frontend/apps/vendor/src/hooks/usePhotoUpload.ts`, `lib/productPhoto.ts` |
| Browser storage | Student: cart, profile, policy-accepted flag, auth session. Vendor: selected store, UI mode, auth session |
| HTML written by hand | Two print windows using `document.write`: `frontend/apps/vendor/src/components/BarcodeLabels.tsx:24`, `frontend/apps/vendor/src/screens/Orders.tsx:98` |

Both apps embed the project URL and the publishable key as fallbacks
(`frontend/apps/*/src/lib/supabaseClient.ts`, `frontend/packages/domain/src/images.ts`).

## Configuration and secrets (names only)

| Where | Names |
| --- | --- |
| Backend (Vercel) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ENFORCE_VENDOR_SCOPING`, `STUDENT_LOGIN_REQUIRED`, `ALLOWED_ORIGINS`, `CRON_SECRET`, `LOCAL_JWT_VERIFY`, `SENTRY_DSN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SLOT_DURATION_MINUTES`, `POOL_SWEEP_INTERVAL_MS`, `NODE_ENV`, `PORT` |
| Frontends (build time, public) | `VITE_API_URL`, `VITE_BACKEND`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_IMAGE_BASE_URL`, `VITE_SENTRY_DSN` |
| GitHub secrets | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (keep-alive); `BACKUP_DB_URL`, `BACKUP_AGE_RECIPIENT`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (backup) |

## Workflows (D10)

| File | Trigger | Notes |
| --- | --- | --- |
| `ci.yml` | pull request, push to `main`, manual | Broken on `main` (duplicate job key). No `permissions:` block. Actions pinned by tag (`@v4`), not by commit |
| `keep-alive.yml` | every 3 days, manual | Calls `api_hostels` with the public key. Last two runs succeeded |
| `backup.yml` (pull request 9 only) | nightly, manual | `pg_dump` with the database URL, encrypts with a public key, uploads to R2. Never run |

## Third parties

Supabase (database, auth, storage), Vercel (hosting; plan to move to Cloudflare Pages),
GitHub (code, CI, backups job), Cloudflare R2 (backups, planned), Sentry (optional, off),
Upstash Redis (optional, off), an SMS provider for OTP (not chosen), Google Play (planned),
Google Fonts (to be checked in step 8).

## Deployment configuration

| File | Sets |
| --- | --- |
| `backend/vercel.json` | All paths to the Express function; region `sin1` |
| `frontend/apps/student/vercel.json` | SPA rewrite; `nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`. No Content-Security-Policy, no HSTS |
| `frontend/apps/vendor/vercel.json` | Same, plus `Permissions-Policy: camera=(self)` |
| `frontend/apps/student/capacitor.config.ts` @ `396345d` | `androidScheme: https`, no mixed content |
| `frontend/apps/student/android/app/src/main/AndroidManifest.xml` @ `396345d` | `allowBackup="true"`, one exported activity, `INTERNET` permission only |

## Differences between the docs and this inventory

- `docs/ARCHITECTURE.md`, `README.md` and `supabase/README.md` describe an Express-only
  system where "both apps use Supabase only for login". On live, 45 functions are callable
  directly and pull request 9 makes that the main path.
- `supabase/README.md` lists 10 migrations; `main` has 17 and live has 24.
- `docs/architecture/eraser/05-security-layers.eraser` says "only 8 functions are open to
  visitors"; there are 9.
- `docs/PHASE1_CLOSEOUT.md` says 13 migrations.
