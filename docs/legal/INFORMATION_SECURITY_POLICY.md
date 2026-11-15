# Information Security Policy (DRAFT, internal)

Short on purpose. A policy nobody follows is worse than a short one people do. Each rule says whether the control **exists today** (verified by an automated test or a check in the repo), **is a setting someone must turn on**, or **is a gap**.

## 1. Data access
| Rule | Status |
| --- | --- |
| Tables are closed to the public: row-level security on, no table permissions for the app roles, no policies. All access is through named database functions that check who is calling. | Exists. Tested in `supabase/tests/10_api_security.sql` and live. |
| A student can read and change only their own data; a store only its own store; only Poolit admins set fees. | Exists, tested. |
| Functions that move stock, close or dispatch pools, or place orders directly are not callable by app users. | Exists, tested. |
| Retried orders and stock changes cannot double-apply. | Exists (`idempotency_keys`), tested. |
| The service key (bypasses all rules) never goes into an app, a repo or a chat. It lives only in the hosting dashboards and the backup secrets. | Rule. Check at each release: search the built app for it. |

## 2. Accounts
- Students sign in with a phone one-time code. Rate limits stay on in the Supabase dashboard. **Setting to confirm.**
- Store and admin accounts use a password plus a second factor. **Setting to turn on (MFA); gap until then.**
- Leaked-password protection on in Supabase auth. **Setting to turn on.**
- Poolit admins are rows in `platform_admins`. Add by hand through the SQL editor, review the list monthly. Two people at most hold the dashboard owner role.
- Offboarding: remove the person from the Supabase, Vercel, GitHub and backup-storage organisations the same day.

## 3. Secrets
- Never commit secrets. The GitHub secret scanner is on; the repository's CI must fail on a leaked key. **Confirm the setting.**
- Secrets live in: GitHub Actions secrets (backups), Vercel project settings (app config), Supabase (service key). Rotate any of them on a suspected leak, and each year.
- The backup encryption **private** key is stored offline, in two places, never in GitHub. Only the public key is in CI.

## 4. Data protection
- In transit: HTTPS everywhere (Supabase and Vercel enforce it).
- At rest: Supabase encrypts storage; nightly backups are additionally encrypted before they leave (`scripts/backup/backup.sh`). A restore drill (`restore-check.sh`) proves a backup is usable. See [BACKUP_AND_RESTORE.md](../BACKUP_AND_RESTORE.md).
- Personal data rules, retention and deletion: [DATA_REGISTER.md](DATA_REGISTER.md) and the [Privacy Policy](PRIVACY_POLICY.md). Students can export and delete their data in the product.
- Production data is not copied to laptops or used for testing. Tests use fixtures.

## 5. Changes to the system
- All code goes through a pull request and the CI checks (typecheck, lint, tests, builds, database tests). Database changes are migration files, tried on a copy first and then applied by a named person. **A staging project is still to be created.**
- Product photos: only a store can upload to its own folder, only images under 200 KB, never overwritten. Tested in the photo end-to-end run.

## 6. Logging and monitoring
- Keep database, auth and hosting logs at least 180 days. **Gap:** the free plan keeps far less, so export them (to the backup bucket) or upgrade. Decide before launch.
- Alert on: nightly backup failure, keep-alive failure, a rise in failed requests. **Backup and keep-alive workflows exist; the alert destination and the error tracker are still to set up.**

## 7. People
Everyone with access reads this and the [incident plan](INCIDENT_RESPONSE_PLAN.md). Report a mistake or a suspicion straight away; nobody is blamed for reporting.

## 8. Review
Every quarter and after every incident: walk this table and update the Status column honestly.
