# 4. Architecture findings

Paths are at `396345d` unless marked `@main`. Severity here means risk to delivery and
operations: **High** blocks a safe launch, **Medium** will hurt within the pilot, **Low** is
debt worth scheduling.

## Summary

| ID | Severity | Finding |
| --- | --- | --- |
| [ARCH-01](#arch-01) | High | Live runs code that exists only on an unmerged branch |
| [ARCH-02](#arch-02) | High | CI has not run on `main` since 5 Nov and will still be broken after pull request 9 merges |
| [ARCH-03](#arch-03) | High | Pull request 9 is 15 commits behind `main` and conflicts in 5 files; what will ship has never been built or tested as one |
| [ARCH-04](#arch-04) | High | One database for development, tests against real data, and production; no backup taken, no restore tried |
| [ARCH-05](#arch-05) | Medium | Two backends enforce different rules, and the rollback switch points at the weaker one |
| [ARCH-06](#arch-06) | Medium | The database path has no request limiting at all |
| [ARCH-07](#arch-07) | Medium | No way to change a function's contract without breaking installed apps |
| [ARCH-08](#arch-08) | Medium | Business rules are written three times and kept in step by hand |
| [ARCH-09](#arch-09) | Medium | Nobody is told when something fails |
| [ARCH-10](#arch-10) | Medium | Responses grow with history: whole-store JSON on every poll, no pagination |
| [ARCH-11](#arch-11) | Low | Migrations re-declare whole functions; no way down; applied by hand |
| [ARCH-12](#arch-12) | Low | Money is rupees in some columns and paise in others |
| [ARCH-13](#arch-13) | Low | The docs describe the previous system |
| [ARCH-14](#arch-14) | Low | Test gaps: no student flow in CI, vendor end-to-end tests missing from the branch that changed the vendor console most |

## What is sound

- **One door into the data.** Tables closed, 45 functions with the check inside each, a
  private schema for helpers. The access matrix and the mutation check show it works and is
  tested. This is a good design for a two-person team.
- **Atomic writes.** Stock, pool closing, the per-student limit, idempotency and delivery
  all hold under simultaneous calls ([evidence/probes/04_races.out](evidence/probes/04_races.out)).
- **Client and database agree.** All 44 `api_*` calls in
  `frontend/packages/domain/src/rpcApi.ts` match a live function's parameter names and
  required arguments (checked mechanically).
- **Pool rotation in the database** with `pg_cron`: 1,440 of 1,440 runs succeeded in the
  last 24 hours on live.
- **A single choke point in the client** (`api.ts` / `rpcApi.ts`) makes the backend swap
  small and reversible.
- **Scale assumptions are reasonable** for the stated campus; role statement timeouts (3 s
  signed-out, 8 s signed-in) bound any single call.

---

### ARCH-01

**Live is ahead of `main`.** High. Live has 24 migrations; `main` has 17. The other 7
(idempotency, cash and fees, privacy, cancel order, audit log, consent, client errors) are
only on `claude/determined-darwin-8qyjz0`. If that branch were lost or rewritten, the
running schema would have no source. Migrations were applied by hand through a tool before
review, so review cannot stop a change, only describe it afterwards. 8 function bodies
already differ from the files by comment lines ([evidence/drift-check.md](evidence/drift-check.md)),
so the README's "byte-identical" check is not usable as an alarm.
Fix: merge first, apply after; apply from CI with `supabase db push` against staging, then
production; add a scheduled drift check that compares function fingerprints (the query in
the drift evidence) and fails loudly.

### ARCH-02

**CI is not running.** High. `.github/workflows/ci.yml@main` declares the job key
`database` at lines 29 and 78, a result of merging two branches that each added one. Runs
21 and 22 failed within a second and are listed by file path, not by workflow name. Pull
request 9's own version has one `database` job, but the merge is textually clean, so the
merged file keeps both and stays broken. The first `database` job (backend integration
tests, `npm run test:db`) and the second (`scripts/test-db.sh`) are both wanted; they need
different names. Fix that on `main` before anything else merges; then make the checks
required (SEC-20).

### ARCH-03

**The shipping combination does not exist yet.** High. Merge base is `c7b89ed`. `main` has
the final Phase 1 backend (validation, idempotency middleware, local token checks, team
members); pull request 9 has none of it and was tested against the older backend. A trial
merge conflicts in `frontend/apps/student/src/main.tsx`, `frontend/apps/vendor/src/main.tsx`,
`frontend/package-lock.json`, `frontend/packages/domain/src/format.ts` and
`frontend/packages/domain/src/rpcApi.ts`. The pull request is 178 files and 8,379 added
lines in one review unit, including a generated Android project and binary assets.
Fix: rebase onto `main`, resolve, run every suite on the result, and split the Android
scaffold and the legal drafts into their own pull requests.

### ARCH-04

**One environment.** High. Local development, the documented seed command (SEC-15), manual
checks "as anonymous, store owner and stranger", and production all use project
`icnkzzjnuoyfupaydian`. No staging project, no point-in-time restore on the free plan, the
backup workflow has never run and no restore has been attempted
(`docs/PRODUCTION_PLAN.md:49`). The plan lists these as "never cut"; they are the items not
started.
Fix, in order: one manual encrypted dump today; staging project; backup secrets and a first
scheduled run; one restore into staging with `scripts/backup/restore-check.sh`.

### ARCH-05

**Two backends, two rule sets.** Medium. During the switch-over both paths are live against
the same tables.

| Rule | Express (`main`) | Database functions |
| --- | --- | --- |
| Sign-in to order | Optional until a flag | Always |
| 3 orders per student per pool | No | Yes |
| Store scoping | Behind a flag | Always |
| Owner-only price change | Yes, when scoping is on | **No** (SEC-02) |
| Cancelled orders hidden from store lists | No (does not know the status) | Yes |
| Team logins, revenue chart | Yes | No equivalent |
| Cash, fees, consent, audit reads, export, delete | No | Yes |
| Request limits | Per IP and per user | None (ARCH-06) |

`VITE_BACKEND=express` is the rollback. After cut-over it would send users back to the path
without the order limit and with public order lists, against a schema it was not written
for (a `cancelled` status it does not filter, cash columns it does not set). The plan's
"delete Express after 48 stable hours" has no stated gate for the two features with no
database equivalent.
Fix: set the Express flags now so the fallback is at least as strict; write the rollback as
a tested procedure; decide where team invites live (they need the Auth admin API, so an
Edge Function) before removing Express.

### ARCH-06

**No request limiting on the database path.** Medium. Supabase REST applies no per-caller
limit to `rpc` calls. The only brakes are the 3-order rule, the global error-report cap and
the statement timeouts. Consequences already shown: SEC-03, SEC-04. Not yet shown but
implied: unlimited `api_update_me`, `api_record_consent` (any version string creates a row),
`api_create_menu_item`, picture uploads (SEC-11), and signed-out polling of
`api_student_view`, which takes an advisory lock and may write.
Fix: a small `private.rate_limit(key, max, window)` helper backed by a table, called at the
top of each writing function with `auth.uid()`; Supabase's own Auth rate limits and CAPTCHA
for sign-up and OTP; consider Cloudflare in front of the API host when the domain exists.

### ARCH-07

**No versioning for the function API.** Medium. A changed signature is a dropped function
(`drop function if exists … ; create …` in `20261106035650_idempotency.sql:81` and
`20261106064424_cod_and_fees.sql:113`). A web app redeploys in step; an installed Android
app does not. The plan notes "version the API before a native app ships" and the native app
is two weeks out.
Fix: additive changes only (new optional parameters with defaults; never drop within a
release window), or a versioned schema (`api_v1`) exposed alongside; a minimum-app-version
check in `api_student_view`.

### ARCH-08

**The same rule in three places.** Medium. Fee ladder: SQL `fee_for_order_count`,
`backend/utils/feeLadder.js`, `frontend/packages/domain/src/feeLadder.ts`. Platform fee: SQL
`private.platform_fee_paise()` returns 400, `PLATFORM_FEE = 4` in `constants.ts`, kept in
step by a comment. "Is this cash on delivery": SQL `private.is_cod` and
`frontend/packages/domain/src/cash.ts`. Limits (60/40/20/140 characters, 50 lines, 100
units): SQL, zod schemas, and the forms. A parity test exists for the fee ladder between
frontend and backend only.
Fix: let the database return the numbers (fee ladder, platform fee, limits) in
`api_student_view` and have the clients display them; keep one parity test per remaining
duplicate.

### ARCH-09

**Failures are silent.** Medium. No uptime check. Sentry is wired but has no DSN. The new
error table is read by opening a screen. A failed cron run is a row in
`cron.job_run_details` nobody looks at. `audit_row` swallows its own errors into a Postgres
warning (`20261110135127_audit_log.sql:101-104`), so the audit trail can stop without
anyone knowing. Supabase free-plan logs are short-lived.
Fix: an external uptime check on `api_hostels`; a daily job that raises when the sweep has
not succeeded in 5 minutes or when `client_errors` grew; send both to one phone.

### ARCH-10

**Responses grow with history.** Medium. `api_vendor_overview` returns every order of the
last 7 to 31 days plus full menus for all the caller's stores on every 15-second poll
(`20261110135021_cancel_order.sql:60-103`). `api_vendor_orders` and `api_slot_orders` have
no limit. `api_vendors` returns every store with every item to signed-out callers. At pilot
scale this is fine; at the stated 470 orders in a peak hour it is megabytes per poll per
console and the largest share of the free plan's 5 GB transfer. Index coverage was not
measured: live holds 53 orders, so plans there mean nothing yet.
Fix: split "today's working set" from history, page the history, and return only changed
rows since a timestamp; run the plan's 200-order replay on staging and read the plans then.

### ARCH-11

**Migration style.** Low. `api_place_order` is declared in full twice across
migrations, `api_vendor_overview` twice, `private.json_order` twice, `api_delete_my_account`
twice; a reviewer must diff whole bodies to see a one-line change, and the newest copy
silently drops anything added in between. No down migrations. A `do` block drops and
re-creates constraints by pattern match (`20261110135021_cancel_order.sql:8-19`).
Fix: one file per function under `supabase/functions-sql/` regenerated into migrations, or
at least a CI check that prints the diff of each re-declared function.

### ARCH-12

**Mixed money units.** Low. `menu_items.price`, `orders.tip`, `orders.delivery_fee_charged`
are rupees (`numeric`); `subtotal_paise`, `cash_collected_paise`, the fee ledger are paise
(`integer`). `private.amount_due_paise` converts on the fly. Works today; a likely source of
a 100× error when UPI arrives. Convert the three columns before payments are built.

### ARCH-13

**Docs lag the system.** Low. `README.md`, `docs/ARCHITECTURE.md` and `supabase/README.md`
describe an Express-only system where the apps "use Supabase only for login";
`supabase/README.md` lists 10 migrations; the security-layers diagram says 8 public
functions (there are 9); `docs/PHASE1_CLOSEOUT.md` says 13 migrations, 0 audit findings and
"no open findings". `README.md` recommends the seed command (SEC-15). A new developer
following the docs will misjudge where the access checks are.

### ARCH-14

**Test gaps.** Low. The vendor Playwright suite and `backend/test/db/rpc.test.js` are on
`main` only; pull request 9 replaces them with script-driven runs under `scripts/*-e2e/`
that CI does not execute. No test covers hostile input in the consoles (SEC-14), the
owner-only price rule (SEC-02), payment values (SEC-01), or quantities at the limits
(SEC-03). No load test has run against a real instance.
