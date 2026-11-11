# 3. Security findings

Status: **in progress**. Sections are added as each step finishes. Severity scale is in
[00-status-and-scope.md](00-status-and-scope.md#severity). Paths are at `396345d` (pull
request 9, equal to live) unless marked `@main`.

## Summary so far

| ID | Severity | Finding | Live today? |
| --- | --- | --- | --- |
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

Next sections: authentication and sessions (step 5), the Express API (6), frontends and
Android (8), privacy (9), supply chain and CI (10).
