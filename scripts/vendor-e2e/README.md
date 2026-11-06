# Vendor console end-to-end run

Runs the real vendor console, built with `VITE_BACKEND=supabase`, in Chromium against
the real `api_*` database functions on a local Postgres (same stand-in REST layer as
`scripts/student-e2e`). A store owner closes a pool, dispatches the batch, hands over
an order and restocks; a student account is refused with 403; a second store's owner
sees only their own store.

```bash
PGHOST=/path/to/socket PGPORT=5432 PGUSER=postgres scripts/vendor-e2e/run.sh
```

Needs a local Postgres (may create databases), `psql`, Node, and Playwright with
Chromium. Not part of CI. JWT signatures and Supabase Auth are not checked; the login
is injected into the browser's storage.
