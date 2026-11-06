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

## Slow-connection and stock-correction checks

The last section of `run.cjs` sets `rest.delayMs = 1500` on the fake server so every call is answered 1.5 s late, then checks that +10 shows on screen before the server answers, that Undo and the Fix stock panel (take away, set exact count) work and are recorded, and that a change the server rejects goes back to the true count with the reason shown.
