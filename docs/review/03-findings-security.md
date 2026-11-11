# 3. Security findings

Status: **complete** for steps 3 to 10. Severity scale is in
[00-status-and-scope.md](00-status-and-scope.md#severity). Paths are at `396345d` (pull
request 9, equal to live) unless marked `@main`.

## Summary

| ID | Severity | Finding | Live today? |
| --- | --- | --- | --- |
| [SEC-14](#sec-14) | Critical | A student's order text runs as script in the vendor console when tickets are printed, and can read the store's login session | Yes (console code on `main`) |
| [SEC-15](#sec-15) | High | The seed script deletes six tables of whatever database it is pointed at; the only database is live and no backup exists | Yes |
| [SEC-16](#sec-16) | High | The deployed Express API is documented as still in permissive mode: order lists with names and rooms are public, and any store login can act on every store | Per docs; not verified on Vercel |
| [SEC-01](#sec-01) | High | A student can label an order as paid ("UPI" or any text); the vendor console shows "Paid via …" and no cash is expected | Yes |
| [SEC-02](#sec-02) | Medium | Store staff can change prices through the database function; only owners should | Yes |
| [SEC-03](#sec-03) | Medium | One signed-in account can take a store's whole stock in one order, at no cost, and repeat | Yes |
| [SEC-04](#sec-04) | Medium | A signed-out caller can fill the error table at 300 rows a minute and hide real crashes | Yes |
| [SEC-05](#sec-05) | Medium | A store can set the picture shown on another store's product | Yes |
| [SEC-06](#sec-06) | Low | The 18+ and consent step is enforced only in the app | Yes |
| [SEC-07](#sec-07) | Low | A paused store still takes orders into a pool that is already open | Yes |
| [SEC-08](#sec-08) | Low | Deleting an account leaves the user id in the error table | Yes |
| [SEC-09](#sec-09) | Low | The public roles hold privileges on two sequences | Yes |
| [SEC-10](#sec-10) | Low | Cancelling an order while its pool is being closed can deadlock | Yes |
| [SEC-11](#sec-11) | Low | No limit on how many pictures a store can upload | Yes |
| [SEC-12](#sec-12) | Info | Signed-out callers see exact stock and low-stock thresholds of every store | Yes |
| [SEC-13](#sec-13) | Info | The same functions may be reachable through GraphQL | To confirm |
| [SEC-17](#sec-17) | Medium | Anyone who can create an account is "signed in" for 36 functions; whether sign-up is open is a dashboard setting not yet confirmed | To confirm |
| [SEC-18](#sec-18) | Medium | The two store logins have no second factor; one is also the platform admin; leaked-password check is off | Yes |
| [SEC-19](#sec-19) | Medium | No Content-Security-Policy on either app | Yes |
| [SEC-20](#sec-20) | Medium | The backup job puts the full database password in GitHub; workflows have default token permissions and tag-pinned actions | When secrets are set |
| [SEC-21](#sec-21) | Low | Express: anonymous orders bypass the limit of 3; idempotency result saved after the reply; last-owner check is read-then-write; rate limits are per instance and fail open | Yes |
| [SEC-22](#sec-22) | Low | Android: `allowBackup="true"`; release build not minified; never built or tested | Not shipped |
| [SEC-23](#sec-23) | Low | Privacy documents do not match the system in six places | Drafts |
| [SEC-24](#sec-24) | Low | `cron.job_run_details` is never pruned | Yes |
| [SEC-25](#sec-25) | Low | Development dependencies have 2 high and 2 moderate advisories | Build machines only |
| [SEC-26](#sec-26) | Info | The vendor console loads its icon font from Google | Yes |

## What held up

Checked and found sound. Evidence in [evidence/probes/](evidence/probes/).

- **Who can call what.** 47 calls covering all 45 functions, each made by 8 kinds of caller
  (signed-out, signed-in stranger, two students, staff and owner of store X, owner of store
  Y, platform admin): 375 of 376 outcomes match the intended rule. The one exception is SEC-02. A rival store's owner gets
  403 on every store function; a student gets 404 on another student's order.
- **No table is reachable** by the public roles; no policy exists; live matches.
- **No other person's data in any response** to a signed-out caller, another student, or
  another store (`02_targeted.out`, section P2).
- **Races:** the limit of 3 orders per pool, stock (no overselling), one order per
  idempotency key, and a single delivery all hold under simultaneous calls (`04_races.out`).
- **Idempotency keys** are scoped per user and function; a second user with the same key gets
  their own order; the same key with a different body is refused.
- **Upload rule:** own store folder only, name pattern enforced, no overwrite, delete or list.
- **Function hygiene:** every exposed function pins `search_path`, none builds SQL from
  input, no old overload was left behind, and helper schemas are closed.
- **Live equals repo** in logic ([evidence/drift-check.md](evidence/drift-check.md)).

---

## Database functions and business rules (steps 3, 4, 7)

### SEC-01

**A student can mark their own order as paid.** High.

- `api_place_order` stores `p_payment_method` as given, trimmed to 30 characters
  (`supabase/migrations/20261106035650_idempotency.sql:154`). There is no list of allowed values.
- Only text equal to `cod` or starting with `cash` counts as cash on delivery
  (`20261106064424_cod_and_fees.sql:67-72`). Anything else is treated as not cash.
- For a non-cash order, `api_mark_delivered` refuses to record cash (`:134-137`), records
  nothing, and the order is left out of the store's cash summary (`:196`).
- The vendor console prints "Paid via {paymentMethod}" for every non-cash order
  (`frontend/apps/vendor/src/screens/Orders.tsx:509-510`). On `main` it prints that for every
  order (`Orders.tsx:487-488 @main`).
- No online payment exists. The student app offers cash only
  (`frontend/apps/student/src/screens/Checkout.tsx:14-17`), but the
  function is called directly with the public key and the student's own session.
- The Express route has the same gap: `paymentMethod` is any text up to 30 characters
  (`backend/schemas/index.js:16 @main`), and until `STUDENT_LOGIN_REQUIRED` is on it needs no
  sign-in at all.

Reproduced (`02_targeted.out`, P5 and P15): orders with `UPI` and with
`already paid, trust me` are accepted; delivering the UPI order records no cash and the
day's expected cash is 0.

Impact: goods handed over with nothing collected, and no record that money is owed.
Fix: accept only known values in the function (today: cash on delivery), store a code, not
free text, and show "to collect" for every order until a payment is actually confirmed by a
gateway. Add a check constraint on `orders.payment_method`.

### SEC-02

**Staff can change prices.** Medium.

- `api_update_menu_item` checks only that the caller is linked to the store
  (`20261104122329_api_functions.sql:769`), then accepts `price` (`:773-778`).
- Express refuses the same change for staff: "Only a store owner can change prices"
  (`backend/controllers/menuItemController.js:110-114 @main`). `docs/PHASE1_CLOSEOUT.md:38`
  and `docs/PRODUCTION_PLAN.md` list owner-only prices as a shipped rule.
- The access-control suite does not test it.

Reproduced: `01_access_matrix.out`, row `api_update_menu_item(price)`, column `staffX` is
`ALLOWED`. This is the only deviation in the matrix.

Impact: a staff login can set any price (for example ₹1), order, and set it back; the price
is frozen on the order. The audit log would show it afterwards.
Fix: require the owner role when the patch contains `price`; add the case to
`10_api_security.test.sql`. Decide the same question for `api_create_menu_item`, where staff
set the price of a new item on both paths.

### SEC-03

**One account can empty a store's stock for free.** Medium.

- One order may hold 50 lines of up to 100 units each, and the same item may repeat on every
  line (`20261102074303_order_price_snapshot.sql:66,89`). There is no cap on units or value.
- A student may hold 3 such orders per pool. Cancelled orders do not count toward the 3
  (`20261106035650_idempotency.sql:144-148`), and cancelling is free and unlimited while the
  pool is open (`20261110135021_cancel_order.sql:21-53`).
- Payment is cash at the door, so nothing is at stake for the caller.

Reproduced (P5): with stock 5,000, one order took all 5,000 units (₹1,00,000), leaving 0 for
everyone else; the same account cancelled and the stock returned; its active order count was
0 again.

Impact: any phone-verified account can show a store as sold out for a whole pool, every
pool, or leave a huge fake order to be packed. Tied to SEC-06 and to the sign-up settings in
the owner checklist: the cost of an account is one OTP.
Fix: cap units per line item across the order and total order value; count cancelled orders
toward a per-pool attempt limit; consider a per-day cancel limit and a flag on accounts that
do not collect.

### SEC-04

**Signed-out flood of the error table.** Medium.

- `api_report_error` is executable by `anon` (`20261110135209_client_errors.sql:91`) and
  inserts a row for each new fingerprint, up to 300 new rows a minute across the whole
  system (`:47`). Rows live 30 days.
- The limit is global, not per caller, so one caller can use all of it.

Reproduced (P4): 400 signed-out calls stored 300 rows averaging 2,609 bytes. A genuine new
crash reported right after was dropped.

Impact: about 0.8 MB a minute, over 1 GB a day. The free plan's database limit is 500 MB, so
the limit is reached in roughly half a day of sustained calls (what Supabase does at the
limit: confirm in the owner checklist). Independently, while the brake is saturated every
real new error is discarded, so error tracking can be switched off by an outsider.
Fix: cap total rows (drop oldest), cap stored size per row, keep the brake per caller where
one is known, and accept signed-out reports only in a much smaller budget. Add an index on
`first_at` (the brake's count scans the table).

### SEC-05

**A store can choose the picture on another store's product.** Medium.

- An item with no picture of its own shows the newest picture of any item, in any store,
  with the same barcode (`20261105065756_product_images.sql:42-45`).
- Any store user can set any barcode on their own item
  (`20261104122329_api_functions.sql:784-793`) and attach a picture to it.

Reproduced (`03_storage_and_images.out`): store Y set store X's barcode on one of its items
and attached a picture; store X's item, read signed-out, now returns a path inside store Y's
folder. Store X cannot remove it: clearing its own picture leaves the borrowed one in place.

Impact: a wrong or offensive picture on a competitor's listing, visible to every student.
Uploaded files are never checked beyond type and size.
Fix: share pictures only from a reviewed catalogue, or only when the source store opts in,
or let a store switch borrowing off for an item; at minimum prefer pictures from the same
store and let the affected store override with "no picture".

### SEC-06

**Consent and the 18+ confirmation are enforced only in the app.** Low.

- The student app gates on a flag in browser storage
  (`frontend/apps/student/src/App.tsx:74-80`, `lib/policy.ts`).
- `api_place_order` does not look at `student_consents`.

Reproduced (P5): orders placed by accounts with no consent row.
Impact: the stored proof of consent does not cover every account that ordered.
Fix: refuse `api_place_order` when the caller has no row for the current policy version.

### SEC-07

**A paused store still takes orders.** Low. `place_order` never reads
`vendors.accepting_orders`; pausing only stops the next pool from opening
(`20261102023408_automatic_pool_rotation.sql:49,63`). Reproduced (P6): status `placed`.
Fix: refuse in `place_order` when the store is paused, or close the open pool on pause.

### SEC-08

**Account deletion leaves the user id in `client_errors`.** Low.
`api_delete_my_account` clears orders, profile, consents, idempotency keys and audit rows
(`20261110135127_audit_log.sql:244-255`) but not `client_errors.user_id`
(`20261110135209_client_errors.sql:16`). Reproduced (P16): 1 row left. It ages out in 30 days.
Fix: null it in the same function.

### SEC-09

**Public roles hold privileges on two sequences.** Low. On live, `anon` and `authenticated`
have `SELECT, UPDATE` on `public.audit_log_id_seq` and `UPDATE` on
`public.internal_barcode_seq`. The hardening migration reset default privileges for tables
and functions only (`20261102005026_harden_functions_and_grants.sql:200-201`); the default
for sequences is still open (live `pg_default_acl`: `anon=rwU`). Not reachable through REST
today, since no exposed function passes a sequence name through.
Fix: revoke on both sequences and on the default for sequences.

### SEC-10

**Cancel versus close can deadlock.** Low. `api_cancel_order` locks the order, then (pool
expired) the pool (`20261110135021_cancel_order.sql:32,41`); `close_slot` locks the pool,
then its orders. Reproduced (`04_races.out`, 5): "deadlock detected". Both sides fail safely
and the next minute's sweep closes the pool; the student sees an error.
Fix: in `api_cancel_order`, lock the pool first.

### SEC-11

**No limit on pictures per store.** Low. The upload rule checks folder and name only
(`20261105065756_product_images.sql:65-87`). Each file is capped at 200 KB, the count is not;
files cannot be deleted through the API, and orphans are never cleaned.
Fix: a per-store count or size budget in the policy helper; a periodic orphan sweep.

### SEC-12

**Signed-out callers see exact stock.** Info. `api_vendors`, `api_vendor`, `api_vendor_menu`
and `api_student_view` return `stockQty`, `lowStockThreshold` and `barcode` for every item
(P2b). A rival store or anyone else can track sales by polling. Decide whether students need
more than "in stock / few left / out".

### SEC-13

**GraphQL as a second door.** Info. `pg_graphql` is installed and `anon` has usage on
`graphql_public`. If the endpoint is on, the functions granted to `anon` and `authenticated`
are callable there too, outside any REST-only assumption (logging, limits). Nothing more is
exposed than through REST. Owner checklist: switch it off if unused.

---

## Vendor console and Express (steps 6, 8)

### SEC-14

**Student text runs as script in the vendor console.** Critical.

- "Batch KOT" builds the print page as a string and inserts `o.studentName`, `o.block`,
  `o.room` and `o.note` without escaping, then writes it with `document.write` into a window
  opened by the console (`frontend/apps/vendor/src/screens/Orders.tsx:87-98`; same code on
  `main` at `:90-101`). The label printer next to it does escape
  (`components/BarcodeLabels.tsx:8`).
- A window opened that way has the console's origin, so script in it can reach
  `opener.localStorage`, where the Supabase client keeps the access and refresh tokens.
- All four fields are typed by the student: 60, 40, 20 and 140 characters on the database
  path; on Express the note may be 500 (`backend/schemas/index.js:17 @main`).
- Neither app sends a Content-Security-Policy (SEC-19), so nothing blocks inline handlers.

Reproduced in Chromium against the real console
([evidence/probes/05_print_window_xss.spec.ts](evidence/probes/05_print_window_xss.spec.ts)):
a 101-character note changed the console tab's title to the list of storage keys and the
session entry was readable. Output in `05_print_window_xss.out`.

Who can plant it: any signed-in student through `api_place_order`; on the Express path,
anyone at all while `STUDENT_LOGIN_REQUIRED` is off (SEC-16). It fires when store staff use
Batch KOT (advanced mode, a button and Ctrl/⌘+P) while that order is in the open pool.
Impact: takeover of the store login: prices, stock, every order's name and room, cash
records; with store scoping off on Express, every store.
Fix: escape the four fields (reuse `esc` from `BarcodeLabels.tsx`, adding `'`), or build the
print view with React in a hidden frame. Add a Content-Security-Policy. Add a test with a
`<svg onload>` name.

### SEC-15

**The seed script wipes the database it is pointed at.** High.

- `backend/seed.js:113-118 @main` deletes every row of `restock_logs`, `orders`,
  `menu_items`, `slots`, `vendors` and `hostels` using the service-role key. No confirmation,
  no environment check, not in a transaction.
- `README.md:25-34 @main` tells a new developer to put the project's URL and service-role key
  in `backend/.env` and run `npm run seed`, described as "safe to re-run". `npm run dev:seed`
  and `dev:fresh` run it too (`backend/package.json:10-11`).
- There is one Supabase project. No staging exists, the free plan has no point-in-time
  restore, and the backup workflow has never run.

Impact: one habitual command removes all stores, menus and orders with no way back.
Fix: refuse to run unless the URL is local or an explicit `--i-know-this-deletes` flag names
the project; correct the README; create the staging project; get one backup taken and one
restore tested before any real order exists.

### SEC-16

**Express is documented as still in permissive mode.** High, unverified.

Per `docs/PRODUCTION_PLAN.md:49 @396345d` the Vercel settings are still waiting on the
owner. With `STUDENT_LOGIN_REQUIRED` and `ENFORCE_VENDOR_SCOPING` unset
(`backend/utils/flags.js`):

- `GET /vendors/:id/orders`, `GET /slots/:id/orders`, `GET /slots/:id/pick-list` need no
  sign-in and return student names, blocks and rooms (`backend/routes/vendors.js:22`,
  `slots.js:22-23`).
- `POST /slots/:id/orders` needs no sign-in; only a per-instance limit of 30 a minute per IP.
- Any account linked to any store may restock, reprice, close, dispatch and deliver for
  every store, and `GET /vendor/overview` returns every store
  (`backend/middleware/requireVendorAccess.js:25-34`,
  `controllers/vendorConsoleController.js:20-24`).
- CORS allows every origin when `ALLOWED_ORIGINS` is unset (`backend/app.js:30-48`).

Live currently holds only seed orders (53, none linked to an account), so nothing real is
exposed yet. This becomes a breach on the first real order.
Fix: set the three variables now (the logins are already linked), or take the Express
deployment down once both apps run on the database functions. Owner checklist items V1–V4.

### SEC-21

**Smaller Express issues.** Low.

- Orders placed without sign-in have no `student_id`, so the limit of 3 per pool does not
  apply to them; SEC-03 needs no account on this path.
- The idempotency middleware saves the first response after replying and does not wait
  (`backend/middleware/idempotency.js:68-76`); on a serverless function the save can be lost,
  leaving the key "in progress" and answering retries with 409 for 24 hours.
- The last-owner rule reads the owner count, then writes
  (`backend/controllers/memberController.js:96-101,118-123`); two simultaneous demotions can
  leave a store with no owner.
- Rate limits are per warm instance unless Upstash is configured, and allow the request when
  the store fails (`backend/middleware/rateLimit.js`).
- `GET /inventory` and `GET /menu-items/:id/restock-log` are public (stock and restock history).
- `GET /` lists every route.

## Authentication and sessions (step 5)

### SEC-17

**"Signed in" is the only bar for 36 functions.** Medium, to confirm.

Student functions check only that a session exists. The student app creates accounts on
first OTP (`signInWithOtp`, `frontend/apps/student/src/state/AuthContext.tsx:119`). If email
sign-up or anonymous sign-in is also enabled in the project (both are Supabase defaults that
the repo cannot show), anyone can mint accounts with the public key and no phone, which
removes the one cost behind SEC-01, SEC-03 and the per-pool limit. Live has only the two
store logins today, so no evidence either way. The Auth settings endpoint was not reachable
from this review. Owner checklist A1–A6. Also to decide: CAPTCHA and per-number OTP limits,
since each SMS costs money and nothing in the repo limits requests.

### SEC-18

**Store and admin logins are password-only.** Medium. Live: 0 MFA factors; the security
advisor reports leaked-password protection off and too few MFA options. One of the two
logins is owner of all five stores and the platform admin (fee terms, audit log, error
reports). Combined with SEC-14, one stolen session is the whole system.
Fix: enable TOTP and require it for `platform_admins` (check the `aal` claim in
`private.is_platform_admin`); turn on the leaked-password check; use a separate admin login.

Reviewed and sound: `backend/utils/verifyToken.js` verifies signature, issuer and audience,
pins the algorithm list, sends legacy and unverifiable tokens to the Auth server, and never
falls back after a failed verification. Known and documented: a locally verified token
stays valid for up to an hour after sign-out. The same window applies on the database path
after `api_delete_my_account`; calls then fail on foreign keys, not on an access check.

## Frontends and Android (step 8)

### SEC-19

**No Content-Security-Policy.** Medium. Both `vercel.json` files set `nosniff`,
`Referrer-Policy` and `X-Frame-Options` only. A policy without `unsafe-inline` for scripts
would have stopped SEC-14's handler. No `Strict-Transport-Security` either (Vercel adds it
on its own domains; confirm on a custom domain). Planned for week 5; should move before the
pilot. The service worker caches the app shell and hashed assets only, same-origin `GET`
only: sound.

### SEC-22

**Android wrapper.** Low, not shipped. `android:allowBackup="true"`
(`frontend/apps/student/android/app/src/main/AndroidManifest.xml:5`) lets the WebView's
storage, including the session, into device backups. `minifyEnabled false`. No signing
setup. `docs/ANDROID_APP.md` states it has never been built. Sound: https scheme, no mixed
content, only the `INTERNET` permission, one exported launcher activity, provider not
exported. The checked-in `gradle-wrapper.jar` (sha256 `7d3a4ac4…6172`) should be verified
against Gradle 8.14.3's published checksum before the first build.

### SEC-26

**Google Fonts in the vendor console.** Info. `frontend/apps/vendor/index.html:15-18` loads
Material Symbols from `fonts.googleapis.com`; staff IP addresses go to Google and the
processor list in the privacy draft does not name it. Self-host it as was done for the text
fonts.

Sound: every other render path goes through React escaping; no `innerHTML` or `eval`;
admin-only screens are gated in the database, not only by `useIsAdmin`; the client sends
`location.pathname` to the error reporter (the function itself would keep a URL fragment if
one were sent).

## Privacy and data lifecycle (step 9)

### SEC-23

**The privacy drafts and the system differ.** Low (drafts, pre-launch).

| Document says | System does |
| --- | --- |
| `DATA_REGISTER.md` lists the tables holding personal data | Missing: `client_errors` (user id, user agent, stack), `staff` (name, email), `stock_adjustments.user_id`, Express request logs (IP, user id) |
| Product photos are "seen by everyone signed in" | The bucket is public; no sign-in needed |
| "Other students never see your name… or order" | True on the database path; false on Express while SEC-16 stands |
| "Store accounts see only their own store's orders" | False on Express while store scoping is off |
| Logs kept "at least 180 days" | Only `audit_log` (data changes) is kept 180 days. Access logs live in Supabase and Vercel on free-plan retention, which is far shorter (confirm; owner checklist) |
| Backups "kept for [30] days" | `scripts/backup/backup.sh` uploads and never deletes; expiry must be a bucket rule |

Also: SEC-06 (consent only in the app), SEC-08 (user id left in `client_errors`). Tests are
cited as `supabase/tests/70_privacy.sql`; the file is `70_privacy.test.sql`.

Sound: export returns only the caller's data; deletion clears orders, profile, consents,
idempotency keys and audit rows, and is refused for store and admin accounts and while an
order is in progress; audit masking covers student name, phone, block, room, note and id.

### SEC-24

**`cron.job_run_details` grows without limit.** Low. 12,798 rows on live on 11 Nov, about
1,440 a day from the every-minute sweep. On a 500 MB plan this matters within months.
Fix: a daily job deleting rows older than a week.

## Supply chain, CI and secrets (step 10)

### SEC-20

**CI and backup workflow hardening.** Medium once secrets exist.

- `backup.yml` needs `BACKUP_DB_URL`, the database owner's connection string, as a GitHub
  secret. Anyone who can change a workflow on a branch that can read secrets, or any
  compromised action, gets the whole database. Use a dedicated read-only role for dumps.
- No workflow declares `permissions:`, so the token has the repository default.
- Actions are pinned by tag (`actions/checkout@v4`, `setup-node@v4`), not by commit.
- `main` has no branch protection (branch list shows `protected: false`), and CI on `main`
  does not run at all (ARCH-02), so nothing gates a merge.

Sound: no secret in any commit on any of the six branches (pattern scan of full history for
JWTs, service keys, private keys, cloud keys, connection strings, passwords); only
`.env.example` files were ever committed; the backup is encrypted to a public key so the job
cannot read what it wrote; the keep-alive job uses only the public key.

### SEC-25

**Development dependency advisories.** Low. `npm audit` on 11 Nov: runtime dependencies
clean in both lockfiles at both commits. Including development dependencies: backend 2
moderate (`minimatch`); frontend 2 high (`vite` 8.2.0–8.2.2 via `launch-editor`,
`source-map-js`). They affect build machines and the dev server, not what ships.
`npm audit fix` resolves all four. `docs/PHASE1_CLOSEOUT.md` still says 0.

## Check on the existing test suite

Eight access rules were removed one at a time from a copy of the migrations and
`scripts/test-db.sh` was run after each: cancel another student's order, cash summary
without a store check, fee statement without an owner check, picture on another store's
item, audit log open to any signed-in user, staff edit by a non-owner, export returning
everyone's orders, delivery without a store check. **All eight were caught.** The suite can
be trusted for what it covers. What it does not cover is listed per finding (SEC-02 above
all), and it has not run in CI since 5 Nov (ARCH-02).
