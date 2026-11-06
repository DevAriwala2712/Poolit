#!/usr/bin/env bash
# Restore drill: prove a backup can actually be restored, and that what comes back matches
# what was backed up. Run it after the first backup and then monthly.
#
#   RESTORE_ADMIN_URL=postgres://postgres:...@host:5432/postgres \
#     scripts/backup/restore-check.sh backups/poolit-20261106-010203.dump.age ~/offline/poolit-age-key.txt
#
# Arguments: the encrypted dump, and the age identity (PRIVATE key file) that matches the
# public key the backup used. RESTORE_ADMIN_URL must point at a SCRATCH Postgres server where
# a temporary database may be created and dropped; never point it at production.
#
# It decrypts, restores into a fresh database, then checks:
#   * every table's row count equals the count recorded at backup time (the .counts.json beside the dump)
#   * the api_* functions came back
# and exits non-zero (with the reason) if anything differs.
set -euo pipefail

DUMP="${1:?usage: restore-check.sh <dump.age> <age identity file>}"
IDENTITY="${2:?usage: restore-check.sh <dump.age> <age identity file>}"
: "${RESTORE_ADMIN_URL:?set RESTORE_ADMIN_URL to the admin connection string of a scratch server}"
COUNTS="${DUMP%.dump.age}.counts.json"
[ -f "$COUNTS" ] || { echo "FAIL: missing $COUNTS (the row counts recorded at backup time)"; exit 1; }

WORK="$(mktemp -d)"
DB="poolit_restore_$$"
cleanup() {
  psql "$RESTORE_ADMIN_URL" -X -q -c "drop database if exists $DB with (force)" >/dev/null 2>&1 || true
  rm -f -- "$WORK/restore.dump"
  rmdir "$WORK" 2>/dev/null || true
}
trap cleanup EXIT

# URL of the scratch database: same server, different database name
scratch_url="${RESTORE_ADMIN_URL%/*}/$DB"

echo "1/4 decrypting"
if ! age -d -i "$IDENTITY" -o "$WORK/restore.dump" "$DUMP" 2>"$WORK/age.err"; then
  echo "FAIL: could not decrypt the backup ($(tr '\n' ' ' < "$WORK/age.err"))"
  exit 1
fi

echo "2/4 restoring into a fresh database"
psql "$RESTORE_ADMIN_URL" -X -q -v ON_ERROR_STOP=1 -c "create database $DB"
# The API roles exist on Supabase; make them exist here so grants and policies restore.
psql "$scratch_url" -X -q -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
SQL
pg_restore --no-owner --no-privileges -d "$scratch_url" "$WORK/restore.dump" 2>"$WORK/restore.err" || true
# "already exists" is expected (a new database already has its public schema); show anything else.
if grep -vE 'already exists|^Command was|^$|errors ignored on restore' "$WORK/restore.err" | grep -q .; then
  echo "NOTE: pg_restore reported problems (check they are harmless):"
  grep -vE 'already exists|^Command was|^$|errors ignored on restore' "$WORK/restore.err" | head -8
fi

echo "3/4 comparing row counts with the backup"
status=0
python3 - "$COUNTS" "$scratch_url" <<'PY' || status=$?
import json, subprocess, sys
counts = json.load(open(sys.argv[1]))
url = sys.argv[2]
bad = 0
for table in sorted(counts):
    schema, name = table.split(".", 1)
    r = subprocess.run(["psql", url, "-X", "-At", "-c", f'select count(*) from "{schema}"."{name}"'], capture_output=True, text=True)
    got = r.stdout.strip()
    ok = r.returncode == 0 and got == str(counts[table])
    print(f"  {'ok  ' if ok else 'FAIL'} {table}: backed up {counts[table]}, restored {got or r.stderr.strip()[:60]}")
    bad += 0 if ok else 1
sys.exit(1 if bad else 0)
PY

echo "4/4 checking the functions came back"
fns="$(psql "$scratch_url" -X -At -c "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'api\_%'")"
if [ "${fns:-0}" -lt 1 ]; then
  echo "  FAIL: no api_ functions in the restored database"
  status=1
else
  echo "  ok   $fns api_ functions restored"
fi

if [ "$status" -eq 0 ]; then
  echo "RESTORE CHECK PASSED"
else
  echo "RESTORE CHECK FAILED"
fi
exit "$status"
