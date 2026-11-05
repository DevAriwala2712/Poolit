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

## Rollback path check

`express-path.cjs` proves the student app's default backend (Express) still behaves as
it did before the `VITE_BACKEND` switch existed, since that is the way back if the new
backend has a problem. It fakes the Express API inside the browser and checks the app
renders from it, makes the old fan-out of calls per poll (hostels, stores, one pool and
one pool size per hostel, every 5 s), and makes no Supabase function calls.

```bash
(cd frontend/apps/student && VITE_API_URL=http://localhost:5057 npx vite build --outDir /tmp/student-express --emptyOutDir)
node scripts/student-e2e/express-path.cjs /tmp/student-express
```
