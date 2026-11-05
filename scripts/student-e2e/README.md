# Student app end-to-end run

Runs the real student app, built with `VITE_BACKEND=supabase`, in Chromium against
the real `api_*` database functions on a local Postgres. A small stand-in for
Supabase's REST layer (`fake-postgrest.cjs`) turns each call into SQL run as the
right role and user. Checks: the catalogue loads in one call, only the student's
own hostel is loaded, ordering as a signed-in student saves the order against that
student with a frozen price, polling is one call every ~15 s, and the Orders
screen shows the order.

```bash
PGHOST=/path/to/socket PGPORT=5432 PGUSER=postgres scripts/student-e2e/run.sh
```

Needs a local Postgres (may create databases), `psql`, Node, and Playwright with
Chromium. Not part of CI. It does not check JWT signatures or Supabase Auth; the
student's login is injected into the browser's storage.
