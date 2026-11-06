# Runbooks

Short, tested-where-possible procedures for the things that will actually happen. Commands assume you are in the repo root. Where a step could not be tried from the build environment (it cannot reach Supabase), it says **untried**.

## 1. A store cannot see its orders / the app shows errors
1. Open the browser console on the failing screen; note the status of the failed request (`401` signed out, `403` wrong store, `404` not found, `422` rejected, `5xx` server).
2. `401`: ask them to sign in again. `403`: check the vendor's row in `vendor_users` points at the right store.
3. `5xx` or timeouts: check <https://status.supabase.com> and the Supabase dashboard logs (API, Postgres). If the project is **paused** (free plan, idle for a week), restore it in the dashboard, then check the keep-alive workflow ran.

## 2. A pool did not close or dispatch
Pools close by a minute-by-minute job (`poolit-sweep-slots`, `public.sweep_expired_slots()`), and stores can close or dispatch in the app.
1. In the SQL editor: `select jobid, jobname, schedule, active from cron.job;` then `select * from cron.job_run_details order by start_time desc limit 10;` — look for failures.
2. The sweeper logs a warning per hostel that failed; one bad hostel does not stop the others.
3. To close by hand, ask the store to press Close in the app, or call `select public.close_slot(<slot id>);` as the service role.

## 3. Money or stock looks wrong
1. Never edit orders in place. Look first: `select id, status, items, subtotal_paise, delivery_fee_paise, tip_paise, payment_method, cash_collected_paise from orders where id = '<uuid>';`
2. Stock changes are recorded in `stock_adjustments`; compare with `menu_items.stock`.
3. Fee lines are in `order_fee_ledger` (one per delivered order, written once). A wrong rate affects *later* orders only; correct it with `api_set_fee_terms` (admin).
4. A student saying "I was charged twice": check `idempotency_keys` for the same user, then the order list. A retry with the same key returns the original order instead of a second one.

## 4. Set or change a store's commission (admin)
Signed in as a Poolit admin (a row in `platform_admins`): call `api_set_fee_terms` with the store, `percent` or `fixed_per_order`, and the value. `api_fee_statement` shows a store's delivered goods, fee and net for a date range (the store itself can read its own). **Untried on the live project** until the cod_and_fees migration is applied.

## 5. A student asks for their data or to be deleted
1. They use the Profile buttons (**still to build**); until then an engineer runs, as that user's session, `select api_export_my_data();` and sends the JSON, or `select api_delete_my_account('DELETE');`.
2. Deletion is refused while an order is in progress, and for store or admin accounts. Remove those by hand after checking nothing is owed.
3. Record the request and the date (the grievance tracker) and reply within the legal time.

## 6. Add a new store or hostel
1. Add the hostel / store / vendor rows (see `supabase/tests/10_api_security.sql` for the shape; the fixtures in `scripts/vendor-e2e/fixture.sql` show a complete set).
2. Create the store owner in Supabase Auth, then a `vendor_users` row linking them to the store.
3. Set fee terms (section 4) and open a slot with `ensure_open_slot`.
4. Ask the owner to sign in once and add one item with a photo.

## 7. Backups
Nightly by `.github/workflows/backup.yml`. To check or restore see [BACKUP_AND_RESTORE.md](BACKUP_AND_RESTORE.md). Run the restore drill after any schema change. The workflow itself is **untried on GitHub** until the secrets exist.

## 8. Apply a database change
1. Add a migration file in `supabase/migrations/` and a test in `supabase/tests/`.
2. `scripts/test-db.sh` must print ALL DATABASE TESTS PASSED.
3. Apply to a staging project first (**no staging project yet**); then to production. Rename the file to the version the dashboard recorded, so repo and database agree (`list_migrations`).
4. Take a manual backup (workflow dispatch) before anything destructive.

## 9. Roll back a bad app release
Vercel: Deployments, open the previous good one, Promote to production. The two apps are separate projects; roll back the one that broke. A database migration cannot be undone this way; write a new forward migration.

## 10. The free plan limits you will hit first
Egress (5 GB a month) and storage (1 GB) — check Settings, Usage weekly. Product photos are capped at 200 KB each by the upload rules (about 5,000 photos in 1 GB). The numbers and the plan upgrade point are in [SCALE_AND_IMAGES_ANALYSIS.md](SCALE_AND_IMAGES_ANALYSIS.md).
