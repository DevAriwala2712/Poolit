# Security and architecture review (11 Nov 2026)

Status: **complete**. Report only: no product code, migration or live setting was changed.
The live Supabase project was only read. Attacks ran against a local throwaway database and
a locally served vendor console.

## Bottom line

Access control in the database is sound and well tested: 375 of 376 caller-and-function
combinations behave as intended, no table is reachable, and an eight-way mutation check of
the existing tests caught every broken rule. The serious problems are around it: one script
injection in the vendor console, money and stock rules that trust the caller, an Express
deployment documented as still open, and an operating setup with one database, no backup
and no working CI.

Live holds only seed data today (2 store logins, 0 students, 53 demo orders), so these are
pre-launch blockers, not a breach.

| | Critical | High | Medium | Low | Info |
| --- | --- | --- | --- | --- | --- |
| Security (26) | 1 | 3 | 8 | 11 | 3 |
| Architecture (14) | – | 4 | 6 | 4 | – |

## Fix first (about one developer-day plus an hour in the dashboards)

Items 1, 3 and 5 are fixed on this branch (`ff712af`, `8ae0be2`, `ddc944d`). Items 2, 4 and 6 need your accounts: [08-owner-steps.md](08-owner-steps.md).

1. **SEC-14, Critical.** Escape student text in the vendor console's Batch KOT print. A
   101-character order note read the store's login session in a real browser.
2. **SEC-16, High (not verified on Vercel).** Set the three Express flags; until then order
   lists with names and rooms are public and any store login can act on every store.
3. **SEC-15, High.** Guard `backend/seed.js`; the README tells developers to run it against
   the only database.
4. **ARCH-04, High.** Take one backup by hand today; nothing can be restored at present.
5. **ARCH-02, High.** Fix the duplicate job in `ci.yml`; no test has gated `main` since 5 Nov.
6. **SEC-18, SEC-17.** Second factor on the two logins; confirm sign-up is closed.

Then, before pull request 9 merges: **SEC-01** (a student can label an order as paid),
SEC-02, SEC-03, SEC-04, SEC-05, and the rebase in ARCH-03. Full order in
[06-remediation-backlog.md](06-remediation-backlog.md).

## Files

| File | Content |
| --- | --- |
| [00-status-and-scope.md](00-status-and-scope.md) | What was reviewed, pinned commits, live snapshot, ground rules |
| [01-inventory.md](01-inventory.md) | Every door, function, table, route, job, secret name |
| [02-threat-model.md](02-threat-model.md) | Actors, what each tried, attack chains |
| [03-findings-security.md](03-findings-security.md) | SEC-01 to SEC-26, and what held up |
| [04-findings-architecture.md](04-findings-architecture.md) | ARCH-01 to ARCH-14, and what is sound |
| [05-owner-checklist.md](05-owner-checklist.md) | Dashboard settings to confirm (29 items) |
| [06-remediation-backlog.md](06-remediation-backlog.md) | 32 fixes ordered by release gate |
| [07-coverage-matrix.md](07-coverage-matrix.md) | Each inventory row with its verdict, and what was not done |
| [08-owner-steps.md](08-owner-steps.md) | Exact dashboard steps for the fix-first items that need your accounts |
| [evidence/](evidence/) | Generated listings, drift check, probe scripts and recorded output |

## Limits of this review

- Vercel, the Supabase Auth and API settings, and GitHub settings were not reachable; 29
  items wait on the owner and several severities depend on the answers.
- Nothing was run against the deployed Express API or the live REST endpoint.
- Real Storage API enforcement, query plans under load, and the Android build were not tested.
