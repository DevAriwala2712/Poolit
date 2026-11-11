# Security and architecture review (started 11 Nov 2026)

Status: **in progress**. This folder is pushed after each step; the table shows what is done.

| Step | File | State |
| --- | --- | --- |
| 0. Status and scope | [00-status-and-scope.md](00-status-and-scope.md) | Done |
| 1. Inventory and drift check | [01-inventory.md](01-inventory.md) | Done |
| 2. Threat model | `02-threat-model.md` | Next |
| 3, 4, 7. Database functions, business rules, storage | [03-findings-security.md](03-findings-security.md) | Done: 13 findings (1 High, 4 Medium) |
| 5, 6, 8, 9, 10. Auth, Express, frontends, privacy, supply chain | same file | Done: 13 more (1 Critical, 2 High, 4 Medium) |
| 11. Architecture findings | `04-findings-architecture.md` | Not started |
| Owner checklist | `05-owner-checklist.md` | Not started |
| Remediation backlog | `06-remediation-backlog.md` | Not started |
| Coverage matrix | `07-coverage-matrix.md` | Not started |

The review is report-only: no product code, migration or live setting is changed by it.
The live Supabase project is only ever read (catalog queries and advisors). Attack attempts
run against a throwaway local database built from the migrations.

Evidence (generated listings, probe SQL, outputs) is in [evidence/](evidence/).

