# Probes

Run only against a throwaway local database built from `supabase/migrations` (the same way
`scripts/test-db.sh` builds one). Nothing here was ever run against the live project.

| File | What it checks | Rolls back? |
| --- | --- | --- |
| `01_access_matrix.sql` | Every `api_*` function called by 8 kinds of actor with store X's ids; prints who got through and any deviation from the intended rule | Each call, yes. Fixtures stay (schema `rv`) |
| `02_targeted.sql` | Personal data in responses, order abuse, payment label, paused store, cash, idempotency, account deletion, signed-out error flood | Yes |
| `03_storage_and_images.sql` | Upload rule and the picture shared by barcode | Yes |
| `04_races.sh` | Five two-session races | No: run on a copy |

`*.out` is the output recorded on 11 Nov 2026 at `396345d` (Postgres 16). `04_races.out` is
condensed: shell job-control lines and stack context are removed.

The storage probe uses the test stand-in for `storage.objects`; it shows what the policy
allows, not what the real Storage API additionally enforces (file size and MIME type).
