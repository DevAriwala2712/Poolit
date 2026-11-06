#!/usr/bin/env bash
# Poolit database backup: dump, encrypt with age, record row counts, upload to R2.
#
# The free Supabase plan has no point-in-time restore and no downloadable backups, so this
# is the only copy that does not depend on the Supabase project staying healthy.
#
# Encryption uses age with a PUBLIC key: this job (and anyone who steals its secrets) can
# write backups but cannot read them. Keep the matching private key (identity) offline,
# somewhere other than GitHub.
#
# Required:
#   BACKUP_DB_URL        connection string of the database to back up. On the free Supabase plan
#                        use the Session pooler string (the direct host is IPv6-only and GitHub
#                        runners have no IPv6).
#   BACKUP_AGE_RECIPIENT age public key (age1...)
# Optional (if all four R2 values are set the encrypted files are uploaded):
#   R2_ENDPOINT          https://<account id>.r2.cloudflarestorage.com
#   R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
#   BACKUP_SCHEMAS       default "public private app_policy auth"
#   BACKUP_OUT_DIR       default ./backups
#
# Files written (and uploaded):
#   poolit-<UTC time>.dump.age     the encrypted pg_dump (custom format)
#   poolit-<UTC time>.counts.json  rows per table at backup time (not secret: counts only)
#
# Storage files (product pictures) are not in the database; they can be re-uploaded and
# are not part of this backup.
set -euo pipefail

: "${BACKUP_DB_URL:?set BACKUP_DB_URL}"
: "${BACKUP_AGE_RECIPIENT:?set BACKUP_AGE_RECIPIENT (an age public key)}"
OUT_DIR="${BACKUP_OUT_DIR:-./backups}"
read -r -a SCHEMAS <<< "${BACKUP_SCHEMAS:-public private app_policy auth}"

mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
BASE="$OUT_DIR/poolit-$STAMP"

dump_args=()
schema_list=""
for s in "${SCHEMAS[@]}"; do
  dump_args+=(-n "$s")
  schema_list+="'$s',"
done
schema_list="${schema_list%,}"

echo "dumping schemas: ${SCHEMAS[*]}"
pg_dump "$BACKUP_DB_URL" --format=custom --no-owner --no-privileges "${dump_args[@]}" -f "$BASE.dump"

# Exact row count of every table, taken the same moment: the restore drill compares against it.
psql "$BACKUP_DB_URL" -X -At -c "
  select coalesce(json_object_agg(table_schema || '.' || table_name,
           (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint
           order by table_schema, table_name), '{}'::json)
  from information_schema.tables
  where table_type = 'BASE TABLE' and table_schema in ($schema_list)" > "$BASE.counts.json"

age -r "$BACKUP_AGE_RECIPIENT" -o "$BASE.dump.age" "$BASE.dump"
# the unencrypted dump must not stay on disk
rm -f -- "$BASE.dump"

bytes="$(wc -c < "$BASE.dump.age" | tr -d ' ')"
tables="$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(len(d), sum(d.values()))' "$BASE.counts.json")"
echo "wrote $BASE.dump.age ($bytes bytes encrypted); tables and rows: $tables"

if [ -n "${R2_ENDPOINT:-}" ] && [ -n "${R2_BUCKET:-}" ] && [ -n "${R2_ACCESS_KEY_ID:-}" ] && [ -n "${R2_SECRET_ACCESS_KEY:-}" ]; then
  for f in "$BASE.dump.age" "$BASE.counts.json"; do
    curl --fail --silent --show-error --max-time 300 \
      --aws-sigv4 "aws:amz:auto:s3" --user "$R2_ACCESS_KEY_ID:$R2_SECRET_ACCESS_KEY" \
      -T "$f" "$R2_ENDPOINT/$R2_BUCKET/$(basename "$f")"
    echo "uploaded $(basename "$f")"
  done
else
  echo "R2 is not configured: the backup stays in $OUT_DIR only"
fi
