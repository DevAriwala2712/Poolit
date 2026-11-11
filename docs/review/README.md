# Security and architecture review (started 11 Nov 2026)

Status: **in progress**. This folder is pushed after each step; the table shows what is done.

| Step | File | State |
| --- | --- | --- |
| 0. Status and scope | [00-status-and-scope.md](00-status-and-scope.md) | Done |
| 1. Inventory and drift check | [01-inventory.md](01-inventory.md) | Done |
| 2. Threat model | `02-threat-model.md` | Next |
| 3, 4, 7. Database functions, business rules, storage | [03-findings-security.md](03-findings-security.md) | Done: 13 findings (1 High, 4 Medium) |
| 5, 6, 8, 9, 10. Auth, Express, frontends, privacy, supply chain | same file | In progress |
| 11. Architecture findings | `04-findings-architecture.md` | Not started |
| Owner checklist | `05-owner-checklist.md` | Not started |
| Remediation backlog | `06-remediation-backlog.md` | Not started |
| Coverage matrix | `07-coverage-matrix.md` | Not started |

The review is report-only: no product code, migration or live setting is changed by it.
The live Supabase project is only ever read (catalog queries and advisors). Attack attempts
run against a throwaway local database built from the migrations.

Evidence (generated listings, probe SQL, outputs) is in [evidence/](evidence/).

## Paused on 11 Nov 2026: found but not yet written up in full

| Severity | Finding | Evidence |
| --- | --- | --- |
| Critical | "Batch KOT" in the vendor console writes the student's name, block, room and order note unescaped into a same-origin print window (`frontend/apps/vendor/src/screens/Orders.tsx`, on `main` and pull request 9). A 101-character note read the store's Supabase session from browser storage. On the Express path the order needs no sign-in while `STUDENT_LOGIN_REQUIRED` is off | Passing browser reproduction: `evidence/probes/05_print_window_xss.spec.ts` and `.out` |
| High | `backend/seed.js` deletes six tables of whatever database `.env` points at, with no guard; `README.md` calls it "safe to re-run"; the only project is live and no backup has run | Code read |
| High (not verified on Vercel) | With both rollout flags off, three Express order-list routes are public and return names and rooms; any store login can act on every store | [01-inventory.md](01-inventory.md) |
| Low | Express idempotency stores the response after replying (`backend/middleware/idempotency.js`) | Code read |
| Low | `cron.job_run_details` is never pruned: 12,798 rows on live, about 1,440 a day | Live count |

Live facts (read-only, 11 Nov): 2 auth users, both store logins, one also the platform
admin; 0 students; 0 MFA factors; 53 orders, all seed data; database 16 MB; all 4 cron jobs
succeeding. No real student data is on live yet, so these are pre-launch blockers, not a breach.

Still to do: authentication, rest of Express, frontends and Android, privacy, supply chain
and CI, threat model, architecture findings, owner checklist, backlog, coverage matrix.
