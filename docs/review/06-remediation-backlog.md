# 6. Remediation backlog

Ordered by the gate each item blocks. Sizes are rough developer time for someone who knows
the code: S under 2 hours, M half a day, L a day or more. "Owner" items need dashboard
access, not code.

## Now (before anything else merges)

| # | Do | Fixes | Size |
| --- | --- | --- | --- |
| 1 | Escape the four fields in Batch KOT (`Orders.tsx`), add a hostile-name test | SEC-14 | S |
| 2 | Set `ENFORCE_VENDOR_SCOPING=true`, `STUDENT_LOGIN_REQUIRED=true` (or take Express order lists down), `ALLOWED_ORIGINS` | SEC-16 | Owner |
| 3 | Guard `backend/seed.js`; fix the README instruction | SEC-15 | S |
| 4 | Take one encrypted dump of live by hand and store it off the project | ARCH-04 | Owner, S |
| 5 | Rename the duplicate `database` job in `ci.yml` on `main`; confirm a green run | ARCH-02 | S |
| 6 | Turn on leaked-password protection and TOTP; enrol both logins; confirm sign-up and anonymous sign-in are off | SEC-17, SEC-18 | Owner |

## Before merging pull request 9

| # | Do | Fixes | Size |
| --- | --- | --- | --- |
| 7 | Rebase onto `main`, resolve the 5 conflicts, run every suite on the result | ARCH-03 | M |
| 8 | Restrict `payment_method` to known codes; show "to collect" unless a payment is confirmed | SEC-01 | M |
| 9 | Owner-only price change in `api_update_menu_item`; add the test | SEC-02 | S |
| 10 | Caps on units and value per order; count cancellations toward a per-pool attempt limit | SEC-03 | M |
| 11 | Cap rows and bytes in `client_errors`; shrink the signed-out budget; index `first_at` | SEC-04 | S |
| 12 | Stop cross-store picture borrowing, or make it opt-in and overridable | SEC-05 | M |
| 13 | Require a consent row in `api_place_order`; refuse orders to a paused store | SEC-06, SEC-07 | S |
| 14 | Null `client_errors.user_id` on deletion; revoke sequence privileges; lock the pool first in cancel; prune `cron.job_run_details` | SEC-08, 09, 10, 24 | S |
| 15 | Put the vendor end-to-end suite and `rpc.test.js` back into CI; run `npm audit fix` | ARCH-14, SEC-25 | S |
| 16 | Split the Android scaffold and legal drafts into separate pull requests | ARCH-03 | S |

## Before switching the apps to the database functions

| # | Do | Fixes | Size |
| --- | --- | --- | --- |
| 17 | Staging project; migrations applied from CI; scheduled drift check | ARCH-01, ARCH-04 | L |
| 18 | Backup secrets with a read-only dump role; first scheduled run; one restore drill | ARCH-04, SEC-20 | M |
| 19 | Per-caller rate-limit helper on writing functions | ARCH-06 | M |
| 20 | Content-Security-Policy and HSTS on both apps; self-host the icon font | SEC-19, SEC-26 | M |
| 21 | Workflow `permissions:`, actions pinned by commit, branch protection with required checks | SEC-20 | S + Owner |
| 22 | Write and rehearse the rollback; decide where team invites and the revenue chart live | ARCH-05 | M |
| 23 | Uptime check and a cron-failure alert to one phone | ARCH-09 | S |

## Before the pilot

| # | Do | Fixes | Size |
| --- | --- | --- | --- |
| 24 | Additive-only rule or versioned schema for functions; minimum-app-version check | ARCH-07 | M |
| 25 | Serve fee ladder, platform fee and limits from the database | ARCH-08 | M |
| 26 | Page order history; return changes since a timestamp; run the 200-order replay | ARCH-10 | L |
| 27 | Correct the privacy drafts against the system; decide on public stock numbers | SEC-23, SEC-12 | S |
| 28 | Upload count budget and orphan sweep | SEC-11 | S |
| 29 | Android: `allowBackup="false"`, minify, verify wrapper checksum, first real build | SEC-22 | M |
| 30 | Update `README.md`, `docs/ARCHITECTURE.md`, `supabase/README.md`, the security diagram, `PHASE1_CLOSEOUT.md` | ARCH-13 | M |
| 31 | Convert rupee columns to paise before payments | ARCH-12 | M |
| 32 | Smaller Express items, if Express is still deployed by then | SEC-21 | S |

Items 1 to 6 are about one developer-day plus an hour of dashboard work, and remove the
Critical and all three High security findings.
