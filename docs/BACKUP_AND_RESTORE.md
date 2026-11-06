# Backup and restore

The free Supabase plan has no point-in-time restore and no downloadable backups. These
scripts are the recovery path that does not depend on the Supabase project.

## What is backed up

- The `public`, `private`, `app_policy` and `auth` schemas (orders, students, stores, menus,
  stock history, vendor links, the functions, and the login accounts).
- A `counts.json` beside each backup with the exact row count of every table at that moment.

**Not backed up:** product pictures (the files in the `product-images` bucket live in Supabase
Storage, not in the database; they can be re-uploaded) and Supabase's own settings (Auth
providers, SMS provider, the dashboard switches). Write the settings down in a safe place.

## How it is protected

Each backup is encrypted with [age](https://github.com/FiloSottile/age) using a **public**
key. The nightly job holds only the public key, so a leaked GitHub secret cannot read old
backups. The matching **private key must be kept offline** (a password manager, a printed
copy in a safe), not in GitHub and not in the same account as the bucket. Without it the
backups cannot be restored: generate it once with `age-keygen`, store it, and put only the
`age1...` public line into the `BACKUP_AGE_RECIPIENT` secret.

## One-time setup

1. `age-keygen -o poolit-age-key.txt` on your own machine. Store the file safely; copy the public
   key (the line starting `age1`).
2. Cloudflare dashboard: create an R2 bucket named e.g. `poolit-backups`, **private**, and an API
   token with read and write access to that bucket only. Note the account's S3 endpoint
   (`https://<account id>.r2.cloudflarestorage.com`).
3. In R2, add a lifecycle rule that deletes objects older than 30 days (the free allowance is 10 GB;
   a backup is a few MB).
4. GitHub repository secrets: `BACKUP_AGE_RECIPIENT`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, and `BACKUP_DB_URL` (Supabase dashboard, Connect, **Session pooler**
   string with the database password filled in).
5. Actions tab, **Nightly backup**, Run workflow. Check the log ends with `uploaded ...dump.age`.

## Restore drill (do it once now, then monthly)

A backup nobody has restored is a hope, not a backup.

```bash
# 1. fetch a backup and its counts file from R2 (any S3 tool, or the Cloudflare dashboard)
# 2. restore into a SCRATCH Postgres (a local one is fine; never production)
RESTORE_ADMIN_URL=postgres://postgres:...@localhost:5432/postgres \
  scripts/backup/restore-check.sh poolit-20261106-010203.dump.age ~/safe/poolit-age-key.txt
```

It decrypts, restores into a temporary database, compares every table's row count with the
count recorded at backup time, checks the `api_*` functions came back, and prints
`RESTORE CHECK PASSED` or says exactly what is wrong. It cleans up after itself.

## Restoring for real

After the drill passes you know the file is good. To recover the live project: create a new
Supabase project, apply `supabase/migrations`, then `pg_restore --data-only` the dump's tables
into it (or restore the whole dump into the new database first and re-apply the grants from the
migrations). Do this with the Poolit developer; it is deliberately not a one-click action.

## What has been tested, and what has not

Tested locally on Postgres 16: backup, encryption (no readable text in the file), restore into a
scratch database, equal row counts across all tables, the functions present, and the failure cases
(wrong key, corrupted file, rows missing, counts file missing). **Not yet tested:** the GitHub
workflow itself, the upload to R2, and restoring a dump of Supabase's Postgres 17 `auth` schema on a
plain server.
