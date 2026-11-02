# Database migrations

Until Phase 1 the schema, RLS policies and RPC functions (`place_order`,
`close_slot`, `dispatch_slot`, `restock_item`) lived **only** in the live
Supabase project. This folder makes them version-controlled.

## 1. Capture the baseline (one-off)

The live project must be running (it was paused when this was written —
restore it from the Supabase dashboard first). Then, from the repo root:

```bash
SUPABASE_DB_URL='postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres' ./scripts/export-schema.sh
```

This writes `supabase/migrations/20261101000000_baseline.sql` (tables,
indexes, RLS, functions; no data). Review it and commit it. It must sort
**before** the other migrations here.

## 2. Apply new migrations

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

Every later schema change is a new timestamped file in `migrations/`,
reviewed in a PR — never an edit in the dashboard.
