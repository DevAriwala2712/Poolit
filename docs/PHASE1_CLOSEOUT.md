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
7. **Security review sign-off**: a human pass over `docs/PHASE1_CLOSEOUT.md` plus the diff. A self-review was done on 2 Nov; the live security advisor shows no errors.

## Known limits

- Student-app end-to-end test is not written (login is phone OTP); the vendor console has smoke tests with a mocked API.
- A token verified locally stays valid until it expires (default 1 h) even after sign-out or a ban; `LOCAL_JWT_VERIFY=false` restores per-request checks.
- Menu prices, tips and fees are still rupees; only order totals are in paise.
- Team invites use Supabase's built-in invite email; set the redirect URL and email template in the dashboard.
