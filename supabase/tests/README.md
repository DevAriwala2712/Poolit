# Database tests

`scripts/test-db.sh` creates a throwaway database, applies every migration in
`supabase/migrations`, then runs each `*.test.sql` here. CI runs it on every
pull request (job `database`).

```bash
DATABASE_URL=postgres://postgres@localhost:5432/postgres scripts/test-db.sh
```

- `00_stubs.sql` stands in for the Supabase roles (`anon`, `authenticated`,
  `service_role`) and `auth.users` / `auth.uid()` on a plain Postgres. It is
  never applied to a real project.
- `10_api_security.test.sql` signs in as an anonymous visitor, two students, a
  stranger, a store owner, store staff and another store's owner, and checks
  each can do exactly what they own. It also checks the grants: no table is
  reachable by the public roles, and only the listed `api_*` functions are
  callable without signing in.
- `20_pool_rotation.test.sql` covers the every-minute pool rotation (`sweep_expired_slots`).

Every new `api_*` function must be added to the public list in test 10 or it
fails the "anonymous access must match the public list" check.
