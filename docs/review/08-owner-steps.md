# 8. Steps that need your accounts

The three fix-first items that cannot be done in code. Each takes minutes. Do them in this
order; none depends on merging anything.

## 1. Close the Express API (SEC-16), about 5 minutes

Vercel → the **backend** project → Settings → Environment Variables → Production:

| Name | Value |
| --- | --- |
| `ENFORCE_VENDOR_SCOPING` | `true` |
| `ALLOWED_ORIGINS` | the student and vendor app URLs, comma-separated, no trailing slash |
| `STUDENT_LOGIN_REQUIRED` | `true` |

Then Deployments → the latest production deployment → ⋯ → Redeploy.

Both store logins are already linked to their stores (`docs/PHASE1_RUNBOOK.md` step 3), so
scoping breaks nothing. `STUDENT_LOGIN_REQUIRED=true` makes the currently deployed student
build (if it has no phone sign-in) unable to place orders. There are no real students on
live yet, so that is the right trade.

Check afterwards, from any terminal (replace the URL and an id from the vendor console):

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<backend>.vercel.app/vendors/<store id>/orders
```

Expect `401`. Before the change it returns `200` with names and rooms.

Undo: set the variables back and redeploy (`docs/PHASE1_RUNBOOK.md` has the rollback).

## 2. Take one backup today (ARCH-04), about 15 minutes

On your own computer (needs `pg_dump` 17 and `age`):

```bash
age-keygen -o poolit-age-key.txt
```

Keep `poolit-age-key.txt` offline (password manager or printed); it is the only way to read
the backup. Copy the public key it prints (starts with `age1`).

Supabase dashboard → **Connect** → **Session pooler** → copy the connection string and fill
in the database password. Then, from the repository root on the pull request 9 branch
(the script is there):

```bash
BACKUP_DB_URL='<session pooler string>' BACKUP_AGE_RECIPIENT='age1...' scripts/backup/backup.sh
```

It writes `backups/poolit-<time>.dump.age` and a `.counts.json` beside it. Copy both
somewhere off your computer. Never commit them.

The nightly job in `.github/workflows/backup.yml` can follow later. Before adding
`BACKUP_DB_URL` as a GitHub secret, see SEC-20: create a separate read-only database role
for dumps instead of using the owner password.

## 3. Lock the logins (SEC-17, SEC-18), about 10 minutes

Supabase dashboard → Authentication:

| Screen | Set |
| --- | --- |
| Sign In / Providers → Email | "Allow new users to sign up": **off** (store logins are invited) |
| Sign In / Providers | Anonymous sign-ins: **off** |
| Attack Protection | Leaked password protection: **on**. CAPTCHA: on once the apps send a token |
| Multi-Factor | TOTP: **on** |

Turning TOTP on only makes it available. Neither app has a screen to enrol an authenticator
yet (no `supabase.auth.mfa` calls in the code), and a factor has to be enrolled by the user
themselves, not from the dashboard. Adding that screen to the vendor console, and requiring
it for the admin login, is a small code change; it is the remaining half of SEC-18.

Until then, at least give the admin a separate login from the store owner, with a long
unique password.

Tell me the values in [05-owner-checklist.md](05-owner-checklist.md) A1 to A6 afterwards; SEC-17's severity depends on them.
