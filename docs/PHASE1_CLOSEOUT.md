# Phase 1 close-out (2 Nov 2026)

Everything in Phase 1 that can be done in code and in the live database is done. What remains needs an account, a dashboard, or a decision, and is listed here with exact steps.

## Done in this phase

| Area | What shipped |
| --- | --- |
| Schema | 13 migrations in `supabase/migrations/`, applied to the live project and reproducible from scratch (CI builds a clean database from them) |
| Access control | Per-store vendor access, owner/staff roles, team invites (`/vendors/:id/members`, always store-scoped), student phone login, other students' orders no longer exposed |
| Safety | zod validation on every write route, idempotency keys on orders / restock / stock adjust, rate limits (per IP for students, per user for vendor writes, shared Redis store when configured), RLS deny-all on every table, grants revoked from the public roles |
| Data integrity | Price and name frozen on each order line, `subtotal_paise`, atomic stock / pool functions covered by integration tests |
| Operations | Pool rotation and idempotency purge run inside Postgres with `pg_cron` every minute / daily (verified running), structured JSON logs with request IDs, Sentry hooks in the API and both apps (off until a DSN is set) |
| Performance | Local JWT verification (once asymmetric signing keys are on), one-request vendor console, server-side daily revenue for Analytics |
| Quality | CI: backend unit tests, database integration tests against a real Postgres, frontend typecheck / lint / unit tests / build, Playwright vendor smoke tests |

## Still needs you (cannot be done from code)

1. **Supabase Auth settings** (dashboard → Authentication): turn on leaked-password protection, add an MFA method, and enable *JWT signing keys* (asymmetric) so local token verification takes effect. The security advisor flags the first two.
2. **Vercel environment variables** on the backend project:
   `ENFORCE_VENDOR_SCOPING=true` (every vendor login is already linked to its store); `STUDENT_LOGIN_REQUIRED=true` after the new student app is deployed and the Supabase Phone provider + DLT-registered SMS sender are on (see `PHASE1_RUNBOOK.md`); optionally `SENTRY_DSN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Frontend projects: `VITE_SENTRY_DSN`.
3. **Sentry**: create one project for the API and one per app, put the DSNs in step 2.
4. **Uptime alert**: add an UptimeRobot / Better Stack check on `GET /` of the API paging a phone. (`GET /` returns `status: healthy`.)
5. **Staging project**: create a second Supabase project and Vercel preview environment, then apply the migrations to it with `supabase db push` (the files are the source of truth). Point preview deployments at it.
6. **Restore drill** (gate for Phase 1): upgrade to Supabase Pro, enable Point-in-Time Recovery, restore to a new project once, confirm the app works against it, write down the time it took.
7. **Security review sign-off**: a human pass over this file plus the diff.

## Security review (2 Nov 2026)

Reviewed the whole branch diff by hand plus tooling. Result: no open findings in code; two Supabase Auth settings are dashboard-only (item 1 above).

| Check | Result |
| --- | --- |
| `npm audit` (API, prod deps) | 7 findings at start (zod DoS *high*, qs via express, glob/minimatch via Sentry). Fixed by upgrading zod to 4.6.7, Sentry to 10.78, express/qs. **0 vulnerabilities.** Frontend: 0. |
| Secret scan | No keys or tokens in the repo. Only the Supabase *publishable* key is present (meant to be public). |
| Supabase security advisor (live) | No errors. "RLS enabled, no policy" notes are intentional (deny-all; only the server's service role reads data). Warnings: leaked-password protection and MFA (dashboard). |
| Function grants (live) | `place_order`, `adjust_stock`, `ensure_open_slot`, `sweep_expired_slots`, `purge_idempotency_keys`, `vendor_daily_revenue`: not executable by `anon` or `authenticated`. |
| Authorisation | Team routes are always store-scoped and owner-only; students (phone logins) are refused on vendor routes; last owner can't be removed or demoted; price edits are owner-only. |
| Token handling | Local JWT check requires signature, issuer, audience and subject; failures are never retried against a weaker path; forged/expired tokens tested. |
| Input handling | zod on all write bodies (unknown keys dropped); request IDs are pattern-restricted before being echoed in headers. |
| Fixed during review | Cron secret was compared with `!==` (now constant-time). Idempotency keys used `crypto.randomUUID`, which throws over plain `http://` LAN testing (now falls back). Invite lookup only searched the first 1,000 accounts (now pages). |
| Accepted, documented | Locally verified tokens outlive sign-out until expiry (1 h). CORS is open when `ALLOWED_ORIGINS` is unset: **set it in production**. Request logs include IP and user id (keep ≥180 days for CERT-In; covered by the privacy notice). |

## Known limits

- Student-app end-to-end test is not written (login is phone OTP); the vendor console has smoke tests with a mocked API.
- A token verified locally stays valid until it expires (default 1 h) even after sign-out or a ban; `LOCAL_JWT_VERIFY=false` restores per-request checks.
- Menu prices, tips and fees are still rupees; only order totals are in paise.
- Team invites use Supabase's built-in invite email; set the redirect URL and email template in the dashboard.
