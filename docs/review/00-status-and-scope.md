# 0. Status and scope

Snapshot taken 11 Nov 2026.

## What is being reviewed

| Target | Pinned at | How it is read |
| --- | --- | --- |
| `main` | `891e435` | This branch (`claude/lucid-cerf-ind1pc` starts from it) |
| Open pull request [DevAriwala2712/Poolit#9](https://github.com/DevAriwala2712/Poolit/pull/9) | `396345d` | Detached checkout outside the repo; never merged into this branch |
| Live Supabase project `icnkzzjnuoyfupaydian` (ap-southeast-1, Postgres 17.6) | 11 Nov 2026 | Read-only catalog queries and the security advisor |

File references in the findings are `path:line @ sha`. Where no sha is given the file is the
same at both.

## Status found

| Area | State | Evidence |
| --- | --- | --- |
| `main` | 17 migrations, 32 `api_*` functions, Express is the default data path for both apps | `supabase/migrations/`, `frontend/packages/domain/src/rpcApi.ts` |
| Pull request 9 | 18 commits, 178 files, +8,379 / −550. Adds 7 migrations (idempotency, COD and fees, privacy, cancel order, audit log, consent, client errors), switches the vendor console to database functions, backup workflow, Android wrapper, legal drafts. **Open, not merged** | `git log 891e435..396345d` |
| Pull request 9 versus `main` | 15 commits behind `main`; **does not merge cleanly** (5 conflicted files) | `git merge-tree`, see [01-inventory.md](01-inventory.md#branch-state) |
| Live database | 24 migrations applied, the same 24 as pull request 9. **Live is 7 migrations ahead of `main`** | `list_migrations` |
| Live versus repo | All 87 application functions exist on both sides with identical security mode, `search_path` and grants. 8 function bodies differ, by SQL comment lines only | [evidence/drift-check.md](evidence/drift-check.md) |
| Live exposure | 9 `SECURITY DEFINER` functions callable signed-out, 45 signed-in (36 of them signed-in only). 17 tables, all RLS on with no policy and no grant to the public roles | advisor, catalog |
| Live Auth | Leaked-password protection **off**; MFA options **insufficient** | advisor |
| CI on `main` | Last two runs (5 Nov, runs 21 and 22) **failed in under a second** with the workflow shown by file path instead of by name, which is what GitHub does when a workflow file does not load. `.github/workflows/ci.yml@891e435` defines the job key `database` twice (lines 29 and 78) | Actions run list; file |
| Rollout switches | `ENFORCE_VENDOR_SCOPING`, `STUDENT_LOGIN_REQUIRED`, `ALLOWED_ORIGINS`, `VITE_BACKEND` documented as not yet set on Vercel | `docs/PRODUCTION_PLAN.md@396345d:49`. **Not verified**: Vercel is not reachable from this review |
| Not started | Staging project, backup secrets (the backup workflow has never run), restore drill | same |

## What could not be reached

These are collected in `05-owner-checklist.md` as they come up and stay "unverified" until
the owner confirms them:

- Vercel projects (environment variables, deployed commit, domains).
- Supabase dashboard settings that are not in the catalog: Auth providers, sign-up and
  anonymous sign-in switches, OTP and rate limits, CAPTCHA, redirect allowlist, JWT signing
  keys, exposed API schemas, GraphQL switch.
- GitHub repository settings (branch protection, secrets, secret scanning, Dependabot).
- SMS provider, Cloudflare, Play Console.

## Ground rules

- Report only. No product code, migration, or live setting is changed.
- Live is read-only. No query that writes, no call that creates rows.
- A finding needs evidence: a file and line at a pinned commit, or a query and its output.
  High and Critical findings also need a reproduction against the local database.
  Anything suspected but not reproduced is listed as such, apart from the findings.
- Local database is Postgres 16; live is 17. Version-sensitive conclusions are flagged.

## Severity

| Level | Meaning |
| --- | --- |
| Critical | Signed-out or cross-store access to personal data, or tampering with money or stock |
| High | Signed-in privilege escalation, personal data leak, or unrecoverable data loss |
| Medium | Abuse, denial of service, or broken integrity under a race |
| Low | Hardening; not exploitable on its own |
| Info | Worth knowing; no action required |

## Baseline

`scripts/test-db.sh` passes against local Postgres at both `891e435` (4 test files) and
`396345d` (11 test files) before any probing. Output: `ALL DATABASE TESTS PASSED` for both.
